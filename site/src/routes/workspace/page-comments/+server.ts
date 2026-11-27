/**
 * Comments on the site's other pages (src/lib/server/page-comments.ts), for
 * people with comment access or above; the page is named by ?page=, its
 * address such as "laws/indian-removal-act-1830".
 *
 * GET answers the person's level, and for comment access or above the
 * comments, who is asking and whether they may mark any thread done; with
 * &people, everyone who can see the page's comments, for @ mention and
 * Assign. Anyone else gets only { level: 'no-access' }, so a reader's page
 * asks quietly. POST adds a comment on selected words ({ body, asks, quote,
 * title, mentions, assign }) or a reply ({ body, thread, mentions }). PATCH
 * &thread= { resolved } marks a thread done or reopens it, and { assign }
 * assigns it to "person:<identifier>", "helper:claude" or "helper:nemesis",
 * or to no one with null. The thread's author may do either, and so may
 * anyone with contribute access or above.
 */
import { error, json } from '@sveltejs/kit';
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { isCommentAsk } from '#lib/essays/comments.ts';
import { atLeast } from '#lib/permissions.ts';
import { readAssignTo, type AssignTo } from '#lib/server/essay-comments.ts';
import {
	addPageComment,
	assignPageThread,
	pageCommentLevel,
	pageComments,
	pagePath,
	pagePeople,
	setPageThreadResolved
} from '#lib/server/page-comments.ts';
import { refuse, requirePersonForData, storage } from '#lib/server/workspace.ts';
import type { RequestEvent, RequestHandler } from './$types';

export const prerender = false;

const noStore = { 'Cache-Control': 'private, no-store' };

async function pageAccess(event: RequestEvent, { quiet = false } = {}) {
	const person = requirePersonForData(event);
	const path = pagePath(event.url.searchParams.get('page') ?? '');
	if (path === null) error(404, 'This page takes no comments.');
	const { database } = storage(event);
	const level = await pageCommentLevel(database, person, path);
	if (!quiet && !atLeast(level, 'comment')) refuse(event, `page comments on ${path}`, 'You cannot comment on this page.');
	return { person, path, database, level };
}

/** Who to assign to, kept only when it is someone who can see the page's comments or an AI helper; undefined when there is none or it is refused. */
async function allowedAssignee(database: D1Database, path: string, value: unknown): Promise<AssignTo | undefined> {
	const to = readAssignTo(value);
	if (to && 'person' in to && !(await pagePeople(database, path)).some((candidate) => candidate.identifier === to.person)) return undefined;
	return to;
}

export const GET: RequestHandler = async (event) => {
	const { person, path, database, level } = await pageAccess(event, { quiet: true });
	if (!atLeast(level, 'comment')) return json({ level: 'no-access' }, { headers: noStore });
	if (event.url.searchParams.has('people')) return json({ people: await pagePeople(database, path) }, { headers: noStore });
	return json(
		{ level, comments: await pageComments(database, path), you: person.identifier, mayResolveAny: atLeast(level, 'contribute') },
		{ headers: noStore }
	);
};

export const POST: RequestHandler = async (event) => {
	const { person, path, database } = await pageAccess(event);
	const body = (await event.request.json().catch(() => /* expected: a body that is not JSON is refused just below with 400 */ null)) as Record<string, unknown> | null;
	if (!body || typeof body.body !== 'string') error(400, 'Write the comment first.');
	const thread = typeof body.thread === 'string' ? body.thread : null;
	const quote = body.quote as { quote?: unknown; prefix?: unknown; suffix?: unknown } | undefined;
	if (!thread && (typeof quote?.quote !== 'string' || typeof quote.prefix !== 'string' || typeof quote.suffix !== 'string')) {
		error(400, 'Select the words to comment on.');
	}
	const asked = Array.isArray(body.mentions) ? body.mentions.filter((each): each is string => typeof each === 'string') : [];
	const maySee = asked.length ? new Set((await pagePeople(database, path)).map((candidate) => candidate.identifier)) : new Set<string>();
	const assign = thread || body.assign === undefined ? undefined : await allowedAssignee(database, path, body.assign);
	try {
		const added = await addPageComment(database, {
			path,
			title: typeof body.title === 'string' ? body.title : null,
			personIdentifier: person.identifier,
			body: body.body,
			thread,
			asks: Array.isArray(body.asks) ? body.asks.filter(isCommentAsk) : [],
			quote: thread ? null : { quote: quote!.quote as string, prefix: quote!.prefix as string, suffix: quote!.suffix as string },
			mentions: asked.filter((each) => maySee.has(each))
		});
		if (assign) await assignPageThread(database, { path, thread: added, personIdentifier: person.identifier, mayAssignAny: true, to: assign });
	} catch (problem) {
		if (problem instanceof Error && /Write|at most|Select|not on this page/.test(problem.message)) error(400, problem.message);
		throw problem;
	}
	return json({ comments: await pageComments(database, path) });
};

export const PATCH: RequestHandler = async (event) => {
	const { person, path, database, level } = await pageAccess(event);
	const body = (await event.request.json().catch(() => /* expected: a body that is not JSON is refused just below with 400 */ null)) as { resolved?: unknown; assign?: unknown } | null;
	const thread = event.url.searchParams.get('thread') ?? '';
	if (body && 'assign' in body) {
		const to = await allowedAssignee(database, path, body.assign);
		if (to === undefined) error(400, 'Choose someone who can see the comments on this page, or Claude or Nemesis.');
		const assigned = await assignPageThread(database, { path, thread, personIdentifier: person.identifier, mayAssignAny: atLeast(level, 'contribute'), to });
		if (!assigned) error(403, 'Only the person who started this thread, or someone who can edit the page, can assign it.');
		return json({ comments: await pageComments(database, path) });
	}
	if (typeof body?.resolved !== 'boolean') error(400, 'Say whether the thread is done.');
	const changed = await setPageThreadResolved(database, {
		path,
		thread,
		personIdentifier: person.identifier,
		mayResolveAny: atLeast(level, 'contribute'),
		resolved: body.resolved
	});
	if (!changed) error(403, 'Only the person who started this thread, or someone who can edit the page, can mark it done.');
	return json({ comments: await pageComments(database, path) });
};
