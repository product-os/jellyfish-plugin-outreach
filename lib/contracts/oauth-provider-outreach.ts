import { defaultEnvironment as environment } from '@balena/jellyfish-environment';
import type { ContractDefinition } from 'autumndb';
import qs from 'qs';

const scopes = [
	'accounts.all',
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
			client_id: environment.integration.outreach.appId,
			response_type: 'code',
			redirect_uri: `${environment.oauth.redirectBaseUrl}/oauth/outreach`,
			scope: scopes.join('+'),
		})}`,
		tokenUrl: 'https://api.outreach.io/oauth/token',
		clientId: environment.integration.outreach.appId,
		clientSecret: environment.integration.outreach.appSecret,
		integration: 'outreach',
	},
};
