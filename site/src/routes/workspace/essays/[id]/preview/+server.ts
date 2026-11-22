/**
 * Renders the editor's text as the published page would show it, without
 * saving, and lists citations and glossary links that point to nothing.
 */
import { error, json } from '@sveltejs/kit';
import { largestEssayBytes } from '#lib/server/essays.ts';
import { essayAccess } from '#lib/server/essay-workspace.ts';
import { renderWithGenerated } from '#lib/server/essay-pages.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const POST: RequestHandler = async (event) => {
	await essayAccess(event, 'comment');
	const body = (await event.request.json().catch(() => null)) as { text?: unknown } | null;
	if (!body || typeof body.text !== 'string' || body.text.length > largestEssayBytes) error(400, 'Send the text to show.');
	const rendered = await renderWithGenerated(body.text, 'saved');
	return json(rendered);
};
