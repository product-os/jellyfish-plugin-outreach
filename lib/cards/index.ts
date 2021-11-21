import { oauthClientOutreach } from './balena/oauth-client-outreach';
import { oauthProviderOutreach } from './balena/oauth-provider-outreach';
import { emailSequence } from './contrib/email-sequence';
import { triggeredActionIntegrationOutreachMirrorEvent } from './contrib/triggered-action-integration-outreach-mirror-event';

export const cards = [
	emailSequence,
	oauthClientOutreach,
	oauthProviderOutreach,
	triggeredActionIntegrationOutreachMirrorEvent,
];
