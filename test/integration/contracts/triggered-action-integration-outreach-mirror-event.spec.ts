import { defaultPlugin } from '@balena/jellyfish-plugin-default';
import { productOsPlugin } from '@balena/jellyfish-plugin-product-os';
import { testUtils as workerTestUtils } from '@balena/jellyfish-worker';
import { strict as assert } from 'assert';
import _ from 'lodash';
import nock from 'nock';
import { v4 as uuidv4 } from 'uuid';
import { patchUser } from '../helpers';
import { outreachPlugin } from '../../../lib';
import { outreachIntegrationDefinition } from '../../../lib/integrations/outreach';

let ctx: workerTestUtils.TestContext;
const prospectId = uuidv4().split('-')[0];
const apiPath = '/api/v2/prospects';

beforeAll(async () => {
	ctx = await workerTestUtils.newContext({
		plugins: [productOsPlugin(), defaultPlugin(), outreachPlugin()],
	});
	await patchUser(ctx);

	nock.disableNetConnect();
	assert(outreachIntegrationDefinition.OAUTH_BASE_URL);
	nock(outreachIntegrationDefinition.OAUTH_BASE_URL as string)
		.persist()
		.post(apiPath)
		.reply(() => {
			return [
				201,
				{
					data: {
						links: {
							self: `${outreachIntegrationDefinition.OAUTH_BASE_URL}${apiPath}/${prospectId}`,
						},
					},
				},
			];
		})
		.patch(`${apiPath}/${prospectId}`)
		.reply(() => {
			return [
				200,
				{
					data: {
						type: 'prospect',
						id: prospectId,
					},
				},
			];
		});
});

afterAll(async () => {
	nock.cleanAll();
	return workerTestUtils.destroyContext(ctx);
});

describe('triggered-action-integration-outreach-mirror-event', () => {
	test('should sync contacts with outreach', async () => {
		// Create a contact and expect the integration to sync with Outreach and set data.mirrors
		const contact = await ctx.createContract(
			ctx.adminUserId,
			ctx.kernel.adminSession()!,
			'contact@1.0.0',
			'test-contact',
			{},
		);
		const updated = await ctx.waitForMatch({
			type: 'object',
			required: ['id', 'type', 'data'],
			properties: {
				id: {
					type: 'string',
					const: contact.id,
				},
				type: {
					type: 'string',
					const: 'contact@1.0.0',
				},
				data: {
					type: 'object',
					required: ['mirrors'],
					properties: {
						mirrors: {
							type: 'array',
							minItems: 1,
						},
					},
				},
			},
		});

		assert(updated.data.mirrors);
		expect(updated.data.mirrors).toEqual([
			`${outreachIntegrationDefinition.OAUTH_BASE_URL}${apiPath}/${prospectId}`,
		]);
	});
});
