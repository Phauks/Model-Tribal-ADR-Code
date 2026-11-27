// The shapes the side column reads from each page (SiteSidebar.svelte): the
// page's own outline, and the family of pages it belongs with. The site's
// sections themselves are in src/lib/site-navigation.ts.

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
	/** How many things the page lists, shown in a badge after the label, such as a nation's court opinions. */
	count?: number;
	/** A case, law or analysis box in an essay being edited, shown with its icon; a case's name is in italics. */
	kind?: 'case' | 'law' | 'analysis';
	mark?: OutlineMark;
	children?: OutlineItem[];
};

/** What a page gives the sidebar through its load function's `outline`: its headings. */
export type PageOutline = {
	/** The page's name, such as the nation's name. */
	title?: string;
	items: OutlineItem[];
};

/**
 * The pages a page belongs with, listed at the top of the side column: a
 * nation's page and its Court opinions, or the essays of Foundations
 * (Trevor, Nov. 27, 2026, design/navigation-models/mockups/C-desktop-nation.png).
 */
export type PageFamily = {
	/** The family's name, such as the nation's name. */
	title: string;
	/** The family's own page, when its name links to one. */
	link?: string;
	pages: OutlineItem[];
};
