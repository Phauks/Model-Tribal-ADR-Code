/**
 * Comments on an essay's draft (src/lib/server/essay-comments.ts), for
 * anyone with comment access or above. GET lists them, with who is asking
 * and whether they may mark any thread done. POST adds a comment on
 * selected words ({ body, asks, quote, version, mentions }) or a reply
 * ({ body, thread, mentions }); `mentions` are the people chosen with
 * "@ mention", and only those who can open the essay are kept. A new
 * thread may also carry `assign`. PATCH ?thread= { resolved } marks a
 * thread done or reopens it, and PATCH ?thread= { assign } assigns it to
 * "person:<identifier>" (someone who can open the essay), "helper:claude"
 * or "helper:nemesis", or to no one with null. The thread's author may do
 * either, and so may anyone who can edit the essay.
 */
import { error, json } from '@sveltejs/kit';
import { essayAccess } from '#lib/server/essay-workspace.ts';
import { addComment, assignThread, essayComments, readAssignTo, setThreadResolved, type AssignTo } from '#lib/server/essay-comments.ts';
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { essayPeople } from '#lib/server/essay-review-requests.ts';
import { isCommentAsk } from '#lib/essays/comments.ts';
import { atLeast } from '#lib/permissions.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

/** Who to assign to, kept only when it is someone who can open the essay or an AI helper; undefined when there is none or it is refused. */
async function allowedAssignee(database: D1Database, essay: string, value: unknown): Promise<AssignTo | undefined> {
	const to = readAssignTo(value);
	if (to && 'person' in to && !(await essayPeople(database, essay)).some((candidate) => candidate.identifier === to.person)) return undefined;
	return to;
}

export const GET: RequestHandler = async (event) => {
	const { identifier, database, person, level } = await essayAccess(event, 'comment', { forData: true });
	return json(
		{ comments: await essayComments(database, identifier), you: person.identifier, mayResolveAny: atLeast(level, 'contribute') },
		{ headers: { 'Cache-Control': 'private, no-store' } }
	);
};

export const POST: RequestHandler = async (event) => {
	const { identifier, database, person } = await essayAccess(event, 'comment', { forData: true });
	const body = (await event.request.json().catch(() => /* expected: a body that is not JSON is refused just below with 400 */ null)) as Record<string, unknown> | null;
	if (!body || typeof body.body !== 'string') error(400, 'Write the comment first.');
	const thread = typeof body.thread === 'string' ? body.thread : null;
	const quote = body.quote as { quote?: unknown; prefix?: unknown; suffix?: unknown } | undefined;
	if (!thread && (typeof quote?.quote !== 'string' || typeof quote.prefix !== 'string' || typeof quote.suffix !== 'string')) {
		error(400, 'Select the words to comment on.');
	}
	const asked = Array.isArray(body.mentions) ? body.mentions.filter((person): person is string => typeof person === 'string') : [];
	const mayOpen = asked.length ? new Set((await essayPeople(database, identifier)).map((candidate) => candidate.identifier)) : new Set<string>();
	const assign = thread || body.assign === undefined ? undefined : await allowedAssignee(database, identifier, body.assign);
	try {
		const added = await addComment(database, {
			essay: identifier,
			personIdentifier: person.identifier,
			body: body.body,
			thread,
			asks: Array.isArray(body.asks) ? body.asks.filter(isCommentAsk) : [],
			quote: thread ? null : { quote: quote!.quote as string, prefix: quote!.prefix as string, suffix: quote!.suffix as string },
			versionNumber: typeof body.version === 'number' ? body.version : null,
			mentions: asked.filter((person) => mayOpen.has(person))
		});
		if (assign) await assignThread(database, { essay: identifier, thread: added, personIdentifier: person.identifier, mayAssignAny: true, to: assign });
	} catch (problem) {
		if (problem instanceof Error && /Write|at most|Select|not on this essay/.test(problem.message)) error(400, problem.message);
		throw problem;
	}
	return json({ comments: await essayComments(database, identifier) });
};

export const PATCH: RequestHandler = async (event) => {
	const { identifier, database, person, level } = await essayAccess(event, 'comment', { forData: true });
	const body = (await event.request.json().catch(() => /* expected: a body that is not JSON is refused just below with 400 */ null)) as { resolved?: unknown; assign?: unknown } | null;
	const thread = event.url.searchParams.get('thread') ?? '';
	if (body && 'assign' in body) {
		const to = await allowedAssignee(database, identifier, body.assign);
		if (to === undefined) error(400, 'Choose someone who can open this essay, or Claude or Nemesis.');
		const assigned = await assignThread(database, { essay: identifier, thread, personIdentifier: person.identifier, mayAssignAny: atLeast(level, 'contribute'), to });
		if (!assigned) error(403, 'Only the person who started this thread, or someone who can edit the essay, can assign it.');
		return json({ comments: await essayComments(database, identifier) });
	}
	if (typeof body?.resolved !== 'boolean') error(400, 'Say whether the thread is done.');
	const changed = await setThreadResolved(database, {
		essay: identifier,
		thread,
		personIdentifier: person.identifier,
		mayResolveAny: atLeast(level, 'contribute'),
		resolved: body.resolved
	});
	if (!changed) error(403, 'Only the person who started this thread, or someone who can edit the essay, can mark it done.');
	return json({ comments: await essayComments(database, identifier) });
};
