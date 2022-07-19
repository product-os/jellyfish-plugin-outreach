import type { PluginDefinition } from '@balena/jellyfish-worker';
import { actions } from './actions';
import { contracts } from './contracts';
import { integrations } from './integrations';
export * from './types';

// tslint:disable-next-line: no-var-requires
const { version } = require('../package.json');

/**
 * The Outreach Jellyfish plugin.
 */
export const outreachPlugin = (): PluginDefinition => {
	return {
		slug: 'plugin-outreach',
		name: 'Outreach Plugin',
		version,
		actions,
		contracts,
		integrationMap: integrations,
	};
};
