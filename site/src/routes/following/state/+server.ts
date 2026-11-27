import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { error, json } from '@sveltejs/kit';
import { followKindOf, signedOutState, type FollowState } from '#lib/following.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { follow, isFollowing, unfollow, unreadCount } from '#lib/server/following.ts';
import { checkThisBuildOnce, currentDirectory, isFollowableNow } from '#lib/server/following-run.ts';
import type { RequestHandler } from './$types';

// What the masthead's Follow button and account menu ask, from pages built
// ahead of time that cannot know who is signed in (src/lib/following-state.svelte.ts).
export const prerender = false;

const headers = { 'cache-control': 'no-store' };

async function stateFor(database: D1Database, subject: string, address: string | null): Promise<FollowState> {
	await checkThisBuildOnce(database);
	const followable = Boolean(address && followKindOf(address) && (await isFollowableNow(database, address)));
	return {
		signedIn: true,
		followable,
		following: followable && address ? await isFollowing(database, subject, address) : false,
		unread: await unreadCount(database, subject)
	};
}

/** GET /following/state?address=/nations/x: whether the reader follows the page, and how many notices are new. */
export const GET: RequestHandler = async ({ locals, url }) => {
	const { database } = workerEnvironment();
	if (!locals.account || !database) return json(signedOutState, { headers });
	return json(await stateFor(database, locals.account.subject, url.searchParams.get('address')), { headers });
};

/** POST { address, follow: true | false }: follows or stops following a page. */
export const POST: RequestHandler = async ({ locals, request }) => {
	const environment = workerEnvironment();
	const database = environment.database;
	if (!locals.account || !database) error(401, 'Sign in to follow pages.');
	const subject = locals.account.subject;
	const body = (await request.json().catch(() => /* expected: a body that is not JSON is refused just below with 400 */ null)) as { address?: unknown; follow?: unknown } | null;
	const address = typeof body?.address === 'string' ? body.address : '';
	if (!followKindOf(address) || typeof body?.follow !== 'boolean') error(400, 'Name a page that can be followed.');
	// The same limit as changes in the workspace, kept apart for following.
	if (environment.workspaceChangeLimit) {
		const { success } = await environment.workspaceChangeLimit.limit({ key: `follow:${subject}` });
		if (!success) error(429, 'Too many changes in a minute. Wait a minute and try again.');
	}
	if (body.follow) {
		const result = await follow(database, subject, address, await currentDirectory(database));
		if (result === 'not-followable') error(404, 'That page cannot be followed.');
		if (result === 'too-many') error(409, 'You follow as many pages as an account can. Stop following some first.');
	} else {
		await unfollow(database, subject, address);
	}
	return json(await stateFor(database, subject, address), { headers });
};
