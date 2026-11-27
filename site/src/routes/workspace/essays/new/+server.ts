/**
 * Starts an essay from the "New essay" button on a section page or beside
 * the section in the sidebar (NewEssayButton.svelte). It answers with the
 * essay's page, which the browser opens in Editing. Workspace › Essays, where
 * essays used to be started, was removed (lead author, Nov. 23, 2026: "yes,
 * remove it").
 */
import { error, json } from '@sveltejs/kit';
import { canStartEssays } from '#lib/server/essay-workspace.ts';
import { essayPath, isEssayIdentifier, latestVersion, saveVersion, startableEssayParts, type EssayPart } from '#lib/server/essays.ts';
import { requirePersonForData, storage } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const POST: RequestHandler = async (event) => {
	const person = requirePersonForData(event);
	const { database, bucket } = storage(event);
	if (!(await canStartEssays(database, person))) {
		event.locals.refused = 'needs full access to every essay to start one';
		error(403, 'Only someone with full access to every essay can start a new one.');
	}
	const body = (await event.request.json().catch(() => null)) as { title?: unknown; part?: unknown; identifier?: unknown } | null;
	const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 300) : '';
	const part = body?.part as EssayPart;
	const identifier = typeof body?.identifier === 'string' ? body.identifier.trim().toLowerCase().slice(0, 120) : '';
	if (!title) error(400, 'Give the essay a title.');
	if (!startableEssayParts.includes(part)) error(400, 'Choose where the essay goes.');
	const fullIdentifier = part === 'foundations' && !identifier.startsWith('i-') ? `i-${identifier}` : identifier;
	if (!isEssayIdentifier(fullIdentifier)) error(400, 'The address uses lower-case letters, numbers and hyphens, such as "why-consent-matters".');
	if (await latestVersion(database, fullIdentifier)) error(400, 'An essay with this address exists already.');
	const frontMatter = [`title: ${JSON.stringify(title)}`, part === 'foundations' ? 'part: i' : part === 'back-matter' ? 'part: back-matter' : part === 'news' ? 'part: news' : '', 'status: draft']
		.filter(Boolean)
		.join('\n');
	await saveVersion(database, bucket, {
		identifier: fullIdentifier,
		text: `---\n${frontMatter}\n---\n\n# ${title}\n\n`,
		basedOn: null,
		personIdentifier: person.identifier,
		origin: 'editor',
		part,
		note: 'Started'
	});
	return json({ link: essayPath(fullIdentifier, part) }, { headers: { 'Cache-Control': 'private, no-store' } });
};
