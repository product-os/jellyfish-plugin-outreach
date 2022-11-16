import type { ContractDefinition } from 'autumndb';
import { emailSequence } from './email-sequence';
import { oauthProviderOutreach } from './oauth-provider-outreach';
import { outreachAccount } from './outreach-account';
import { triggeredActionIntegrationOutreachMirrorEvent } from './triggered-action-integration-outreach-mirror-event';

export const contracts: ContractDefinition[] = [
	emailSequence,
	oauthProviderOutreach,
	outreachAccount,
	triggeredActionIntegrationOutreachMirrorEvent,
];
