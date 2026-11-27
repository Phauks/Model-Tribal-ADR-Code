/**
 * The writers' quotation check (EssayChecks.svelte): each quotation in the
 * editor's text that names its source is looked for in the documents that
 * source cites in the source library, private copies included, and the
 * answer says whether it matches word for word, which words differ, whether
 * it was not found, and whether readers can open it in its paragraph
 * (src/lib/server/quote-context.ts). Only the differing words of a private
 * copy are sent, never its text, and only to people who may search the
 * library; others learn just that the quotation matched a private copy.
 */
import { error, json } from '@sveltejs/kit';
import { largestEssayBytes } from '#lib/server/essays.ts';
import { essayAccess } from '#lib/server/essay-workspace.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { checkQuotation, type ParagraphCache, type QuotationCheck } from '#lib/server/quote-context.ts';
import { can } from '#lib/permissions.ts';
import { quotationsIn } from '#lib/quote-context.ts';
import { splitFrontMatter } from '#lib/essays/syntax.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

/** Quotations checked in one request; a longer essay is checked in its first this many. */
const mostQuotations = 300;

export const POST: RequestHandler = async (event) => {
	const { person } = await essayAccess(event, 'comment', { forData: true });
	const body = (await event.request.json().catch(() => /* expected: a body that is not JSON is refused just below with 400 */ null)) as { text?: unknown } | null;
	if (!body || typeof body.text !== 'string' || body.text.length > largestEssayBytes) error(400, 'Send the text to check.');
	const database = workerEnvironment().sourceLibrary;
	if (!database) error(503, 'The source library is not connected.');
	const { body: markdown, frontMatter } = splitFrontMatter(body.text);
	// Lines are counted in the whole file, front matter included.
	const offset = frontMatter ? body.text.slice(0, body.text.length - markdown.length).split('\n').length - 1 : 0;
	const quotations = quotationsIn(markdown).slice(0, mostQuotations);
	const seesPrivateText = can(person, 'search-source-library');
	const checks: QuotationCheck[] = [];
	const cache: ParagraphCache = new Map();
	for (const quotation of quotations) {
		const check = await checkQuotation(database, { ...quotation, line: quotation.line + offset }, cache);
		if (!seesPrivateText && !check.readersCanOpen) check.differences = [];
		checks.push(check);
	}
	return json({ checks });
};
