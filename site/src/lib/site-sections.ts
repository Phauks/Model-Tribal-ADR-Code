// The site's sections, in the order of the working outline's main menu
// (docs/outline.md, "The website"). The sidebar lists them on every page and
// opens the current one into the outline of the page being read.

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
 */
export type SiteSection = { label: string; link: string; built: boolean };

export const siteSections: SiteSection[] = [
	{ label: 'Model code', link: '/code', built: false },
	{ label: 'Peacemaking', link: '/peacemaking', built: false },
	{ label: 'Foundations', link: '/foundations', built: true },
	{ label: 'Essays', link: '/essays', built: true },
	// Only the stories are published so far; the methods catalog joins them later.
	{ label: 'Methods and stories', link: '/stories', built: true },
	{ label: 'Nations', link: '/nations', built: true },
	{ label: 'Library', link: '/library', built: false },
	{ label: 'Glossary', link: '/glossary', built: true },
	{ label: 'About', link: '/about', built: false }
];

/** The section a path belongs to, if any. */
export function sectionOf(path: string): SiteSection | undefined {
	return siteSections.find((section) => path === section.link || path.startsWith(`${section.link}/`));
}

