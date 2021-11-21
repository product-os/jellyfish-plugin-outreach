import type { ActionFile } from '@balena/jellyfish-plugin-base';
import type { ContractData } from '@balena/jellyfish-types/build/core';
import { actionIntegrationOutreachMirrorEvent } from './action-integration-outreach-mirror-event';

export const actions: Array<ActionFile<ContractData>> = [
	actionIntegrationOutreachMirrorEvent,
];
