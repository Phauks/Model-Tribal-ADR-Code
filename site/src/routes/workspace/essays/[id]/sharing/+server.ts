/**
 * Sharing an essay draft and asking for review
 * (src/lib/server/essay-review-requests.ts), for anyone with comment access
 * or above.
 *
 * GET lists who can open the essay and at what level, the review requests,
 * and what this person may do. Only the lead author changes levels (the
 * Access page's rule, src/lib/permissions.ts), so only they get everyone
 * else to add. PUT { person, level } sets one person's level on this essay
 * (lead author only). POST { reviewers, section, dueOn, message, version }
 * asks for review (contribute access or above, and only people who can
 * open the essay). PATCH ?request= { done } marks the person's own review
 * done, and { closed } closes the request (its asker, or full access).
 */
import { error, json } from '@sveltejs/kit';
import { essayAccess } from '#lib/server/essay-workspace.ts';
import { closeReviewRequest, essayPeople, essayReviewRequests, finishReview, requestReview } from '#lib/server/essay-review-requests.ts';
import { setGrant } from '#lib/server/access.ts';
import { isCalendarDate } from '#lib/essays/review-requests.ts';
import { accessLevels, atLeast, isAdministrator, type AccessLevel } from '#lib/permissions.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

const noStore = { 'Cache-Control': 'private, no-store' };

async function sharingState(database: Parameters<typeof essayPeople>[0], identifier: string, mayManage: boolean) {
	const [people, requests] = await Promise.all([essayPeople(database, identifier, { everyone: mayManage }), essayReviewRequests(database, identifier)]);
	return {
		people: people.filter((person) => atLeast(person.level, 'comment')),
		others: mayManage ? people.filter((person) => !atLeast(person.level, 'comment')).map(({ identifier: id, name, role }) => ({ identifier: id, name, role })) : [],
		requests
	};
}

export const GET: RequestHandler = async (event) => {
	const { identifier, database, person, level } = await essayAccess(event, 'comment', { forData: true });
	const mayManage = isAdministrator(person);
	return json(
		{
			...(await sharingState(database, identifier, mayManage)),
			you: person.identifier,
			mayManage,
			mayAsk: atLeast(level, 'contribute'),
			mayCloseAny: atLeast(level, 'full')
		},
		{ headers: noStore }
	);
};

export const PUT: RequestHandler = async (event) => {
	const { identifier, database, person } = await essayAccess(event, 'comment', { forData: true });
	if (!isAdministrator(person)) error(403, 'Only the lead author changes who can open an essay.');
	const body = (await event.request.json().catch(() => /* expected: a body that is not JSON is refused just below with 400 */ null)) as { person?: unknown; level?: unknown } | null;
	if (typeof body?.person !== 'string' || !(accessLevels as readonly string[]).includes(body.level as string)) error(400, 'Choose a person and a level.');
	const everyone = await essayPeople(database, identifier, { everyone: true });
	const target = everyone.find((candidate) => candidate.identifier === body.person);
	if (!target) error(400, 'That person is not in the workspace.');
	if (target.role === 'lead-author') error(400, 'The lead author always has full access.');
	await setGrant(
		database,
		{ personIdentifier: target.identifier, subjectKind: 'essay', subjectIdentifier: identifier, level: body.level as AccessLevel, expiresAt: null, note: 'Set from the essay’s Share dialog' },
		person
	);
	return json({ ...(await sharingState(database, identifier, true)) }, { headers: noStore });
};

export const POST: RequestHandler = async (event) => {
	const { identifier, database, person, level } = await essayAccess(event, 'comment', { forData: true });
	if (!atLeast(level, 'contribute')) error(403, 'Asking for review needs contribute access to the essay.');
	const body = (await event.request.json().catch(() => /* expected: a body that is not JSON is refused just below with 400 */ null)) as Record<string, unknown> | null;
	if (!body || !Array.isArray(body.reviewers) || !body.reviewers.every((reviewer) => typeof reviewer === 'string')) error(400, 'Choose who should review it.');
	const section = body.section as { slug?: unknown; title?: unknown } | null | undefined;
	if (section && (typeof section.slug !== 'string' || typeof section.title !== 'string' || !section.slug || !section.title.trim())) error(400, 'Choose what to review.');
	if (body.dueOn !== null && body.dueOn !== undefined && body.dueOn !== '' && !isCalendarDate(body.dueOn)) error(400, 'Give the date as a calendar date.');
	const reviewers = body.reviewers as string[];
	const canOpen = new Set((await essayPeople(database, identifier)).map((candidate) => candidate.identifier));
	if (reviewers.some((reviewer) => !canOpen.has(reviewer))) error(400, 'Everyone asked to review must be able to open the essay. The lead author can add them.');
	try {
		await requestReview(database, {
			essay: identifier,
			requestedBy: person.identifier,
			reviewers,
			section: section ? { slug: section.slug as string, title: (section.title as string).trim() } : null,
			dueOn: isCalendarDate(body.dueOn) ? body.dueOn : null,
			message: typeof body.message === 'string' ? body.message : null,
			versionNumber: typeof body.version === 'number' ? body.version : null
		});
	} catch (problem) {
		if (problem instanceof Error && /Choose|at most/.test(problem.message)) error(400, problem.message);
		throw problem;
	}
	return json({ requests: await essayReviewRequests(database, identifier) }, { headers: noStore });
};

export const PATCH: RequestHandler = async (event) => {
	const { identifier, database, person, level } = await essayAccess(event, 'comment', { forData: true });
	const body = (await event.request.json().catch(() => /* expected: a body that is not JSON is refused just below with 400 */ null)) as { done?: unknown; closed?: unknown } | null;
	const request = event.url.searchParams.get('request') ?? '';
	if (body?.done === true) {
		if (!(await finishReview(database, { essay: identifier, request, person: person.identifier }))) error(403, 'You were not asked to review this.');
	} else if (body?.closed === true) {
		if (!(await closeReviewRequest(database, { essay: identifier, request, person: person.identifier, mayCloseAny: atLeast(level, 'full') }))) {
			error(403, 'Only the person who asked, or someone with full access, can close this request.');
		}
	} else {
		error(400, 'Say whether your review is done or the request is closed.');
	}
	return json({ requests: await essayReviewRequests(database, identifier) }, { headers: noStore });
};
