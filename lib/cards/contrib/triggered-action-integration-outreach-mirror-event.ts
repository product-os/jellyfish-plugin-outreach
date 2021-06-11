/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import type { ContractDefinition } from '@balena/jellyfish-types/build/core';

export const triggeredActionIntegrationOutreachMirrorEvent: ContractDefinition =
	{
		slug: 'triggered-action-integration-outreach-mirror-event',
		type: 'triggered-action@1.0.0',
		name: 'Triggered action for Outreach mirrors',
		markers: [],
		data: {
			schedule: 'sync',
			filter: {
				type: 'object',
				required: ['type'],
				properties: {
					type: {
						type: 'string',
						const: 'contact@1.0.0',
					},
				},
			},
			action: 'action-integration-outreach-mirror-event@1.0.0',
			target: {
				$eval: 'source.id',
			},
			arguments: {},
		},
	};
