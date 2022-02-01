import { defaultEnvironment } from '@balena/jellyfish-environment';
import { testUtils as workerTestUtils } from '@balena/jellyfish-worker';
import { strict as assert } from 'assert';

export const OAUTH_DETAILS = {
	access_token: 'MTQ0NjJkZmQ5OTM2NDE1ZTZjNGZmZjI3',
	token_type: 'bearer',
	expires_in: 3600,
	refresh_token: 'IwOGYzYTlmM2YxOTQ5MGE3YmNmMDFkNTVk',
	scope: 'create',
};

export async function patchUser(
	ctx: workerTestUtils.TestContext,
): Promise<void> {
	const userCard = await ctx.kernel.getCardBySlug(
		ctx.logContext,
		ctx.session,
		`user-${defaultEnvironment.integration.default.user}@latest`,
	);
	assert(userCard);

	await ctx.kernel.patchContractBySlug(
		ctx.logContext,
		ctx.session,
		`${userCard.slug}@${userCard.version}`,
		[
			{
				op: 'add',
				path: '/data/oauth',
				value: {},
			},
			{
				op: 'add',
				path: '/data/oauth/outreach',
				value: OAUTH_DETAILS,
			},
		],
	);
}
