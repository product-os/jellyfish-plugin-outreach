import { strict as assert } from 'assert';
import { testUtils as workerTestUtils } from '@balena/jellyfish-worker';
import _ from 'lodash';
import nock from 'nock';
import { v4 as uuidv4 } from 'uuid';
import { outreachPlugin } from '../../../lib';
import { patchUser } from '../helpers';

let ctx: workerTestUtils.TestContext;
const prospectId = uuidv4().split('-')[0];
const apiPath = '/api/v2/prospects';

beforeAll(async () => {
	ctx = await workerTestUtils.newContext({
		plugins: [outreachPlugin()],
	});
	await patchUser(ctx);

	nock.disableNetConnect();
	assert('https://api.outreach.io');
	nock('https://api.outreach.io' as string)
		.persist()
		.post(apiPath)
		.reply(() => {
			return [
				201,
				{
					data: {
						links: {
							self: `https://api.outreach.io${apiPath}/${prospectId}`,
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
			`https://api.outreach.io${apiPath}/${prospectId}`,
		]);
	});
});
