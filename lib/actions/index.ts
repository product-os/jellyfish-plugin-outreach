import type { ActionDefinition } from '@balena/jellyfish-worker';
import { actionIntegrationOutreachMirrorEvent } from './action-integration-outreach-mirror-event';

export const actions: ActionDefinition[] = [
	actionIntegrationOutreachMirrorEvent,
];
