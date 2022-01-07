import { ActionLibrary } from '@balena/jellyfish-action-library';
import { defaultEnvironment } from '@balena/jellyfish-environment';
import { DefaultPlugin } from '@balena/jellyfish-plugin-default';
import {
	syncIntegrationScenario,
	TestContext,
} from '@balena/jellyfish-test-harness';
import { strict as assert } from 'assert';
import _ from 'lodash';
import { OutreachPlugin } from '../../lib';
import webhooks from './webhooks/outreach';

const TOKEN = defaultEnvironment.integration.outreach;

const OAUTH_DETAILS = {
	access_token: 'MTQ0NjJkZmQ5OTM2NDE1ZTZjNGZmZjI3',
	token_type: 'bearer',
	expires_in: 3600,
	refresh_token: 'IwOGYzYTlmM2YxOTQ5MGE3YmNmMDFkNTVk',
	scope: 'create',
};

async function patchUser(context: TestContext): Promise<void> {
	const userCard = await context.kernel.getCardBySlug(
		context.logContext,
		context.kernel.sessions!.admin,
		`user-${defaultEnvironment.integration.default.user}@latest`,
	);
	assert(userCard);

	await context.kernel.patchCardBySlug(
		context.logContext,
		context.kernel.sessions!.admin,
		`${userCard.slug}@${userCard.version}`,
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
}

// TS-TODO: Remove unnecessary integration option below once test-harness is updated
syncIntegrationScenario.run(
	{
		test,
		before: beforeAll,
		beforeEach,
		after: afterAll,
		afterEach,
	},
	{
		basePath: __dirname,
		plugins: [ActionLibrary, DefaultPlugin, OutreachPlugin],
		cards: ['email-sequence'],
		before: patchUser,
		scenarios: webhooks,
		baseUrl: 'https://api.outreach.io',
		stubRegex: /.*/,
		source: 'outreach',
		options: {
			token: TOKEN,
		},
		isAuthorized: (_self: any, request: any) => {
			return (
				request.headers.authorization === `Bearer ${OAUTH_DETAILS.access_token}`
			);
		},
	},
);
