import type { ContractDefinition } from '@balena/jellyfish-types/build/core';
import { defaultEnvironment as environment } from '@balena/jellyfish-environment';
import qs from 'qs';

const scopes = [
	'mailboxes.all',
	'prospects.all',
	'sequences.all',
	'sequenceStates.all',
	'sequenceSteps.all',
	'sequenceTemplates.all',
	'webhooks.all',
];

export const oauthProviderOutreach: ContractDefinition = {
	slug: 'oauth-provider-outreach',
	type: 'oauth-provider@1.0.0',
	name: 'Outreach oauth provider',
	data: {
		authorizeUrl: `https://api.outreach.io/oauth/authorize?${qs.stringify({
			client_id: environment.integration['balena-api'].appId,
			response_type: 'code',
			redirect_uri: `${environment.oauth.redirectBaseUrl}/oauth/outreach`,
			scope: scopes.join('+'),
		})}`,
		tokenUrl: 'https://api.outreach.io/oauth/token',
		clientId: environment.integration['balena-api'].appId,
		clientSecret: environment.integration['balena-api'].appSecret,
		integration: 'outreach',
	},
};
