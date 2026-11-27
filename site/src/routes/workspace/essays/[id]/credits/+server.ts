/**
 * Credits under each section of an essay (src/lib/essays/credits.ts;
 * src/lib/server/essay-credits.ts). GET answers, for comment access or
 * above, what the edit history says about each section of the newest saved
 * version, the credits added by hand, and the people who can be added
 * (anyone on the project, since someone may have researched a section
 * without having the essay open).
 * POST {slug, title, person, role, action} adds a credit by hand or takes
 * one away, and needs full access.
 */
import { error, json } from '@sveltejs/kit';
import { essayAccess } from '#lib/server/essay-workspace.ts';
import { changeHandCredit, handCredits, sectionCredits } from '#lib/server/essay-credits.ts';
import { essayPeople } from '#lib/server/essay-review-requests.ts';
import { latestVersion } from '#lib/server/essays.ts';
import { isCreditRole, type EssayCredits } from '#lib/essays/credits.ts';
import { atLeast } from '#lib/permissions.ts';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types/index.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function everything(database: D1Database, bucket: R2Bucket, essay: string, canAdd: boolean): Promise<EssayCredits> {
	const latest = await latestVersion(database, essay);
	const [sections, hand, people] = await Promise.all([
		latest ? sectionCredits(database, bucket, essay, latest.number).catch((problem) => (console.error('Section credits could not be worked out', problem), [])) : [],
		handCredits(database, essay),
		canAdd ? essayPeople(database, essay, { everyone: true }) : []
	]);
	return {
		version: latest?.number ?? null,
		sections,
		hand,
		people: people.map((person) => ({ identifier: person.identifier, name: person.name })),
		canAdd
	};
}

export const GET: RequestHandler = async (event) => {
	const { identifier, database, bucket, level } = await essayAccess(event, 'comment', { forData: true });
	return json(await everything(database, bucket, identifier, atLeast(level, 'full')), { headers: { 'Cache-Control': 'private, no-store' } });
};

export const POST: RequestHandler = async (event) => {
	const { identifier, database, bucket, person } = await essayAccess(event, 'full', { forData: true });
	const body = (await event.request.json().catch(() => /* expected: a body that is not JSON is refused just below with 400 */ null)) as Record<string, unknown> | null;
	if (!body) error(400, 'Send the section, the person and the role.');
	const { slug, title, person: credited, role, action } = body;
	if (typeof slug !== 'string' || !slugPattern.test(slug) || slug.length > 90) error(400, 'Name the section by its heading.');
	if (typeof title !== 'string' || !title.trim() || title.length > 300) error(400, 'Send the section heading.');
	if (typeof credited !== 'string' || !credited) error(400, 'Choose a person.');
	if (!isCreditRole(role)) error(400, 'Say whether they wrote, edited, researched or reviewed the section.');
	if (action !== 'add' && action !== 'remove') error(400, 'Say whether to add the credit or take it away.');
	if (action === 'add' && !(await essayPeople(database, identifier, { everyone: true })).some((candidate) => candidate.identifier === credited)) {
		error(400, 'Only people on the project can be credited.');
	}
	await changeHandCredit(database, { essay: identifier, slug, title: title.trim(), person: credited, role, action, by: person.identifier });
	return json(await everything(database, bucket, identifier, true));
};
