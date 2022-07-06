import type { ContractDefinition } from 'autumndb';
import { emailSequence } from './email-sequence';
import { oauthProviderOutreach } from './oauth-provider-outreach';
import { triggeredActionIntegrationOutreachMirrorEvent } from './triggered-action-integration-outreach-mirror-event';

export const contracts: ContractDefinition[] = [
	emailSequence,
	oauthProviderOutreach,
	triggeredActionIntegrationOutreachMirrorEvent,
];
