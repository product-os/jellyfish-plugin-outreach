/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import { cardMixins } from '@balena/jellyfish-core';
import {
	getAccessToken,
	getAuthorizeUrl,
	OAuthUnsuccessfulResponse,
} from '@balena/jellyfish-sync/build/oauth';
import _ from 'lodash';
import nock from 'nock';
import querystring from 'querystring';
import { OutreachPlugin } from '../../lib';

// tslint:disable-next-line: no-var-requires
const OutreachIntegration = require('../../lib/integrations/outreach');

const context = {
	id: 'jellyfish-plugin-outreach-test',
};

const plugin = new OutreachPlugin();

test('Expected cards are loaded', () => {
	const cards = plugin.getCards(context, cardMixins);

	// Sanity check
	expect(
		cards['triggered-action-integration-outreach-mirror-event'].name,
	).toEqual('Triggered action for Outreach mirrors');
	expect(cards['oauth-client-outreach'].name).toEqual('Outreach oauth client');
	expect(cards['oauth-provider-outreach'].name).toEqual(
		'Outreach oauth provider',
	);
});

test('Expected integrations are loaded', () => {
	const integrations = plugin.getSyncIntegrations(context);

	// Sanity check
	expect(integrations.outreach.slug).toEqual('outreach');
});

test('Expected actions are loaded', () => {
	const actions = plugin.getActions(context);

	// Sanity check
	expect(
		Object.keys(actions).includes('action-integration-outreach-mirror-event'),
	);
});

// TS-TODO: Use sync.getAssociateUrl() once we can create a Sync instance in TS
test('getAuthorizeUrl() should be able to generate an Outreach URL', () => {
	const result = getAuthorizeUrl(
		OutreachIntegration.OAUTH_BASE_URL,
		OutreachIntegration.OAUTH_SCOPES,
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
		`scope=${OutreachIntegration.OAUTH_SCOPES.join('+')}`,
		'state=user-jellyfish',
	].join('&');

	expect(result).toEqual(`https://api.outreach.io/oauth/authorize?${qs}`);
});

// TS-TODO: Use sync.authorize() once we can create a Sync instance in TS
test('getAccessToken() should throw given a code mismatch', async () => {
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

	expect.hasAssertions();

	try {
		await getAccessToken(OutreachIntegration.OAUTH_BASE_URL, 'invalidcode', {
			appId: 'dJyXQHeh8PLKUr4gdsoUYQ8vFvqJ1D20lnFMxBLg',
			appSecret: 'NlfY38rTt5xxa+Ehi2kV/2rA85C98iDdMF7xD9xr',
			redirectUri: 'https://jel.ly.fish/oauth/outreach',
		});
	} catch (error) {
		expect(error instanceof OAuthUnsuccessfulResponse).toBe(true);
	}

	nock.cleanAll();
});
