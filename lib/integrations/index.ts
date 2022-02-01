import type { IntegrationDefinition, Map } from '@balena/jellyfish-worker';
import { outreachIntegrationDefinition } from './outreach';

export const integrations: Map<IntegrationDefinition> = {
	outreach: outreachIntegrationDefinition,
};
