/**
 * Every source record's key and citation as plain text, for the editor's
 * "Cite a source" search, the glossary terms for "Link a glossary term" and
 * the definitions check, and the words the spelling check should know.
 * Any signed-in workspace member may read it: it holds only what the public
 * pages already show.
 */
import { json } from '@sveltejs/kit';
import { essaySpellingWords, essayTerms } from 'virtual:essay-library';
import { citationTexts } from '#lib/server/essay-citations.ts';
import { requirePersonForData } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

let cached: { sources: [string, string][]; terms: [string, string][]; words: string[] } | undefined;

export const GET: RequestHandler = async (event) => {
	requirePersonForData(event);
	cached ??= {
		sources: await citationTexts(),
		terms: Object.entries(essayTerms).sort((first, second) => first[1].localeCompare(second[1], 'en-US')),
		words: essaySpellingWords
	};
	return json(cached, { headers: { 'Cache-Control': 'private, max-age=3600' } });
};
