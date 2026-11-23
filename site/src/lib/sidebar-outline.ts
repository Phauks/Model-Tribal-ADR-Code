/**
 * What the sidebar shows inside a section (SiteSidebar.svelte), worked out
 * without the browser so it can be tested.
 *
 * Trevor asked on Nov. 23, 2026 that being inside a section never hide its
 * other pages: the section always lists its pages, and the page being read
 * opens under its own entry into its headings. A page that is not in the
 * list, such as a nation's page, is added under the entry whose address
 * holds it (the nation under Directory).
 */
import type { OutlineItem, PageOutline } from './site-sections.ts';

/** The section's pages with the page being read, and its own outline, nested in place. */
export function composeSectionOutline(
	sectionPages: OutlineItem[] | undefined,
	pageOutline: PageOutline | undefined,
	path: string,
	pageTitle?: string
): OutlineItem[] {
	const own = pageOutline?.items ?? [];
	if (!sectionPages?.length) return own;
	if (own.length === 0) return sectionPages;

	// The page is in the list: its outline goes under its entry.
	let placed = false;
	const withOwn = (items: OutlineItem[]): OutlineItem[] =>
		items.map((item) => {
			if (!placed && item.link === path) {
				placed = true;
				return { ...item, children: own };
			}
			return item.children ? { ...item, children: withOwn(item.children) } : item;
		});
	const listed = withOwn(sectionPages);
	if (placed) return listed;

	// Otherwise the page joins the entry whose address holds it, or the end of the list.
	const entry: OutlineItem = { label: pageOutline?.title ?? pageTitle ?? 'This page', link: path, current: true, children: own };
	const parent = deepestHolder(sectionPages, path);
	if (!parent) return [...sectionPages, entry];
	const addUnder = (items: OutlineItem[]): OutlineItem[] =>
		items.map((item) =>
			item === parent
				? { ...item, children: [...(item.children ?? []), entry] }
				: item.children
					? { ...item, children: addUnder(item.children) }
					: item
		);
	return addUnder(sectionPages);
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

/** The storage key for the sections and groups the reader opened or shut, kept from page to page. */
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
