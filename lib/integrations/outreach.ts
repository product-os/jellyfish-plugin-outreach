import * as assert from '@balena/jellyfish-assert';
import {
	Integration,
	IntegrationDefinition,
	IntegrationInitializationOptions,
	SequenceItem,
	syncErrors,
} from '@balena/jellyfish-worker';
import type { Contract } from 'autumndb';
import crypto from 'crypto';
import _ from 'lodash';
import { v4 as isUUID } from 'is-uuid';

const MAX_NAME_LENGTH = 50;
const SLUG = 'outreach';

const USER_PROSPECT_MAPPING = [
	{
		prospect: ['addressCity'],
		user: ['data', 'profile', 'city'],
	},
	{
		prospect: ['occupation'],
		user: ['data', 'profile', 'company'],
	},
	{
		prospect: ['addressCountry'],
		user: ['data', 'profile', 'country'],
	},
	{
		prospect: ['title'],
		user: ['data', 'profile', 'type'],
	},
	{
		prospect: ['firstName'],
		user: ['data', 'profile', 'name', 'first'],
		fn: (value: string) => {
			return _.truncate(value, {
				length: MAX_NAME_LENGTH,
			});
		},
	},
	{
		prospect: ['lastName'],
		user: ['data', 'profile', 'name', 'last'],
		fn: (value: string) => {
			return _.truncate(value, {
				length: MAX_NAME_LENGTH,
			});
		},
	},
	{
		prospect: ['tags'],
		user: ['tags'],
	},
];

type Options = IntegrationInitializationOptions;

// TODO: Create an account for each company we know about
// if it doesn't already exist, and associate the prospect
// with the right company resource.
const getProspectAttributes = (contact: any) => {
	const githubUsername = contact.slug.startsWith('contact-gh-')
		? contact.slug.replace(/^contact-gh-/g, '')
		: null;

	const attributes = {
		// As we may still have users around with these
		// auto-generated emails that Outreach doesn't
		// like as it claims they were taken already.
		emails: _.flatten([
			contact.data.profile && contact.data.profile.email,
		]).filter((email: string) => {
			return email && !email.endsWith('@change.me');
		}),

		githubUsername,
		nickname: contact.slug.replace(/^contact-/g, ''),
		custom1: `https://jel.ly.fish/${contact.id}`,
	};

	for (const mapping of USER_PROSPECT_MAPPING) {
		const value = _.get(contact, mapping.user);
		if (value) {
			const fn = mapping.fn || _.identity;
			_.set(attributes, mapping.prospect, fn(value));
		}
	}

	return attributes;
};

async function getProspectByEmail(
	context: Options['context'],
	actor: string,
	baseUrl: string,
	emails: any,
): Promise<any> {
	if (!emails || _.isEmpty(emails)) {
		return null;
	}

	for (const email of _.castArray(emails)) {
		context.log.info('Searching for propect by email', {
			email,
		});

		const searchResult = await context
			.request(actor, {
				method: 'GET',
				json: true,
				uri: '/api/v2/prospects',
				baseUrl,
				useQuerystring: true,
				data: {
					'filter[emails]': email,
				},
			})
			.catch((error: any) => {
				if (error.expected && error.name === 'SyncOAuthNoUserError') {
					return null;
				}

				throw error;
			});

		if (!searchResult) {
			continue;
		}

		assert.INTERNAL(
			null,
			searchResult.code === 200 || searchResult.code === 404,
			syncErrors.SyncExternalRequestError,
			`Cannot find prospect by email ${emails}: ${searchResult.code}`,
		);

		const result = _.first(searchResult.body.data);
		context.log.info('Found prospect by email', {
			email,
			prospect: result,
		});

		return result;
	}

	context.log.info('Could not find prospect by emails', {
		emails,
	});

	return null;
}

async function getByIdOrSlug(context: any, idOrSlug: string): Promise<any> {
	return (
		(isUUID(idOrSlug) && (await context.getElementById(idOrSlug))) ||
		context.getElementBySlug(`${idOrSlug}@latest`)
	);
}

async function upsertProspect(
	context: Options['context'],
	actor: string,
	baseUrl: string,
	card: any,
	retries = 5,
): Promise<any> {
	const contactEmail = card.data.profile && card.data.profile.email;
	const prospect = await getProspectByEmail(
		context,
		actor,
		baseUrl,
		contactEmail,
	);

	const outreachUrl =
		_.get(prospect, ['links', 'self']) ||
		_.find(card.data.mirrors, (mirror) => {
			return _.startsWith(mirror, baseUrl);
		});

	const method = outreachUrl ? 'PATCH' : 'POST';
	const uri = outreachUrl || `${baseUrl}/api/v2/prospects`;

	const body: any = {
		data: {
			type: 'prospect',
			attributes: getProspectAttributes(card),
		},
	};

	if (card.data.origin) {
		const origin = await getByIdOrSlug(context, card.data.origin);
		if (
			origin &&
			origin.type &&
			origin.type.split('@')[0] === 'external-event' &&
			origin.data.source
		) {
			body.data.attributes.tags = body.data.attributes.tags || [];
			if (!body.data.attributes.tags.includes(origin.data.source)) {
				body.data.attributes.tags.push(origin.data.source);
			}
		}
	}

	if (outreachUrl) {
		body.data.id = _.parseInt(_.last(outreachUrl.split('/')) || '');
	}

	context.log.info('Mirroring Outreach', {
		url: uri,
		remote: card,
	});

	const result = await context
		.request(actor, {
			method,
			json: true,
			uri: '',
			baseUrl: uri,
			data: body,
		})
		.catch((error: any) => {
			if (error.expected && error.name === 'SyncOAuthNoUserError') {
				return null;
			}

			throw error;
		});

	if (!result) {
		return [];
	}

	// This usually means that the email's domain belongs
	// to the company managing the Outreach account.
	if (
		result.code === 422 &&
		result.body.errors[0] &&
		result.body.errors[0].id === 'validationError' &&
		result.body.errors[0].detail ===
			'Contacts contact is using an excluded email address.'
	) {
		context.log.info('Omitting excluded prospect by email address', {
			prospect: card,
			url: uri,
		});

		return [];
	}

	// When creating prospect, we first ask Outreach if it knows about an
	// email address in order decide if we have to insert or update.
	// If there are multiple requests coming in at the same time, one
	// may create the prospect after the other process asked Outreach about
	// it, causing a race condition where a prospect will be inserted twice,
	// resulting in an "already taken" error.
	if (
		result.code === 422 &&
		result.body.errors[0] &&
		result.body.errors[0].id === 'validationError' &&
		result.body.errors[0].detail ===
			'Contacts email hash has already been taken.'
	) {
		context.log.info('Retrying taken address', {
			prospect: card,
			url: uri,
		});

		assert.INTERNAL(
			null,
			retries > 0,
			syncErrors.SyncExternalRequestError,
			() => {
				return `Prospect validation error: ${JSON.stringify(body, null, 2)}`;
			},
		);

		return upsertProspect(context, actor, baseUrl, card, retries - 1);
	}

	if (outreachUrl) {
		if (result.code === 404) {
			context.log.warn('Remote prospect not found', {
				url: uri,
				prospect: card,
			});

			return [];
		}

		// This means that the update didn't bring any new
		// information to the prospect. The remote resource
		// was up to date with what we were trying to update.
		if (
			result.code === 422 &&
			result.body.errors[0] &&
			result.body.errors[0].id === 'validationDuplicateValueError' &&
			result.body.errors[0].detail ===
				'A Contact with this email_hash already exists.'
		) {
			context.log.info('Update not needed for remote prospect', {
				prospect: card,
				url: uri,
			});

			return [];
		}

		assert.INTERNAL(
			null,
			result.code === 200,
			syncErrors.SyncExternalRequestError,
			() => {
				return [
					`Could not update prospect: Got ${result.code} ${JSON.stringify(
						result.body,
						null,
						2,
					)}`,
					`when sending ${JSON.stringify(body, null, 2)} to ${outreachUrl}`,
				].join('\n');
			},
		);

		context.log.info('Updated prospect', {
			contacts: card,
			url: outreachUrl,
		});

		if (!card.data.mirrors || !card.data.mirrors.includes(outreachUrl)) {
			card.data.mirrors = (card.data.mirrors || []).filter((mirror) => {
				return !mirror.startsWith(baseUrl);
			});
			card.data.mirrors.push(outreachUrl);
			for (const mapping of USER_PROSPECT_MAPPING) {
				const prospectProperty = _.get(prospect.attributes, mapping.prospect);
				if (prospectProperty && !_.get(card, mapping.user)) {
					_.set(card, mapping.user, prospectProperty);
				}
			}

			context.log.info('Adding missing mirror url', {
				slug: card.slug,
				url: outreachUrl,
			});

			return [
				{
					time: new Date(),
					actor,
					card,
				},
			];
		}

		return [];
	}

	assert.INTERNAL(
		null,
		result.code === 201,
		syncErrors.SyncExternalRequestError,
		() => {
			return [
				`Could not create prospect: Got ${result.code} ${JSON.stringify(
					result.body,
					null,
					2,
				)}`,
				`when sending ${JSON.stringify(body, null, 2)} to ${outreachUrl}`,
			].join('\n');
		},
	);

	card.data.mirrors = card.data.mirrors || [];
	card.data.mirrors.push(result.body.data.links.self);

	context.log.info('Created prospect', {
		contact: card,
		url: outreachUrl,
		data: result.body,
	});

	return [
		{
			time: new Date(),
			actor,
			card,
		},
	];
}

function getSequenceCard(url: string, attributes: any, options: any): any {
	return {
		name: attributes.name,
		tags: [],
		links: {},
		markers: [],
		active: options.active,
		type: 'email-sequence@1.0.0',
		slug: `email-sequence-${options.orgId}-${options.id}`,
		data: {
			translateDate: options.translateDate.toISOString(),
			mirrors: [url],
		},
	};
}

export class OutreachIntegration implements Integration {
	public slug = SLUG;
	public baseUrl: string;

	// TS-TODO: Use proper types
	public context: Options['context'];
	public options: Options;

	// TS-TODO: Use proper types
	constructor(options: Options) {
		this.options = options;
		this.context = this.options.context;
		this.baseUrl = 'https://api.outreach.io';
	}

	public async destroy() {
		return Promise.resolve();
	}

	public async mirror(
		card: Contract,
		options: { actor: string },
	): Promise<SequenceItem[]> {
		const baseType = card.type.split('@')[0];
		if (baseType !== 'contact') {
			return [];
		}

		const upsertResult = await upsertProspect(
			this.context,
			options.actor,
			this.baseUrl,
			card,
		);

		return upsertResult;
	}

	// TS-TODO: May want to use EventContract with typed data.payload
	// so we can stop casting as any multiple times within this function
	public async translate(event: Contract): Promise<SequenceItem[]> {
		// TS-TODO: Stop casting as any
		const data = (event.data.payload as any).data;
		const orgId = (event.data.headers as any)['outreach-org-id'];

		// Lets only translate sequences for now
		if (data.type !== 'sequence') {
			return [];
		}

		// A no-op update
		if (_.isEmpty(data.attributes)) {
			return [];
		}

		// TS-TODO: Stop casting as any
		const eventType = (event.data.payload as any).meta.eventName;

		// The Balena API doesn't emit actors in events, so most
		// of them will be done by the admin user.
		const adminActorId = await this.context.getActorId({
			handle: this.options.defaultUser,
		});

		assert.INTERNAL(
			null,
			adminActorId,
			syncErrors.SyncNoActor,
			`No such actor: ${this.options.defaultUser}`,
		);

		const url = `https://api.outreach.io/api/v2/sequences/${data.id}`;
		const eventCard = await this.context.getElementByMirrorId(
			'email-sequence@1.0.0',
			url,
		);

		if (eventCard) {
			data.attributes.name = data.attributes.name || eventCard.name;
		}

		if (eventType === 'sequence.updated' && !eventCard) {
			const remoteSequence = await this.context
				.request(adminActorId, {
					method: 'GET',
					json: true,
					uri: '',
					baseUrl: url,
				})
				.catch((error) => {
					if (error.expected && error.name === 'SyncOAuthNoUserError') {
						return null;
					}

					throw error;
				});

			if (!remoteSequence) {
				return [];
			}

			assert.INTERNAL(
				null,
				remoteSequence.code === 200,
				syncErrors.SyncExternalRequestError,
				() => {
					return `Could not get sequence from ${url}: ${JSON.stringify(
						remoteSequence,
						null,
						2,
					)}`;
				},
			);

			data.attributes.name =
				data.attributes.name || remoteSequence.body.data.attributes.name;
			data.attributes.shareType =
				data.attributes.shareType ||
				remoteSequence.body.data.attributes.shareType;
		}

		const isPublic =
			data.attributes.shareType === 'shared' ||
			_.isNil(data.attributes.shareType);

		// TS-TODO: Stop casting as any
		const sequenceCard = getSequenceCard(url, data.attributes, {
			id: data.id,
			active: eventType !== 'sequence.destroyed' && isPublic,
			translateDate: new Date((event.data.payload as any).meta.deliveredAt),
			orgId,
		});

		if (eventCard && eventCard.data.translateDate) {
			if (
				new Date(eventCard.data.translateDate as string) >=
				new Date(sequenceCard.data.translateDate)
			) {
				return [];
			}
		}

		// TS-TODO: Stop casting as any
		const updateTimestamp =
			data.attributes.updatedAt &&
			data.attributes.updatedAt !== data.attributes.createdAt
				? data.attributes.updatedAt
				: (event.data.payload as any).meta.deliveredAt;

		const date =
			eventType === 'sequence.created'
				? new Date(data.attributes.createdAt)
				: new Date(updateTimestamp);

		return [
			{
				time: date,
				actor: adminActorId,
				card: sequenceCard,
			},
		];
	}
}

export const outreachIntegrationDefinition: IntegrationDefinition = {
	slug: SLUG,
	initialize: async (options) => new OutreachIntegration(options),
	isEventValid: (_logContext, token, rawEvent, headers) => {
		const signature = headers['outreach-webhook-signature'];
		if (!signature) {
			return false;
		}

		if (!token || !token.signature) {
			return false;
		}

		const hash = crypto
			.createHmac('sha256', token.signature)
			.update(rawEvent)
			.digest('hex');

		return hash === signature;
	},
	whoami: async () => {
		_.constant(null);
	},
	match: async (context, _externalUser, options) => {
		assert.INTERNAL(
			context,
			options.slug,
			syncErrors.SyncInvalidArg,
			'Slug is a required argument',
		);

		const user = await context.getElementBySlug(options.slug);

		assert.INTERNAL(
			context,
			user,
			syncErrors.SyncNoMatchingUser,
			`Could not find user matching outreach user by slug "${options.slug}"`,
		);

		return user;
	},
	getExternalUserSyncEventData: async () => {
		throw new Error('Not implemented');
	},
};
