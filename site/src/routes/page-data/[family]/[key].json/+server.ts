/**
 * The data of each page the Worker draws on request (src/lib/server/page-data.ts),
 * written as a static file when the site is built. It runs only during the
 * build: the records it reads are not in the Worker.
 */
import { building } from '$app/env';
import { error } from '@sveltejs/kit';
import { stringify } from 'devalue';
import { pageDataFamilies, type PageDataFamily } from '#lib/page-data.ts';
import { biographies, biographyPage } from '#lib/server/biographies.ts';
import { caseKeys, casePage } from '#lib/server/case-pages.ts';
import { sectionKeys } from '#lib/server/code-outline.ts';
import { justiceKeys, justicePage, presidentKeys, presidentPage } from '#lib/server/justice-pages.ts';
import { lawKeys, lawPage, sectionPageData } from '#lib/server/law-pages.ts';
import { courtPage, courtsWithPages } from '#lib/server/supreme-court-pages.ts';
import type { EntryGenerator, RequestHandler } from './$types';

export const prerender = true;

const families: Record<PageDataFamily, { keys: () => string[]; page: (key: string) => unknown }> = {
	cases: { keys: caseKeys, page: casePage },
	laws: { keys: lawKeys, page: lawPage },
	sections: { keys: sectionKeys, page: sectionPageData },
	biographies: { keys: () => biographies().map((person) => person.key), page: biographyPage },
	justices: { keys: justiceKeys, page: justicePage },
	presidents: { keys: presidentKeys, page: presidentPage },
	courts: { keys: () => courtsWithPages().map((court) => court.key), page: courtPage }
};

export const entries: EntryGenerator = () => pageDataFamilies.flatMap((family) => families[family].keys().map((key) => ({ family, key })));

export const GET: RequestHandler = ({ params }) => {
	const family = families[params.family as PageDataFamily];
	if (!building || !family) error(404, 'Not found');
	const page = family.page(params.key);
	if (!page) error(404, 'Not found');
	return new Response(stringify(page), { headers: { 'content-type': 'application/json; charset=utf-8' } });
};
