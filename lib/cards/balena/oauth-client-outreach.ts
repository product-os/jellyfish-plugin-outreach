/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import { defaultEnvironment } from '@balena/jellyfish-environment';
import type { ContractDefinition } from '@balena/jellyfish-types/build/core';

const scopes = [
	'prospects.all',
	'sequences.all',
	'sequenceStates.all',
	'sequenceSteps.all',
	'sequenceTemplates.all',
	'mailboxes.all',
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
