import { defaultEnvironment as environment } from '@balena/jellyfish-environment';
import { testUtils } from '@balena/jellyfish-worker';
import { strict as assert } from 'assert';
import _ from 'lodash';
import nock from 'nock';
import { randomUUID } from 'node:crypto';
import querystring from 'querystring';
import axios, { AxiosRequestConfig } from 'axios';
import * as outreachMock from './outreach-mock';

import { outreachPlugin } from '../../lib';

let ctx: testUtils.TestContext;
let getProspect: (id: number) => Promise<any>;

beforeAll(async () => {
	ctx = await testUtils.newContext({
		plugins: [outreachPlugin()],
	});
});

afterAll(() => {
	return testUtils.destroyContext(ctx);
});

const OAUTH_DETAILS = {
	access_token: 'MTQ0NjJkZmQ5OTM2NDE1ZTZjNGZmZjI3',
	token_type: 'bearer',
	expires_in: 3600,
	refresh_token: 'IwOGYzYTlmM2YxOTQ5MGE3YmNmMDFkNTVk',
	scope: 'create',
};

const NOCK_OPTS = {
	reqheaders: {
		Authorization: `Bearer ${OAUTH_DETAILS.access_token}`,
	},
};

beforeEach(async () => {
	getProspect = async (id: number) => {
		try {
			const config: AxiosRequestConfig = {
				method: 'GET',
				baseURL: 'https://api.outreach.io',
				url: `/api/v2/prospects/${id}`,
				headers: {
					Authorization: NOCK_OPTS.reqheaders.Authorization,
				},
			};

			const response = await axios(config);
			const body = response.data;

			return body;
		} catch (err: any) {
			if (err.response.status === 404) {
				return null;
			}

			if (err.response.status !== 200) {
				throw new Error(
					`Got ${err.response.status}: ${JSON.stringify(
						err.response.data,
						null,
						2,
					)}`,
				);
			}

			throw err;
		}
	};

	nock.cleanAll();
	nock.disableNetConnect();
	nock.enableNetConnect('localhost');

	nock('https://api.outreach.io', NOCK_OPTS)
		.persist()
		.get('/api/v2/prospects')
		.query((object: any) => {
			return object['filter[emails]'];
		})
		.reply((uri, _body, callback) => {
			const params = querystring.parse(_.last(uri.split('?'))!);
			const result = outreachMock.getProspectByEmail(
				params['filter[emails]'] as any as string,
			);
			return callback(null, [result.code, result.response]);
		});

	nock('https://api.outreach.io', NOCK_OPTS)
		.persist()
		.get('/api/v2/accounts')
		.query((object: any) => {
			return object['filter[name]'];
		})
		.reply((uri, _body, callback) => {
			const params = querystring.parse(_.last(uri.split('?'))!);
			const result = outreachMock.getAccountByName(
				params['filter[emails]'] as any as string,
			);
			return callback(null, [result.code, result.response]);
		});

	nock('https://api.outreach.io', NOCK_OPTS)
		.persist()
		.post('/api/v2/accounts')
		.reply((_uri, body, callback) => {
			const result = outreachMock.postAccount(body as any);
			return callback(null, [result.code, result.response]);
		});

	nock('https://api.outreach.io', NOCK_OPTS)
		.persist()
		.post('/api/v2/prospects')
		.reply((_uri, body, callback) => {
			const result = outreachMock.postProspect(body as any);
			return callback(null, [result.code, result.response]);
		});

	nock('https://api.outreach.io', NOCK_OPTS)
		.persist()
		.patch(/^\/api\/v2\/prospects\/\d+$/)
		.reply((uri, body: any, callback: any) => {
			const id = _.parseInt(_.last(uri.split('/'))!);
			if (id !== body.data.id) {
				return callback(new Error('Ids do not match'));
			}

			const result = outreachMock.patchProspect(body);
			return callback(null, [result.code, result.response]);
		});

	nock('https://api.outreach.io', NOCK_OPTS)
		.persist()
		.get(/^\/api\/v2\/prospects\/\d+$/)
		.reply((uri, _body, callback) => {
			const result = outreachMock.getProspect(
				_.parseInt(_.last(uri.split('/'))!),
			);
			return callback(null, [result.code, result.response]);
		});

	const user = await ctx.kernel.getCardBySlug(
		ctx.logContext,
		ctx.session,
		`user-${environment.integration.default.user}@1.0.0`,
	);

	assert(user);

	await ctx.worker.patchCard(
		ctx.logContext,
		ctx.session,
		ctx.worker.typeContracts[user.type],
		{
			attachEvents: true,
			actor: ctx.adminUserId,
		},
		user,
		[
			{
				op: 'add',
				path: '/data/oauth',
				value: {},
			},
			{
				op: 'add',
				path: '/data/oauth/outreach',
				value: OAUTH_DETAILS,
			},
		],
	);
});

afterEach(async () => {
	nock.cleanAll();
});

const waitForContactWithMirror = async (slug: string) => {
	return ctx.waitForMatch({
		type: 'object',
		required: ['slug', 'data'],
		properties: {
			slug: {
				const: slug,
			},
			data: {
				type: 'object',
				required: ['mirrors'],
				properties: {
					mirrors: {
						type: 'array',
						minItems: 1,
					},
				},
			},
		},
	});
};

test('should update mirror URL to prospect with new email address', async () => {
	const username = `test-update-mirror-url-${randomUUID()}`;

	const prospectResult = outreachMock.postProspect({
		data: {
			type: 'prospect',
			attributes: {
				emails: [`${username}-test@test.io`],
				firstName: 'John',
				lastName: 'Doe',
			},
		},
	});

	assert(prospectResult);

	expect(prospectResult.code).toBe(201);

	const createResult = await ctx.createContract(
		ctx.adminUserId,
		ctx.session,
		'contact@1.0.0',
		null,
		{
			profile: {
				email: `${username}@test.io`,
			},
		},
	);

	await ctx.flushAll(ctx.session);

	const contact = await waitForContactWithMirror(createResult.slug);

	expect(contact.data.mirrors).not.toEqual([
		prospectResult.response.data!.links.self,
	]);

	await ctx.worker.patchCard(
		ctx.logContext,
		ctx.session,
		ctx.worker.typeContracts[contact.type],
		{
			attachEvents: true,
			actor: ctx.adminUserId,
		},
		contact,
		[
			{
				op: 'replace',
				path: '/data/profile/email',
				value: `${username}-test@test.io`,
			},
		],
	);
	await ctx.flushAll(ctx.session);

	const newContact = await ctx.kernel.getContractById(
		ctx.logContext,
		ctx.session,
		createResult.id,
	);
	assert(newContact);
	expect(newContact.data.mirrors).toEqual([
		prospectResult.response.data!.links.self,
	]);
});

test('should not update remote prospects that do not exist', async () => {
	const username = `test-not-update-remote-prospects-${randomUUID()}`;

	const createResult = await ctx.createContract(
		ctx.adminUserId,
		ctx.session,
		'contact@1.0.0',
		null,
		{
			profile: {
				email: `${username}@test.io`,
			},
		},
	);

	const mirrorUrl = 'https://api.outreach.io/api/v2/prospects/99999999999';

	await ctx.worker.patchCard(
		ctx.logContext,
		ctx.session,
		ctx.worker.typeContracts[createResult.type],
		{
			attachEvents: true,
			actor: ctx.adminUserId,
		},
		createResult,
		[
			{
				op: 'replace',
				path: '/data/mirrors',
				value: [mirrorUrl],
			},
		],
	);
	await ctx.flushAll(ctx.session);

	const contact = await waitForContactWithMirror(createResult.slug);

	assert(contact);

	expect(contact.data).toEqual({
		mirrors: [mirrorUrl],
		profile: {
			email: `${username}@test.io`,
		},
	});

	const prospectId = _.parseInt(
		_.last((contact as any).data.mirrors[0].split('/'))!!,
	);
	const prospect = await getProspect(prospectId);
	expect(prospect).toBeFalsy();
});

test('should handle pointless contact updates', async () => {
	const username = `test-handle-pointless-contact-updates-${randomUUID()}`;

	const createResult = await ctx.worker.insertCard(
		ctx.logContext,
		ctx.session,
		ctx.worker.typeContracts['contact@1.0.0'],
		{
			attachEvents: true,
			actor: ctx.adminUserId,
		},
		{
			slug: `contact-${username}`,
			type: 'contact',
			data: {
				profile: {
					email: `${username}@test.io`,
				},
			},
		},
	);

	assert(createResult);

	await ctx.flushAll(ctx.session);

	const contact = await waitForContactWithMirror(createResult.slug);

	expect(contact.data).toEqual({
		mirrors: contact.data.mirrors,
		profile: {
			email: `${username}@test.io`,
		},
	});

	// To trigger mirroring
	await ctx.worker.patchCard(
		ctx.logContext,
		ctx.session,
		ctx.worker.typeContracts[contact.type],
		{
			attachEvents: true,
			actor: ctx.adminUserId,
		},
		contact,
		[
			{
				op: 'add',
				path: '/data/foo',
				value: 'bar',
			},
		],
	);
	await ctx.flushAll(ctx.session);

	expect((contact as any).data.mirrors.length).toBe(1);
	expect(
		(contact as any).data.mirrors[0].startsWith(
			'https://api.outreach.io/api/v2/prospects/',
		),
	).toBe(true);
	const prospectId = _.parseInt(
		_.last((contact as any).data.mirrors[0].split('/'))!!,
	);
	const prospect = await getProspect(prospectId);

	expect(prospect.data.attributes.emails).toEqual([`${username}@test.io`]);
	expect(prospect.data.attributes.name).toBe(username);
	expect(prospect.data.attributes.nickname).toBe(username);
	expect(prospect.data.attributes.githubUsername).toBeFalsy();
	expect(prospect.data.attributes.occupation).toBeFalsy();
	expect(prospect.data.attributes.custom1).toBe(
		`https://jel.ly.fish/${contact.id}`,
	);
});

test('should add a tag with the linked user external event slug origin type', async () => {
	const username = `test-add-tag-event-origin-type-${randomUUID()}`;

	const event = await ctx.createContract(
		ctx.adminUserId,
		ctx.session,
		'external-event@1.0.0',
		null,
		{
			source: 'my-fake-service',
			headers: {},
			payload: {
				test: 1,
			},
		},
	);

	expect(event.id).toBeTruthy();

	const user = await ctx.worker.insertCard(
		ctx.logContext,
		ctx.session,
		ctx.worker.typeContracts['user@1.0.0'],
		{
			attachEvents: true,
			actor: ctx.adminUserId,
		},
		{
			slug: `user-${username}`,
			data: {
				email: `${username}@test.io`,
				origin: `${event.slug}@${event.version}`,
				roles: ['user-community'],
				hash: '$2b$12$tnb9eMnlGpEXld1IYmIlDOud.v4vSUbnuEsjFQz3d/24sqA6XmaBq',
			},
		},
	);

	assert(user);

	await ctx.flushAll(ctx.session);

	expect(user.id).toBeTruthy();

	const contact = await waitForContactWithMirror(
		user.slug.replace('user', 'contact'),
	);

	assert(contact);

	expect((contact as any).data.mirrors.length).toBe(1);
	expect(
		(contact as any).data.mirrors[0].startsWith(
			'https://api.outreach.io/api/v2/prospects/',
		),
	).toBe(true);
	const prospectId = _.parseInt(
		_.last((contact as any).data.mirrors[0].split('/'))!,
	);
	const prospect = await getProspect(prospectId);

	expect(prospect.data.attributes.emails).toEqual([`${username}@test.io`]);
	expect(prospect.data.attributes.name).toBe(username);
	expect(prospect.data.attributes.tags).toEqual(['my-fake-service']);
	expect(prospect.data.attributes.nickname).toBe(username);
	expect(prospect.data.attributes.custom1).toBe(
		`https://jel.ly.fish/${contact.id}`,
	);
});

test('should store the user country and city', async () => {
	const username = `test-country-city-${randomUUID()}`;

	const event = await ctx.createContract(
		ctx.adminUserId,
		ctx.session,
		'external-event@1.0.0',
		null,
		{
			source: 'my-fake-service',
			headers: {},
			payload: {
				test: 1,
			},
		},
	);

	expect(event.id).toBeTruthy();

	const user = await ctx.worker.insertCard(
		ctx.logContext,
		ctx.session,
		ctx.worker.typeContracts['user@1.0.0'],
		{
			attachEvents: true,
			actor: ctx.adminUserId,
		},
		{
			slug: `user-${username}`,
			data: {
				email: `${username}@test.io`,
				origin: event.id,
				roles: ['user-community'],
				hash: '$2b$12$tnb9eMnlGpEXld1IYmIlDOud.v4vSUbnuEsjFQz3d/24sqA6XmaBq',
				profile: {
					country: 'GB',
					city: 'Oxford',
				},
			},
		},
	);

	assert(user);

	await ctx.flushAll(ctx.session);

	expect(user.id).toBeTruthy();

	const contact = await waitForContactWithMirror(
		user.slug.replace('user', 'contact'),
	);

	expect((contact as any).data.mirrors.length).toBe(1);
	expect(
		(contact as any).data.mirrors[0].startsWith(
			'https://api.outreach.io/api/v2/prospects/',
		),
	).toBe(true);
	const prospectId = _.parseInt(
		_.last((contact as any).data.mirrors[0].split('/'))!,
	);
	const prospect = await getProspect(prospectId);

	expect(prospect.data.attributes.emails).toEqual([`${username}@test.io`]);
	expect(prospect.data.attributes.name).toBe(username);
	expect(prospect.data.attributes.tags).toEqual(['my-fake-service']);
	expect(prospect.data.attributes.nickname).toBe(username);
	expect(prospect.data.attributes.addressCity).toBe('Oxford');
	expect(prospect.data.attributes.addressCountry).toBe('GB');
	expect(prospect.data.attributes.custom1).toBe(
		`https://jel.ly.fish/${contact.id}`,
	);
});

test('should add a tag with the linked user external event id origin type', async () => {
	const username = `test-add-tag-event-id-origin-type-${randomUUID()}`;

	const event = await ctx.createContract(
		ctx.adminUserId,
		ctx.session,
		'external-event@1.0.0',
		null,
		{
			source: 'my-fake-service',
			headers: {},
			payload: {
				test: 1,
			},
		},
	);

	expect(event.id).toBeTruthy();

	const user = await ctx.worker.insertCard(
		ctx.logContext,
		ctx.session,
		ctx.worker.typeContracts['user@1.0.0'],
		{
			attachEvents: true,
			actor: ctx.adminUserId,
		},
		{
			slug: `user-${username}`,
			data: {
				email: `${username}@test.io`,
				origin: event.id,
				roles: ['user-community'],
				hash: '$2b$12$tnb9eMnlGpEXld1IYmIlDOud.v4vSUbnuEsjFQz3d/24sqA6XmaBq',
			},
		},
	);

	assert(user);

	await ctx.flushAll(ctx.session);

	expect(user.id).toBeTruthy();

	const contact = await waitForContactWithMirror(
		user.slug.replace('user', 'contact'),
	);

	assert(contact);

	expect((contact as any).data.mirrors.length).toBe(1);
	expect(
		(contact as any).data.mirrors[0].startsWith(
			'https://api.outreach.io/api/v2/prospects/',
		),
	).toBe(true);
	const prospectId = _.parseInt(
		_.last((contact as any).data.mirrors[0].split('/'))!,
	);
	const prospect = await getProspect(prospectId);
	expect(prospect.data.attributes.emails).toEqual([`${username}@test.io`]);
	expect(prospect.data.attributes.name).toBe(username);
	expect(prospect.data.attributes.tags).toEqual(['my-fake-service']);
	expect(prospect.data.attributes.nickname).toBe(username);
	expect(prospect.data.attributes.custom1).toBe(
		`https://jel.ly.fish/${contact.id}`,
	);
});

test('should correctly add an email address to a contact with more than one address', async () => {
	const username = `test-add-email-more-than-one-address-${randomUUID()}`;

	const createResult = await ctx.createContract(
		ctx.adminUserId,
		ctx.session,
		'contact@1.0.0',
		null,
		{
			profile: {
				email: [`${username}@test.io`, `${username}@foo.io`],
			},
		},
	);

	await ctx.worker.patchCard(
		ctx.logContext,
		ctx.session,
		ctx.worker.typeContracts[createResult.type],
		{
			attachEvents: true,
			actor: ctx.adminUserId,
		},
		createResult,
		[
			{
				op: 'replace',
				path: '/data/profile/email',
				value: [
					`${username}@test.io`,
					`${username}@foo.io`,
					`${username}@gmail.io`,
				],
			},
		],
	);

	await ctx.flushAll(ctx.session);

	const contact = await waitForContactWithMirror(createResult.slug);

	expect(contact.data).toEqual({
		mirrors: contact.data.mirrors,
		profile: {
			email: [
				`${username}@test.io`,
				`${username}@foo.io`,
				`${username}@gmail.io`,
			],
		},
	});

	expect((contact as any).data.mirrors.length).toBe(1);
	expect(
		(contact as any).data.mirrors[0].startsWith(
			'https://api.outreach.io/api/v2/prospects/',
		),
	).toBe(true);
	const prospectId = _.parseInt(
		_.last((contact as any).data.mirrors[0].split('/'))!!,
	);
	const prospect = await getProspect(prospectId);

	expect(prospect.data.attributes.emails).toEqual([
		`${username}@test.io`,
		`${username}@foo.io`,
		`${username}@gmail.io`,
	]);

	expect(prospect.data.attributes.custom1).toBe(
		`https://jel.ly.fish/${contact.id}`,
	);
});

test('should not update a synced contact with an excluded address', async () => {
	const username = `test-not-update-excluded-address-${randomUUID()}`;

	const createResult = await ctx.worker.insertCard(
		ctx.logContext,
		ctx.session,
		ctx.worker.typeContracts['contact@1.0.0'],
		{
			attachEvents: true,
			actor: ctx.adminUserId,
		},
		{
			slug: `contact-${username}`,
			type: 'contact',
			data: {
				profile: {
					email: `${username}@test.io`,
				},
			},
		},
	);

	assert(createResult);

	await ctx.flushAll(ctx.session);

	await ctx.worker.patchCard(
		ctx.logContext,
		ctx.session,
		ctx.worker.typeContracts[createResult.type],
		{
			attachEvents: true,
			actor: ctx.adminUserId,
		},
		createResult,
		[
			{
				op: 'replace',
				path: '/data/profile/email',
				value: `${username}@balena.io`,
			},
		],
	);

	await ctx.flushAll(ctx.session);

	const contact = await waitForContactWithMirror(createResult.slug);

	expect(contact.data).toEqual({
		mirrors: contact.data.mirrors,
		profile: {
			email: `${username}@balena.io`,
		},
	});

	expect((contact as any).data.mirrors.length).toBe(1);
	expect(
		(contact as any).data.mirrors[0].startsWith(
			'https://api.outreach.io/api/v2/prospects/',
		),
	).toBe(true);
	const prospectId = _.parseInt(
		_.last((contact as any).data.mirrors[0].split('/'))!!,
	);
	const prospect = await getProspect(prospectId);

	expect(prospect.data.attributes.emails).toEqual([`${username}@test.io`]);
	expect(prospect.data.attributes.custom1).toBe(
		`https://jel.ly.fish/${contact.id}`,
	);
});

test('should link a user with an existing prospect', async () => {
	const username = `test-link-existing-prospect-${randomUUID()}`;

	const prospectResult = outreachMock.postProspect({
		data: {
			type: 'prospect',
			attributes: {
				emails: [`${username}@test.io`],
				firstName: 'John',
				lastName: 'Doe',
			},
		},
	});

	expect(prospectResult.code).toBe(201);

	const createResult = await ctx.createContract(
		ctx.adminUserId,
		ctx.session,
		'contact@1.0.0',
		null,
		{
			profile: {
				email: `${username}@test.io`,
				city: 'Oxford',
				country: 'United Kingdom',
			},
		},
	);

	const contact = await waitForContactWithMirror(createResult.slug);

	expect(contact.data).toEqual({
		mirrors: contact.data.mirrors,
		profile: {
			email: `${username}@test.io`,
			city: 'Oxford',
			country: 'United Kingdom',
			name: {
				first: 'John',
				last: 'Doe',
			},
		},
	});

	expect((contact as any).data.mirrors.length).toBe(1);
	expect(
		(contact as any).data.mirrors[0].startsWith(
			'https://api.outreach.io/api/v2/prospects/',
		),
	).toBe(true);
	const prospectId = _.parseInt(
		_.last((contact as any).data.mirrors[0].split('/'))!!,
	);
	const prospect = await getProspect(prospectId);

	expect(prospect.data.attributes.emails).toEqual([`${username}@test.io`]);
	expect(prospect.data.attributes.firstName).toBe('John');
	expect(prospect.data.attributes.lastName).toBe('Doe');
	expect(prospect.data.attributes.addressCity).toBe('Oxford');
	expect(prospect.data.attributes.addressCountry).toBe('United Kingdom');
	expect(prospect.data.attributes.githubUsername).toBeFalsy();
	expect(prospect.data.attributes.custom1).toBe(
		`https://jel.ly.fish/${contact.id}`,
	);
});

test('should sync a contact with multiple emails', async () => {
	const username = `test-sync-contact-multiple-emails-${randomUUID()}`;

	const createResult = await ctx.worker.insertCard(
		ctx.logContext,
		ctx.session,
		ctx.worker.typeContracts['contact@1.0.0'],
		{
			attachEvents: true,
			actor: ctx.adminUserId,
		},
		{
			slug: `contact-${username}`,
			type: 'contact',
			data: {
				profile: {
					email: [`${username}@test.io`, `${username}@gmail.com`],
					company: 'Balena',
				},
			},
		},
	);

	assert(createResult);

	await ctx.flushAll(ctx.session);

	const contact: any = await waitForContactWithMirror(createResult.slug);

	expect(contact.data).toEqual({
		mirrors: contact.data.mirrors,
		profile: {
			company: 'Balena',
			email: [`${username}@test.io`, `${username}@gmail.com`],
		},
	});

	expect(contact.data.mirrors.length).toBe(1);
	expect(
		contact.data.mirrors[0].startsWith(
			'https://api.outreach.io/api/v2/prospects/',
		),
	).toBe(true);
	const prospectId = _.parseInt(_.last(contact.data.mirrors[0].split('/'))!);
	const prospect = await getProspect(prospectId);

	expect(prospect.data.attributes.emails).toEqual([
		`${username}@test.io`,
		`${username}@gmail.com`,
	]);

	expect(prospect.data.attributes.name).toBe(username);
	expect(prospect.data.attributes.nickname).toBe(username);
	expect(prospect.data.attributes.company).toBe('');
	expect(prospect.data.attributes.githubUsername).toBeFalsy();
	expect(prospect.data.attributes.custom1).toBe(
		`https://jel.ly.fish/${contact.id}`,
	);

	await ctx.waitForMatch({
		type: 'object',
		required: ['type', 'name', 'data'],
		properties: {
			type: {
				const: 'outreach-account@1.0.0',
			},
			name: {
				const: (createResult.data.profile as any).company,
			},
			data: {
				type: 'object',
				required: ['mirrors'],
				properties: {
					mirrors: {
						type: 'array',
						contains: {
							type: 'string',
							pattern: 'https://api.outreach.io/api/v2/accounts/',
						},
					},
				},
			},
		},
	});
});

test('should create a simple contact', async () => {
	const username = `test-create-simple-contact-${randomUUID()}`;

	const createResult = await ctx.worker.insertCard(
		ctx.logContext,
		ctx.session,
		ctx.worker.typeContracts['contact@1.0.0'],
		{
			attachEvents: true,
			actor: ctx.adminUserId,
		},
		{
			slug: `contact-${username}`,
			type: 'contact',
			data: {
				profile: {
					email: `${username}@test.io`,
				},
			},
		},
	);

	assert(createResult);

	await ctx.flushAll(ctx.session);

	const contact: any = await waitForContactWithMirror(createResult.slug);

	expect(contact.data).toEqual({
		mirrors: contact.data.mirrors,
		profile: {
			email: `${username}@test.io`,
		},
	});

	expect(contact.data.mirrors.length).toBe(1);
	expect(
		contact.data.mirrors[0].startsWith(
			'https://api.outreach.io/api/v2/prospects/',
		),
	).toBe(true);
	const prospectId = _.parseInt(_.last(contact.data.mirrors[0].split('/'))!);
	const prospect = await getProspect(prospectId);

	expect(prospect.data.attributes.emails).toEqual([`${username}@test.io`]);
	expect(prospect.data.attributes.name).toBe(username);
	expect(prospect.data.attributes.nickname).toBe(username);
	expect(prospect.data.attributes.githubUsername).toBeFalsy();
	expect(prospect.data.attributes.occupation).toBeFalsy();
	expect(prospect.data.attributes.custom1).toBe(
		`https://jel.ly.fish/${contact.id}`,
	);
});

test('should sync the contact type', async () => {
	const username = `test-sync-contact-type-${randomUUID()}`;

	const createResult = await ctx.worker.insertCard(
		ctx.logContext,
		ctx.session,
		ctx.worker.typeContracts['contact@1.0.0'],
		{
			attachEvents: true,
			actor: ctx.adminUserId,
		},
		{
			slug: `contact-${username}`,
			type: 'contact',
			data: {
				profile: {
					type: 'professional',
					email: `${username}@test.io`,
					company: 'Balena',
				},
			},
		},
	);

	assert(createResult);

	await ctx.flushAll(ctx.session);

	const contact: any = await waitForContactWithMirror(createResult.slug);

	expect(contact.data).toEqual({
		mirrors: contact.data.mirrors,
		profile: {
			company: 'Balena',
			type: 'professional',
			email: `${username}@test.io`,
		},
	});

	expect(contact.data.mirrors.length).toBe(1);
	expect(
		contact.data.mirrors[0].startsWith(
			'https://api.outreach.io/api/v2/prospects/',
		),
	).toBe(true);
	const prospectId = _.parseInt(_.last(contact.data.mirrors[0].split('/'))!);
	const prospect = await getProspect(prospectId);

	expect(prospect.data.attributes.emails).toEqual([`${username}@test.io`]);
	expect(prospect.data.attributes.name).toBe(username);
	expect(prospect.data.attributes.nickname).toBe(username);
	expect(prospect.data.attributes.company).toBe('');
	expect(prospect.data.attributes.title).toBe('professional');
	expect(prospect.data.attributes.githubUsername).toBeFalsy();
	expect(prospect.data.attributes.custom1).toBe(
		`https://jel.ly.fish/${contact.id}`,
	);

	await ctx.waitForMatch({
		type: 'object',
		required: ['type', 'name', 'data'],
		properties: {
			type: {
				const: 'outreach-account@1.0.0',
			},
			name: {
				const: contact.data.profile.company,
			},
			data: {
				type: 'object',
				required: ['mirrors'],
				properties: {
					mirrors: {
						type: 'array',
						contains: {
							type: 'string',
							pattern: 'https://api.outreach.io/api/v2/accounts/',
						},
					},
				},
			},
		},
	});
});

test('should truncate long first names', async () => {
	const username = `test-truncate-long-first-name-${randomUUID()}`;

	const createResult = await ctx.worker.insertCard(
		ctx.logContext,
		ctx.session,
		ctx.worker.typeContracts['contact@1.0.0'],
		{
			attachEvents: true,
			actor: ctx.adminUserId,
		},
		{
			slug: `contact-${username}`,
			type: 'contact',
			data: {
				profile: {
					email: `${username}@test.io`,
					name: {
						first: 'Long Long Long Long Long Long Long Long Long Long Long',
					},
				},
			},
		},
	);

	assert(createResult);

	await ctx.flushAll(ctx.session);

	const contact: any = await waitForContactWithMirror(createResult.slug);

	expect(contact.data).toEqual({
		mirrors: contact.data.mirrors,
		profile: {
			email: `${username}@test.io`,
			name: {
				first: 'Long Long Long Long Long Long Long Long Long Long Long',
			},
		},
	});

	expect(contact.data.mirrors.length).toBe(1);
	expect(
		contact.data.mirrors[0].startsWith(
			'https://api.outreach.io/api/v2/prospects/',
		),
	).toBe(true);
	const prospectId = _.parseInt(_.last(contact.data.mirrors[0].split('/'))!);
	const prospect = await getProspect(prospectId);

	expect(prospect.data.attributes.emails).toEqual([`${username}@test.io`]);
	expect(prospect.data.attributes.name).toBe(username);
	expect(prospect.data.attributes.nickname).toBe(username);
	expect(prospect.data.attributes.firstName).toBe(
		'Long Long Long Long Long Long Long Long Long Lo...',
	);
	expect(prospect.data.attributes.githubUsername).toBeFalsy();
	expect(prospect.data.attributes.custom1).toBe(
		`https://jel.ly.fish/${contact.id}`,
	);
});

test('should truncate long last names', async () => {
	const username = `test-truncate-long-last-name-${randomUUID()}`;

	const createResult = await ctx.worker.insertCard(
		ctx.logContext,
		ctx.session,
		ctx.worker.typeContracts['contact@1.0.0'],
		{
			attachEvents: true,
			actor: ctx.adminUserId,
		},
		{
			slug: `contact-${username}`,
			type: 'contact',
			data: {
				profile: {
					email: `${username}@test.io`,
					name: {
						last: 'Last Last Last Last Last Last Last Last Last Last Last',
					},
				},
			},
		},
	);

	assert(createResult);

	await ctx.flushAll(ctx.session);

	const contact: any = await waitForContactWithMirror(createResult.slug);

	expect(contact.data).toEqual({
		mirrors: contact.data.mirrors,
		profile: {
			email: `${username}@test.io`,
			name: {
				last: 'Last Last Last Last Last Last Last Last Last Last Last',
			},
		},
	});

	expect(contact.data.mirrors.length).toBe(1);
	expect(
		contact.data.mirrors[0].startsWith(
			'https://api.outreach.io/api/v2/prospects/',
		),
	).toBe(true);
	const prospectId = _.parseInt(_.last(contact.data.mirrors[0].split('/'))!);
	const prospect = await getProspect(prospectId);

	expect(prospect.data.attributes.emails).toEqual([`${username}@test.io`]);
	expect(prospect.data.attributes.name).toBe(username);
	expect(prospect.data.attributes.nickname).toBe(username);
	expect(prospect.data.attributes.lastName).toBe(
		'Last Last Last Last Last Last Last Last Last La...',
	);
	expect(prospect.data.attributes.githubUsername).toBeFalsy();
	expect(prospect.data.attributes.custom1).toBe(
		`https://jel.ly.fish/${contact.id}`,
	);
});

test('should use username as GitHub handle if slug starts with user-gh- (from Balena Cloud)', async () => {
	const handle = randomUUID();
	const username = `gh-${handle}`;

	const createResult = await ctx.worker.insertCard(
		ctx.logContext,
		ctx.session,
		ctx.worker.typeContracts['contact@1.0.0'],
		{
			attachEvents: true,
			actor: ctx.adminUserId,
		},
		{
			slug: `contact-${username}`,
			type: 'contact',
			data: {
				profile: {
					email: `${username}@test.io`,
				},
			},
		},
	);

	assert(createResult);

	await ctx.flushAll(ctx.session);

	const contact: any = await waitForContactWithMirror(createResult.slug);

	expect(contact.data).toEqual({
		mirrors: contact.data.mirrors,
		profile: {
			email: `${username}@test.io`,
		},
	});

	expect(contact.data.mirrors.length).toBe(1);
	expect(
		contact.data.mirrors[0].startsWith(
			'https://api.outreach.io/api/v2/prospects/',
		),
	).toBe(true);
	const prospectId = _.parseInt(_.last(contact.data.mirrors[0].split('/'))!);
	const prospect = await getProspect(prospectId);

	expect(prospect.data.attributes.emails).toEqual([`${username}@test.io`]);
	expect(prospect.data.attributes.name).toBe(username);
	expect(prospect.data.attributes.githubUsername).toBe(handle);
	expect(prospect.data.attributes.nickname).toBe(username);
	expect(prospect.data.attributes.custom1).toBe(
		`https://jel.ly.fish/${contact.id}`,
	);
});

test('should create a simple contact without an email', async () => {
	const username = `test-simple-contact-without-email-${randomUUID()}`;

	const createResult = await ctx.worker.insertCard(
		ctx.logContext,
		ctx.session,
		ctx.worker.typeContracts['contact@1.0.0'],
		{
			attachEvents: true,
			actor: ctx.adminUserId,
		},
		{
			slug: `contact-${username}`,
			type: 'contact',
			data: {},
		},
	);

	assert(createResult);

	await ctx.flushAll(ctx.session);

	const contact: any = await waitForContactWithMirror(createResult.slug);

	expect(contact.data).toEqual({
		mirrors: contact.data.mirrors,
	});

	expect(contact.data.mirrors.length).toBe(1);
	expect(
		contact.data.mirrors[0].startsWith(
			'https://api.outreach.io/api/v2/prospects/',
		),
	).toBe(true);
	const prospectId = _.parseInt(_.last(contact.data.mirrors[0].split('/'))!);
	const prospect = await getProspect(prospectId);

	expect(prospect.data.attributes.emails).toEqual([]);
	expect(prospect.data.attributes.name).toBe(username);
	expect(prospect.data.attributes.nickname).toBe(username);
	expect(prospect.data.attributes.githubUsername).toBeFalsy();
	expect(prospect.data.attributes.custom1).toBe(
		`https://jel.ly.fish/${contact.id}`,
	);
});

test('should not mirror a user card type', async () => {
	const username = `test-not-mirror-user-card-type-${randomUUID()}`;

	const user = await ctx.createContract(
		ctx.adminUserId,
		ctx.session,
		'user@1.0.0',
		null,
		{
			email: `${username}@balena.io`,
			roles: ['user-community'],
			hash: '$2b$12$tnb9eMnlGpEXld1IYmIlDOud.v4vSUbnuEsjFQz3d/24sqA6XmaBq',
		},
	);

	expect(user.data.mirrors).toBeFalsy();
	expect(user.data.email).toEqual(`${username}@balena.io`);
	expect(user.data.roles).toEqual(['user-community']);
	expect(user.data.hash).toEqual(
		'$2b$12$tnb9eMnlGpEXld1IYmIlDOud.v4vSUbnuEsjFQz3d/24sqA6XmaBq',
	);

	const results = outreachMock.getProspectByEmail(`${username}@balena.io`);
	expect(results).toEqual({
		code: 200,
		response: {
			data: [],
			meta: {
				count: 0,
			},
		},
	});
});

test('should not create a prospect with an excluded email address', async () => {
	const username = `test-not-create-prospect-excluded-email-address-${randomUUID()}`;

	const contact = await ctx.worker.insertCard(
		ctx.logContext,
		ctx.session,
		ctx.worker.typeContracts['contact@1.0.0'],
		{
			attachEvents: true,
			actor: ctx.adminUserId,
		},
		{
			slug: `contact-${username}`,
			type: 'contact',
			data: {
				profile: {
					email: `${username}@balena.io`,
				},
			},
		},
	);

	assert(contact);

	expect(contact.data).toEqual({
		profile: {
			email: `${username}@balena.io`,
		},
	});

	await ctx.flushAll(ctx.session);

	const results = outreachMock.getProspectByEmail(`${username}@balena.io`);
	expect(results).toEqual({
		code: 200,
		response: {
			data: [],
			meta: {
				count: 0,
			},
		},
	});
});

test('should not sync emails on contacts with new@change.me', async () => {
	const username = `test-not-sync-emails-new-changeme-${randomUUID()}`;

	const createResult = await ctx.worker.insertCard(
		ctx.logContext,
		ctx.session,
		ctx.worker.typeContracts['contact@1.0.0'],
		{
			attachEvents: true,
			actor: ctx.adminUserId,
		},
		{
			slug: `contact-${username}`,
			type: 'contact',
			data: {
				profile: {
					email: 'new@change.me',
				},
			},
		},
	);

	assert(createResult);

	await ctx.flushAll(ctx.session);

	const contact: any = await waitForContactWithMirror(createResult.slug);

	expect(contact.data).toEqual({
		mirrors: contact.data.mirrors,
		profile: {
			email: 'new@change.me',
		},
	});

	expect(contact.data.mirrors.length).toBe(1);
	expect(
		contact.data.mirrors[0].startsWith(
			'https://api.outreach.io/api/v2/prospects/',
		),
	).toBe(true);
	const prospectId = _.parseInt(_.last(contact.data.mirrors[0].split('/'))!);
	const prospect = await getProspect(prospectId);

	expect(prospect.data.attributes.emails).toEqual([]);
	expect(prospect.data.attributes.name).toBe(username);
	expect(prospect.data.attributes.nickname).toBe(username);
	expect(prospect.data.attributes.githubUsername).toBeFalsy();
	expect(prospect.data.attributes.custom1).toBe(
		`https://jel.ly.fish/${contact.id}`,
	);
});

test('should not sync emails on contacts with unknown@change.me', async () => {
	const username = `test-not-sync-emails-unknown-change-me-${randomUUID()}`;

	const createResult = await ctx.worker.insertCard(
		ctx.logContext,
		ctx.session,
		ctx.worker.typeContracts['contact@1.0.0'],
		{
			attachEvents: true,
			actor: ctx.adminUserId,
		},
		{
			slug: `contact-${username}`,
			type: 'contact',
			data: {
				profile: {
					email: 'unknown@change.me',
				},
			},
		},
	);

	assert(createResult);

	await ctx.flushAll(ctx.session);

	const contact: any = await waitForContactWithMirror(createResult.slug);

	expect(contact.data).toEqual({
		mirrors: contact.data.mirrors,
		profile: {
			email: 'unknown@change.me',
		},
	});

	expect(contact.data.mirrors.length).toBe(1);
	expect(
		contact.data.mirrors[0].startsWith(
			'https://api.outreach.io/api/v2/prospects/',
		),
	).toBe(true);
	const prospectId = _.parseInt(_.last(contact.data.mirrors[0].split('/'))!);
	const prospect = await getProspect(prospectId);

	expect(prospect.data.attributes.emails).toEqual([]);
	expect(prospect.data.attributes.name).toBe(username);
	expect(prospect.data.attributes.nickname).toBe(username);
	expect(prospect.data.attributes.githubUsername).toBeFalsy();
	expect(prospect.data.attributes.custom1).toBe(
		`https://jel.ly.fish/${contact.id}`,
	);
});

test('should sync tags', async () => {
	const username = `test-sync-tags-${randomUUID()}`;
	const email = `${username}@test.io`;
	const tags = ['foo'];

	const createResult = await ctx.worker.insertCard(
		ctx.logContext,
		ctx.session,
		ctx.worker.typeContracts['contact@1.0.0'],
		{
			attachEvents: true,
			actor: ctx.adminUserId,
		},
		{
			slug: `contact-${username}`,
			type: 'contact',
			data: {
				profile: {
					email,
				},
			},
			tags,
		},
	);

	assert(createResult);

	await ctx.flushAll(ctx.session);

	const contact: any = await waitForContactWithMirror(createResult.slug);

	expect(contact.data).toEqual({
		mirrors: contact.data.mirrors,
		profile: {
			email,
		},
	});
	expect(contact.tags).toEqual(tags);

	expect(contact.data.mirrors.length).toBe(1);
	expect(
		contact.data.mirrors[0].startsWith(
			'https://api.outreach.io/api/v2/prospects/',
		),
	).toBe(true);
	const prospectId = _.parseInt(_.last(contact.data.mirrors[0].split('/'))!);
	const prospect = await getProspect(prospectId);

	expect(prospect.data.attributes.emails).toEqual([email]);
	expect(prospect.data.attributes.name).toBe(username);
	expect(prospect.data.attributes.nickname).toBe(username);
	expect(prospect.data.attributes.tags).toEqual(tags);
	expect(prospect.data.attributes.githubUsername).toBeFalsy();
	expect(prospect.data.attributes.custom1).toBe(
		`https://jel.ly.fish/${contact.id}`,
	);

	// Update the contact with a new tag
	tags.push('bar');
	await ctx.worker.patchCard(
		ctx.logContext,
		ctx.session,
		ctx.worker.typeContracts[contact.type],
		{
			attachEvents: true,
			actor: ctx.adminUserId,
		},
		contact,
		[
			{
				op: 'add',
				path: '/tags/1',
				value: tags[1],
			},
		],
	);

	await ctx.flushAll(ctx.session);
	const updatedProspect = await getProspect(prospectId);
	expect(updatedProspect.data.attributes.tags).toEqual(tags);
});
