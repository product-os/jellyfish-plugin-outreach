/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import type { ContractDefinition } from '@balena/jellyfish-types/build/core';

export const emailSequence: ContractDefinition = {
	slug: 'email-sequence',
	type: 'type@1.0.0',
	name: 'Email Sequence',
	markers: [],
	data: {
		schema: {
			type: 'object',
			required: ['name'],
			properties: {
				name: {
					type: 'string',
				},
			},
		},
	},
};
