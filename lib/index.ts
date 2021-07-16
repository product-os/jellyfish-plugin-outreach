/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import { JellyfishPluginBase } from '@balena/jellyfish-plugin-base';
import { actions } from './actions';
import { cards } from './cards';
import integrations from './integrations';

/**
 * The Outreach Jellyfish plugin.
 */
export class OutreachPlugin extends JellyfishPluginBase {
	constructor() {
		super({
			slug: 'jellyfish-plugin-outreach',
			name: 'Outreach Plugin',
			version: '1.0.0',
			actions,
			cards,
			integrations,
			requires: [
				{
					slug: 'action-library',
					version: '>=14.x',
				},
				{
					slug: 'jellyfish-plugin-default',
					version: '>=19.x',
				},
			],
		});
	}
}
