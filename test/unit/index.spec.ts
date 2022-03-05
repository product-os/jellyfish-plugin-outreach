import { defaultPlugin } from '@balena/jellyfish-plugin-default';
import { oauth, PluginManager } from '@balena/jellyfish-worker';
import { strict as assert } from 'assert';
import _ from 'lodash';
import nock from 'nock';
import querystring from 'querystring';
import { outreachPlugin } from '../../lib';
import { outreachIntegrationDefinition } from '../../lib/integrations/outreach';

const pluginManager = new PluginManager([defaultPlugin(), outreachPlugin()]);

test('Expected contracts are loaded', () => {
	const contracts = pluginManager.getCards();
	expect(
		contracts['triggered-action-integration-outreach-mirror-event'].name,
	).toEqual('Triggered action for Outreach mirrors');
	expect(contracts['oauth-client-outreach'].name).toEqual(
		'Outreach oauth client',
	);
	expect(contracts['oauth-provider-outreach'].name).toEqual(
		'Outreach oauth provider',
	);
});

test('Expected integrations are loaded', () => {
	const integrations = pluginManager.getSyncIntegrations();
	expect(Object.keys(integrations).includes('outreach')).toBeTruthy();
});

test('Expected actions are loaded', () => {
	const actions = pluginManager.getActions();
	expect(
		Object.keys(actions).includes('action-integration-outreach-mirror-event'),
	);
});

// TS-TODO: Use sync.getAssociateUrl() once we can create a Sync instance in TS
test('oauth.getAuthorizeUrl() should be able to generate an Outreach URL', () => {
	assert(outreachIntegrationDefinition.OAUTH_BASE_URL);
	assert(outreachIntegrationDefinition.OAUTH_SCOPES);
	const result = oauth.getAuthorizeUrl(
		outreachIntegrationDefinition.OAUTH_BASE_URL,
		outreachIntegrationDefinition.OAUTH_SCOPES,
		'user-jellyfish',
		{
			appId: 'dJyXQHeh8PLKUr4gdsoUYQ8vFvqJ1D20lnFMxBLg',
			redirectUri: 'https://jel.ly.fish/oauth/outreach',
		},
	);

	const qs = [
		'response_type=code',
		'client_id=dJyXQHeh8PLKUr4gdsoUYQ8vFvqJ1D20lnFMxBLg',
		'redirect_uri=https%3A%2F%2Fjel.ly.fish%2Foauth%2Foutreach',
		`scope=${outreachIntegrationDefinition.OAUTH_SCOPES.join('+')}`,
		'state=user-jellyfish',
	].join('&');

	expect(result).toEqual(`https://api.outreach.io/oauth/authorize?${qs}`);
});

// TS-TODO: Use sync.authorize() once we can create a Sync instance in TS
test('oauth.getAccessToken() should throw given a code mismatch', async () => {
	nock.cleanAll();
	nock.disableNetConnect();

	nock('https://api.outreach.io')
		.post('/oauth/token')
		.reply((_uri: any, request: any, callback: any) => {
			const body = querystring.decode(request);

			if (
				_.isEqual(body, {
					grant_type: 'authorization_code',
					client_id: 'dJyXQHeh8PLKUr4gdsoUYQ8vFvqJ1D20lnFMxBLg',
					client_secret: 'NlfY38rTt5xxa+Ehi2kV/2rA85C98iDdMF7xD9xr',
					redirect_uri: 'https://jel.ly.fish/oauth/outreach',
					code: '12345',
				})
			) {
				return callback(null, [
					200,
					{
						access_token: 'KSTWMqidua67hjM2NDE1ZTZjNGZmZjI3',
						token_type: 'bearer',
						expires_in: 3600,
						refresh_token: 'POolsdYTlmM2YxOTQ5MGE3YmNmMDFkNTVk',
						scope: 'create',
					},
				]);
			}

			return callback(null, [
				400,
				{
					error: 'invalid_request',
					error_description: 'Something went wrong',
				},
			]);
		});

	await expect(
		oauth.getAccessToken(
			outreachIntegrationDefinition.OAUTH_BASE_URL,
			'invalidcode',
			{
				appId: 'dJyXQHeh8PLKUr4gdsoUYQ8vFvqJ1D20lnFMxBLg',
				appSecret: 'NlfY38rTt5xxa+Ehi2kV/2rA85C98iDdMF7xD9xr',
				redirectUri: 'https://jel.ly.fish/oauth/outreach',
			},
		),
	).rejects.toThrowError();

	nock.cleanAll();
});
