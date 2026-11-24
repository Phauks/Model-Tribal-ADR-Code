// The site's sections, in sidebar order (the original menu is in
// docs/outline.md, "The website"). The sidebar lists them on every page, and
// its second column lists the pages of the one being read.

import { dataTopicLink, dataTopicList } from '#lib/data-chart-list.ts';
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
 *
 * `pages` are a section's own few pages, known when the site is built. The
 * list of sections folds each one open to show them, as the Workspace's
 * categories fold (Trevor, Nov. 24, 2026); long lists, such as the nations,
 * stay in the section's panel.
 */
export type SiteSection = {
	label: string;
	link: string;
	built: boolean;
	gathers?: OutlineItem[];
	opens?: boolean;
	pages?: OutlineItem[];
};

export const nationsPages: OutlineItem[] = [
	{ label: 'Find the law', link: '/nations/law' },
	{ label: 'Map', link: '/nations/map' },
	{ label: 'Timeline', link: '/nations/timeline' },
	{ label: 'Find recourse', link: '/nations/recourse' },
	{
		label: 'Data and charts',
		link: '/nations/data',
		// Its topic pages (Trevor, Nov. 24, 2026), then Build a table; the section's panel lists them.
		children: [
			...dataTopicList.map((topic) => ({ label: topic.title, link: dataTopicLink(topic.identifier) })),
			{ label: 'Build a table', link: '/nations/data/build' }
		]
	},
	{ label: 'Federal offices', link: '/nations/federal-offices' },
	{ label: 'Coverage', link: '/nations/coverage' }
];

export const eventsPages: OutlineItem[] = [
	{ label: 'Current and upcoming events', link: '/events' },
	{ label: 'Past events', link: '/events?when=past' }
];

// The Sponsorship levels page sits under Sponsorship (docs/sponsorship.md, "Levels").
export const sponsorPages: OutlineItem[] = [
	{ label: 'Sponsorship', link: '/sponsor' },
	{ label: 'Sponsorship levels', link: '/sponsor/levels' }
];

export const storePages: OutlineItem[] = [
	{ label: 'Books', link: '/store#books' },
	{ label: 'Special order', link: '/book' }
];

export const aboutPages: OutlineItem[] = [
	{ label: 'About the project', link: '/about' },
	{ label: 'Timeline to public review', link: '/about/timeline' }
];

// The site is a repository of Native legal information first, so the
// nations, the library and the glossary lead, and the model code follows the
// writing about it (Trevor, Nov. 24, 2026).
export const siteSections: SiteSection[] = [
	{ label: 'Nations', link: '/nations', built: true, opens: true, pages: nationsPages },
	{ label: 'Library', link: '/library', built: true, gathers: libraryOutline(), opens: true, pages: libraryOutline() },
	{ label: 'Glossary', link: '/glossary', built: true, opens: true },
	{ label: 'Foundations', link: '/foundations', built: true, opens: true },
	{ label: 'Essays', link: '/essays', built: true, opens: true },
	// Only the stories are published so far; the methods catalog joins them later.
	{ label: 'Methods and stories', link: '/stories', built: true, opens: true },
	{ label: 'Model code', link: '/code', built: false },
	{ label: 'Peacemaking', link: '/peacemaking', built: false },
	{ label: 'Events', link: '/events', built: true, opens: true, pages: eventsPages },
	{ label: 'About', link: '/about', built: true, opens: true, pages: aboutPages },
	{ label: 'Sponsorship', link: '/sponsor', built: true, opens: true, pages: sponsorPages },
	// Contribute moved here from the masthead, which keeps only its buttons (Trevor, Nov. 24, 2026).
	{ label: 'Contribute', link: '/requests?kind=contribute', built: true },
	// The Store gathers the special-order page for books, which keeps its address (Trevor, Nov. 23, 2026).
	{ label: 'Store', link: '/store', built: true, gathers: [{ label: 'Special order', link: '/book' }], opens: true, pages: storePages }
];

/** The section a path belongs to, if any. */
export function sectionOf(path: string): SiteSection | undefined {
	const within = (link: string) => path === link || path.startsWith(`${link}/`);
	return siteSections.find((section) => within(section.link) || section.gathers?.some((page) => within(page.link)));
}

