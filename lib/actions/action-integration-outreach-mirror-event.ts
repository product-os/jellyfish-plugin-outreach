import { mirror } from '@balena/jellyfish-action-library/build/actions/mirror';
import type { ActionFile } from '@balena/jellyfish-plugin-base';

const handler: ActionFile['handler'] = async (
	session,
	context,
	card,
	request,
) => {
	return mirror('outreach', session, context, card, request);
};

export const actionIntegrationOutreachMirrorEvent: ActionFile = {
	handler,
	card: {
		slug: 'action-integration-outreach-mirror-event',
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
