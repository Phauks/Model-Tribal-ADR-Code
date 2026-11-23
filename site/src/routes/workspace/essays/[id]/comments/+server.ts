/**
 * Comments on an essay's draft (src/lib/server/essay-comments.ts), for
 * anyone with comment access or above. GET lists them, with who is asking
 * and whether they may mark any thread done. POST adds a comment on
 * selected words ({ body, asks, quote, version }) or a reply ({ body,
 * thread }). PATCH ?thread= { resolved } marks a thread done or reopens
 * it: its author may, and so may anyone who can edit the essay.
 */
import { error, json } from '@sveltejs/kit';
import { essayAccess } from '#lib/server/essay-workspace.ts';
import { addComment, essayComments, setThreadResolved } from '#lib/server/essay-comments.ts';
import { isCommentAsk } from '#lib/essays/comments.ts';
import { atLeast } from '#lib/permissions.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async (event) => {
	const { identifier, database, person, level } = await essayAccess(event, 'comment', { forData: true });
	return json(
		{ comments: await essayComments(database, identifier), you: person.identifier, mayResolveAny: atLeast(level, 'contribute') },
		{ headers: { 'Cache-Control': 'private, no-store' } }
	);
};

export const POST: RequestHandler = async (event) => {
	const { identifier, database, person } = await essayAccess(event, 'comment', { forData: true });
	const body = (await event.request.json().catch(() => null)) as Record<string, unknown> | null;
	if (!body || typeof body.body !== 'string') error(400, 'Write the comment first.');
	const thread = typeof body.thread === 'string' ? body.thread : null;
	const quote = body.quote as { quote?: unknown; prefix?: unknown; suffix?: unknown } | undefined;
	if (!thread && (typeof quote?.quote !== 'string' || typeof quote.prefix !== 'string' || typeof quote.suffix !== 'string')) {
		error(400, 'Select the words to comment on.');
	}
	try {
		await addComment(database, {
			essay: identifier,
			personIdentifier: person.identifier,
			body: body.body,
			thread,
			asks: Array.isArray(body.asks) ? body.asks.filter(isCommentAsk) : [],
			quote: thread ? null : { quote: quote!.quote as string, prefix: quote!.prefix as string, suffix: quote!.suffix as string },
			versionNumber: typeof body.version === 'number' ? body.version : null
		});
	} catch (problem) {
		if (problem instanceof Error && /Write|at most|Select|not on this essay/.test(problem.message)) error(400, problem.message);
		throw problem;
	}
	return json({ comments: await essayComments(database, identifier) });
};

export const PATCH: RequestHandler = async (event) => {
	const { identifier, database, person, level } = await essayAccess(event, 'comment', { forData: true });
	const body = (await event.request.json().catch(() => null)) as { resolved?: unknown } | null;
	if (typeof body?.resolved !== 'boolean') error(400, 'Say whether the thread is done.');
	const changed = await setThreadResolved(database, {
		essay: identifier,
		thread: event.url.searchParams.get('thread') ?? '',
		personIdentifier: person.identifier,
		mayResolveAny: atLeast(level, 'contribute'),
		resolved: body.resolved
	});
	if (!changed) error(403, 'Only the person who started this thread, or someone who can edit the essay, can mark it done.');
	return json({ comments: await essayComments(database, identifier) });
};
