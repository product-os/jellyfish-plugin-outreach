import { defaultPlugin } from '@balena/jellyfish-plugin-default';
import { productOsPlugin } from '@balena/jellyfish-plugin-product-os';
import { testUtils as workerTestUtils } from '@balena/jellyfish-worker';
import _ from 'lodash';
import path from 'path';
import { outreachPlugin } from '../../lib';
import { OAUTH_DETAILS, patchUser } from './helpers';
import webhooks from './webhooks';

// const TOKEN = defaultEnvironment.integration.outreach;
let ctx: workerTestUtils.TestContext;

beforeAll(async () => {
	ctx = await workerTestUtils.newContext({
		plugins: [productOsPlugin(), defaultPlugin(), outreachPlugin()],
	});
	await patchUser(ctx);
	await workerTestUtils.translateBeforeAll(ctx);
});

afterEach(async () => {
	await workerTestUtils.translateAfterEach(ctx);
});

afterAll(() => {
	return workerTestUtils.destroyContext(ctx);
});

describe('translate logic works as expected', () => {
	for (const testCaseName of Object.keys(webhooks)) {
		const testCase = webhooks[testCaseName];
		const expected = {
			head: testCase.expected.head,
			tail: _.sortBy(testCase.expected.tail, workerTestUtils.tailSort),
		};
		for (const variation of workerTestUtils.getVariations(testCase.steps, {
			permutations: true,
		})) {
			test(`(${variation.name}) ${testCaseName}`, async () => {
				await workerTestUtils.webhookScenario(
					ctx,
					{
						steps: variation.combination,
						prepareEvent: async (event: any): Promise<any> => {
							return event;
						},
						offset:
							_.findIndex(testCase.steps, _.first(variation.combination)) + 1,
						headIndex: testCase.headIndex || 0,
						original: testCase.steps,

						// If we miss events such as when a head card was archived,
						// we usually can't know the date this happened, but we can
						// still apply it with a date approximation. In those cases,
						// its helpful to omit the update events from the tail checks.
						ignoreUpdateEvents: !_.isEqual(
							variation.combination,
							testCase.steps,
						),

						expected: _.cloneDeep(expected),
						name: testCaseName,
						variant: variation.name,
					},
					{
						source: 'outreach',
						baseUrl: 'https://api.outreach.io',
						uriPath: /.*/,
						basePath: path.join(__dirname, 'webhooks'),
						isAuthorized: (request: any) => {
							return (
								request.headers.authorization ===
								`Bearer ${OAUTH_DETAILS.access_token}`
							);
						},
					},
				);
			});
		}
	}
});
