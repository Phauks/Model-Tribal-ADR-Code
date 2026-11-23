/**
 * What the sidebar's second column lists for the section being read
 * (SiteSidebar.svelte), worked out without the browser so it can be tested.
 *
 * Trevor chose on Nov. 23, 2026 to keep the first column to the site's
 * sections and to list a section's pages in a second column beside it: the
 * section's own pages, then its long list (the nations, the stories, the
 * glossary's terms) with a filter. The page being read opens under its own
 * entry into its headings. A page in neither list joins the entry whose
 * address holds it, or the end of the pages.
 */
import type { OutlineItem, PageOutline } from './site-sections.ts';

/** A section's contents: its own pages, and its long list, if it has one. */
export type SectionContents = {
	pages: OutlineItem[];
	/**
	 * A long list, such as the nations, with the word for its entries
	 * ("nations"). A list named by `list` comes from a shared module instead of
	 * the page's data (src/lib/section-lists.ts).
	 */
	entries?: { noun: string; items: OutlineItem[]; list?: 'nations' };
};

/** The section's contents with the page being read, and its own outline, nested in place. */
export function composeSectionContents(
	contents: SectionContents | undefined,
	pageOutline: PageOutline | undefined,
	path: string,
	pageTitle?: string
): SectionContents {
	const own = pageOutline?.items ?? [];
	if (!contents) return { pages: own };
	if (own.length === 0) return contents;

	// The page is in a list: its outline goes under its entry.
	let placed = false;
	const withOwn = (items: OutlineItem[]): OutlineItem[] =>
		items.map((item) => {
			if (!placed && item.link === path) {
				placed = true;
				return { ...item, children: own };
			}
			return item.children ? { ...item, children: withOwn(item.children) } : item;
		});
	const pages = withOwn(contents.pages);
	const entries = contents.entries && { ...contents.entries, items: withOwn(contents.entries.items) };
	if (placed) return { pages, entries };

	// Otherwise the page joins the entry whose address holds it, or the end of the pages.
	const entry: OutlineItem = { label: pageOutline?.title ?? pageTitle ?? 'This page', link: path, current: true, children: own };
	const parent = deepestHolder(contents.pages, path);
	if (!parent) return { pages: [...contents.pages, entry], entries: contents.entries };
	const addUnder = (items: OutlineItem[]): OutlineItem[] =>
		items.map((item) =>
			item === parent
				? { ...item, children: [...(item.children ?? []), entry] }
				: item.children
					? { ...item, children: addUnder(item.children) }
					: item
		);
	return { pages: addUnder(contents.pages), entries: contents.entries };
}

/** The entries whose names hold every word of the filter, ignoring case and accents. */
export function filterEntries(items: OutlineItem[], filter: string): OutlineItem[] {
	const words = fold(filter).split(/\s+/).filter(Boolean);
	if (words.length === 0) return items;
	return items.filter((item) => {
		const name = fold(item.label);
		return words.every((word) => name.includes(word));
	});
}

function fold(text: string): string {
	return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('en-US');
}

/** A long list in groups by first letter, A to Z, with names that start otherwise first under "#". */
export function letterGroups(items: OutlineItem[]): { letter: string; items: OutlineItem[] }[] {
	const groups: { letter: string; items: OutlineItem[] }[] = [];
	for (const item of items) {
		const first = fold(item.label.replace(/^[^\p{L}\p{N}]+/u, '')).charAt(0).toUpperCase();
		const letter = /[A-Z]/.test(first) ? first : '#';
		const group = groups.find((candidate) => candidate.letter === letter);
		if (group) group.items.push(item);
		else groups.push({ letter, items: [item] });
	}
	return groups.sort((first, second) => (first.letter === '#' ? -1 : second.letter === '#' ? 1 : first.letter.localeCompare(second.letter)));
}

/** The entry with the longest address that holds `path` (`/nations` holds `/nations/navajo-nation`). */
function deepestHolder(items: OutlineItem[], path: string): OutlineItem | undefined {
	let best: OutlineItem | undefined;
	const visit = (list: OutlineItem[]) => {
		for (const item of list) {
			if (!item.link.startsWith('#') && !item.link.includes('?') && path.startsWith(`${item.link}/`)) {
				if (!best || item.link.length > best.link.length) best = item;
			}
			if (item.children) visit(item.children);
		}
	};
	visit(items);
	return best;
}

/**
 * The address that marks an entry as the page being read. A list with
 * entries for the same page and different queries, such as Upcoming events
 * (/events) and Past events (/events?when=past), marks the one with the
 * address's query; any other list ignores the query.
 */
export function currentLinkIn(items: OutlineItem[], path: string, search: string): string {
	if (!search) return path;
	const withQuery = `${path}${search}`;
	const has = (list: OutlineItem[]): boolean => list.some((item) => item.link === withQuery || has(item.children ?? []));
	return has(items) ? withQuery : path;
}

/** The storage key for the groups the reader opened or shut, such as the Workspace, kept from page to page. */
export const sectionChoicesKey = 'sidebar-open-sections';

/**
 * Reads the stored choices: an object of section address to open (true) or
 * shut (false). An older list of open addresses is read as all open.
 */
export function parseSectionChoices(text: string | null): Record<string, boolean> {
	try {
		const value: unknown = JSON.parse(text ?? '{}');
		if (Array.isArray(value)) {
			return Object.fromEntries(value.filter((link): link is string => typeof link === 'string').map((link) => [link, true]));
		}
		if (value && typeof value === 'object') {
			return Object.fromEntries(
				Object.entries(value).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean')
			);
		}
	} catch {
		// Not something this site wrote; start afresh.
	}
	return {};
}
