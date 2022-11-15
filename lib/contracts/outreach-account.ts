import type { ContractDefinition } from 'autumndb';

export const outreachAccount: ContractDefinition = {
	slug: 'outreach-account',
	type: 'type@1.0.0',
	name: 'Outreach Account',
	markers: [],
	data: {
		schema: {
			type: 'object',
			required: ['name'],
			properties: {
				name: {
					type: 'string',
				},
				data: {
					type: 'object',
					properties: {
						mirrors: {
							type: 'array',
							items: {
								type: 'string',
							},
						},
					},
				},
			},
		},
	},
};
