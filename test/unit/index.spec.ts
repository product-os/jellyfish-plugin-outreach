import { defaultPlugin } from '@balena/jellyfish-plugin-default';
import { PluginManager } from '@balena/jellyfish-worker';
import _ from 'lodash';
import { outreachPlugin } from '../../lib';

const pluginManager = new PluginManager([defaultPlugin(), outreachPlugin()]);

test('Expected contracts are loaded', () => {
	const contracts = pluginManager.getCards();
	expect(
		contracts['triggered-action-integration-outreach-mirror-event'].name,
	).toEqual('Triggered action for Outreach mirrors');
	expect(contracts['oauth-provider-outreach'].name).toEqual(
		'Outreach oauth provider',
	);
});

test('Expected integrations are loaded', () => {
	const integrations = pluginManager.getSyncIntegrations();
	expect(Object.keys(integrations).includes('outreach')).toBeTruthy();
});

test('Expected actions are loaded', () => {
	const actions = pluginManager.getActions();
	expect(
		Object.keys(actions).includes('action-integration-outreach-mirror-event'),
	);
});
