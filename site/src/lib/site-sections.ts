// The site's sections, in the order of the working outline's main menu
// (docs/outline.md, "The website"). The sidebar lists them on every page, and
// its second column lists the pages of the one being read.

import { libraryOutline } from '#lib/library-pages.ts';

/**
 * A dot after an entry in an essay's outline while it is edited
 * (src/lib/essays/editor-outline.ts): changed in the draft, new since the
 * published version, or in a section someone was asked to review.
 */
export type OutlineMark = 'changed' | 'new' | 'review';

/** One entry in a page's outline: a heading on the page, or a page within a section. */
export type OutlineItem = {
	label: string;
	link: string;
	/** A short marker set before the label, such as a section number. */
	number?: string;
	/** Set on the entry for the page being read. */
	current?: boolean;
	/** A quieter note after the label, such as "tentative". */
	note?: string;
	/** A case, law or analysis box in an essay being edited, shown with its icon; a case's name is in italics. */
	kind?: 'case' | 'law' | 'analysis';
	mark?: OutlineMark;
	children?: OutlineItem[];
};

/** What a page gives the sidebar through its load function's `outline`. */
export type PageOutline = {
	/** The heading shown above the outline, such as the nation's name. */
	title?: string;
	items: OutlineItem[];
};

/**
 * A section of the site. `built` is false until its pages exist; the sidebar
 * then shows its name without a link, so readers see the whole shape of the
 * site without following links to pages that are not there yet.
 *
 * A section can gather pages that keep addresses of their own (`gathers`), as
 * the Library gathers Data sets and Source documents. On those pages the
 * section counts as current, and when the page gives no outline of its own the
 * sidebar lists the gathered pages instead.
 *
 * `opens` marks a section with pages of its own to list in the sidebar's
 * second column (src/lib/server/section-contents.ts).
 */
export type SiteSection = { label: string; link: string; built: boolean; gathers?: OutlineItem[]; opens?: boolean };

export const siteSections: SiteSection[] = [
	{ label: 'Model code', link: '/code', built: false },
	{ label: 'Peacemaking', link: '/peacemaking', built: false },
	{ label: 'Foundations', link: '/foundations', built: true, opens: true },
	{ label: 'Essays', link: '/essays', built: true, opens: true },
	// Only the stories are published so far; the methods catalog joins them later.
	{ label: 'Methods and stories', link: '/stories', built: true, opens: true },
	{ label: 'Nations', link: '/nations', built: true, opens: true },
	{ label: 'Library', link: '/library', built: true, gathers: libraryOutline(), opens: true },
	{ label: 'Glossary', link: '/glossary', built: true, opens: true },
	{ label: 'Events', link: '/events', built: true, opens: true },
	{ label: 'About', link: '/about', built: true, opens: true },
	{ label: 'Sponsorship', link: '/sponsor', built: true },
	// The Store gathers the special-order page for books, which keeps its address (Trevor, Nov. 23, 2026).
	{ label: 'Store', link: '/store', built: true, gathers: [{ label: 'Special order', link: '/book' }], opens: true }
];

/** The section a path belongs to, if any. */
export function sectionOf(path: string): SiteSection | undefined {
	const within = (link: string) => path === link || path.startsWith(`${link}/`);
	return siteSections.find((section) => within(section.link) || section.gathers?.some((page) => within(page.link)));
}

