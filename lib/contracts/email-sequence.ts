import type { ContractDefinition } from 'autumndb';

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
