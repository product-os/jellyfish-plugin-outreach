/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import type { ContractDefinition } from '@balena/jellyfish-types/build/core';

export const oauthProviderOutreach: ContractDefinition = {
	slug: 'oauth-provider-outreach',
	type: 'oauth-provider@1.0.0',
	name: 'Outreach oauth provider',
	data: {
		authorizeUrl:
			'https://api.outreach.io/oauth/authorize?client_id={{clientId}}&redirect_uri={{redirectUrl}}/oauth/outreach&response_type=code&scope={{scope}}',
		tokenUrl: 'https://api.outreach.io/oauth/token',
	},
};
