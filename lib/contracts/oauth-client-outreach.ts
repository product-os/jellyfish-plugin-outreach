import { defaultEnvironment } from '@balena/jellyfish-environment';
import type { ContractDefinition } from '@balena/jellyfish-types/build/core';

const scopes = [
	'mailboxes.all',
	'prospects.all',
	'sequences.all',
	'sequenceStates.all',
	'sequenceSteps.all',
	'sequenceTemplates.all',
	'webhooks.all',
];

export const oauthClientOutreach: ContractDefinition = {
	slug: 'oauth-client-outreach',
	type: 'oauth-client@1.0.0',
	name: 'Outreach oauth client',
	data: {
		clientId: defaultEnvironment.integration.outreach.appId,
		clientSecret: defaultEnvironment.integration.outreach.appSecret,
		scope: scopes.join('+'),
		redirectUrl: `${defaultEnvironment.oauth.redirectBaseUrl}/oauth/outreach`,
	},
};
