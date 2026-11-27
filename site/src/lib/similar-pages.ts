/**
 * Pages with a similar address, for the Page not found page (src/routes/+error.svelte;
 * mockup 8 in project files design/error-framework/, approved by Trevor on Nov. 27, 2026).
 * The words of the address's last part are searched as the masthead's search does, and the
 * first few results are listed with what kind of page each is.
 */
import type { PanelAnswer, ResultGroup } from './search-everything.ts';

export interface SimilarPage {
	title: string;
	link: string;
	/** What kind of page, and a detail such as the state or year: "Nation · California". */
	detail?: string;
}

/** How many pages are listed. */
export const similarCount = 3;

/** Words in addresses that say nothing about the page. */
const emptyWords = new Set(['and', 'the', 'of', 'for', 'in', 'on', 'to', 'a', 'an', 'html', 'index', 'page']);

/** One of each group's pages, by name. */
const kindNames: Record<Exclude<ResultGroup, 'document'>, string> = {
	nation: 'Nation',
	law: 'Federal law',
	case: 'Case',
	person: 'Person',
	story: 'Story',
	term: 'Glossary',
	reference: 'Reference',
	page: 'Page'
};

/** The words to search for an address that opened no page: its last part's words, such as "karuk trib" for /nations/karuk-trib. */
export function similarQuery(path: string): string {
	const parts = path.split('/').filter(Boolean);
	let last = parts.at(-1) ?? '';
	try {
		last = decodeURIComponent(last);
	} catch {
		// expected: an address with a broken % escape is searched as written.
	}
	const words = last
		.replace(/\.[a-z0-9]+$/i, '')
		.split(/[-_.+\s]+/)
		.filter((word) => word.length > 1 && !emptyWords.has(word.toLowerCase()));
	return words.slice(0, 4).join(' ');
}

/** The first few results of a search, leaving out the address itself. */
export function similarPages(answer: PanelAnswer, path: string): SimilarPage[] {
	const pages: SimilarPage[] = [];
	for (const { group, results } of answer.groups ?? []) {
		for (const result of results) {
			if (result.link.replace(/\/$/, '') === path.replace(/\/$/, '')) continue;
			pages.push({ title: result.title, link: result.link, detail: detailOf(group, result.title, result.detail) });
			if (pages.length === similarCount) return pages;
		}
	}
	return pages;
}

function detailOf(group: ResultGroup, title: string, detail: string | undefined): string | undefined {
	// A document's detail is its kind, year and nation; after the kind, a part the title already names is left out.
	const parts = (detail ?? '').split(' · ').filter((part, index) => part && (index === 0 || !title.toLowerCase().includes(part.toLowerCase())));
	if (group !== 'document') parts.unshift(kindNames[group]);
	return parts.length > 0 ? parts.join(' · ') : undefined;
}
