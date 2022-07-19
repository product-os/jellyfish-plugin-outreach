import { ActionDefinition, mirror } from '@balena/jellyfish-worker';

const handler: ActionDefinition['handler'] = async (
	session,
	context,
	card,
	request,
) => {
	return mirror('outreach', session, context, card, request);
};

export const actionIntegrationOutreachMirrorEvent: ActionDefinition = {
	handler,
	contract: {
		slug: 'action-integration-outreach-mirror-event',
		version: '1.0.0',
		type: 'action@1.0.0',
		data: {
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
			arguments: {},
		},
	},
};
