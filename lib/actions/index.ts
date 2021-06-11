/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import type { ActionFile } from '@balena/jellyfish-plugin-base';
import type { ContractData } from '@balena/jellyfish-types/build/core';
import { actionIntegrationOutreachMirrorEvent } from './action-integration-outreach-mirror-event';

export const actions: Array<ActionFile<ContractData>> = [
	actionIntegrationOutreachMirrorEvent,
];
