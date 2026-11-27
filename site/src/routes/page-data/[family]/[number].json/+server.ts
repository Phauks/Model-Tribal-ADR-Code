/**
 * The data of the pages the Worker draws on request (src/lib/server/page-data.ts),
 * written as static files when the site is built: each of a family's files
 * holds the pages whose keys hash to its number (src/lib/page-data.ts), as a
 * JSON object from each key to the page's data as devalue writes it. It runs
 * only during the build: the records it reads are not in the Worker.
 */
import { building } from '$app/env';
import { error } from '@sveltejs/kit';
import { stringify } from 'devalue';
import { pageDataFamilies, pageDataFileCounts, pageDataFileNumber, type PageDataFamily } from '#lib/page-data.ts';
import { biographies, biographyPage } from '#lib/server/biographies.ts';
import { browseCollection, browseKeys } from '#lib/server/browse-collections.ts';
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
	collections: { keys: browseKeys, page: browseCollection },
	sections: { keys: sectionKeys, page: sectionPageData },
	biographies: { keys: () => biographies().map((person) => person.key), page: biographyPage },
	justices: { keys: justiceKeys, page: justicePage },
	presidents: { keys: presidentKeys, page: presidentPage },
	courts: { keys: () => courtsWithPages().map((court) => court.key), page: courtPage }
};

/** Each family's keys by the number of the file that holds them, worked out once per build. */
const keysByFile = new Map<PageDataFamily, Map<number, string[]>>();

function keysInFile(family: PageDataFamily, number: number): string[] {
	let files = keysByFile.get(family);
	if (!files) {
		files = new Map();
		for (const key of families[family].keys()) {
			const at = pageDataFileNumber(family, key);
			const list = files.get(at);
			if (list) list.push(key);
			else files.set(at, [key]);
		}
		keysByFile.set(family, files);
	}
	return files.get(number) ?? [];
}

// Every file is written, an empty one too, so the Worker can tell a page the site lacks from a file it could not read.
export const entries: EntryGenerator = () =>
	pageDataFamilies.flatMap((family) => Array.from({ length: pageDataFileCounts[family] }, (_, number) => ({ family, number: String(number) })));

export const GET: RequestHandler = ({ params }) => {
	const family = params.family as PageDataFamily;
	const number = Number(params.number);
	if (!building || !families[family] || !Number.isInteger(number) || number < 0 || number >= pageDataFileCounts[family]) error(404, 'Not found');
	const pages: Record<string, string> = {};
	for (const key of keysInFile(family, number).sort()) {
		const page = families[family].page(key);
		if (page) pages[key] = stringify(page);
	}
	return new Response(JSON.stringify(pages), { headers: { 'content-type': 'application/json; charset=utf-8' } });
};
