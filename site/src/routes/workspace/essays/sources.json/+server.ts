/**
 * Every source record's key and citation as plain text, for the editor's
 * "Cite a source" search, and the glossary terms for "Link a glossary term".
 * Any signed-in workspace member may read it: it holds only what the public
 * pages already show.
 */
import { json } from '@sveltejs/kit';
import { essayCitations, essayTerms } from 'virtual:essay-library';
import { requirePerson } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

function plain(html: string): string {
	return html
		.replace(/<span class="source-saved">[\s\S]*$/, '')
		.replace(/<[^>]+>/g, '')
		.replaceAll('&amp;', '&')
		.replaceAll('&#38;', '&')
		.replaceAll('&lt;', '<')
		.replaceAll('&gt;', '>')
		.replaceAll('&quot;', '"')
		.replaceAll('&#39;', "'")
		.replace(/\s+/g, ' ')
		.trim();
}

let cached: { sources: [string, string][]; terms: [string, string][] } | undefined;

export const GET: RequestHandler = (event) => {
	requirePerson(event);
	cached ??= {
		sources: Object.entries(essayCitations).map(([key, html]) => [key, plain(html)]),
		terms: Object.entries(essayTerms).sort((first, second) => first[1].localeCompare(second[1], 'en-US'))
	};
	return json(cached, { headers: { 'Cache-Control': 'private, max-age=3600' } });
};
