// The pages the Library section gathers (docs/outline.md, "The website"). They
// keep their own addresses, so links to them from the footer, the Download menu
// and other pages still work; the Library page lists them and the sidebar opens
// the Library section into them on any of these pages.
import type { OutlineItem } from '#lib/site-sections.ts';

export type LibraryPage = { label: string; link: string; description: string };

export const libraryPages: LibraryPage[] = [
	{
		label: 'Source documents',
		link: '/copies',
		description:
			'Our own copies of documents the site cites: United States laws and government documents, Native nations’ constitutions and laws, and tribal court opinions. Each gives where it was published, the date it was saved and its SHA-256.'
	},
	{
		label: 'Data sets',
		link: '/downloads',
		description:
			'Files to keep: the list of nations, the dispute resolution provisions, the glossary and the map’s layers, as spreadsheets, JSON and ZIP files, and the United States documents in one ZIP file, with a way to check that a file you downloaded is the one published here.'
	},
	{
		label: 'Supreme Court',
		link: '/supreme-court',
		description: 'Each Court of the Supreme Court of the United States that decided a case on this site, named for its Chief Justice: its Justices, its history and its cases.'
	},
	{
		label: 'Courts',
		link: '/courts',
		description: 'The Tribal, federal, state and territorial courts whose opinions or cases are on this site.'
	},
	{
		label: 'Biographies',
		link: '/biographies',
		description: 'Native people in the cases on this site and leaders in nations’ histories, each fact with its source.'
	},
	{
		label: 'Statistics',
		link: '/stats',
		description: 'How many nations, laws, treaties, executive orders, cases, people and other records the site holds, each opening the list of what it counts.'
	},
	{
		label: 'Back matter',
		link: '/back-matter',
		description: 'Pages that close the book and help readers find their way through it, such as the index of cases by topic.'
	},
	{
		label: 'Licenses by material',
		link: '/licenses',
		description: 'What you may copy and share from this site, and on what terms, for each kind of material.'
	}
];

/**
 * The Library's outline in the sidebar: its pages in order. A page can open its
 * own entry into the pages under it, as the Back matter index does.
 */
export function libraryOutline(children: Record<string, OutlineItem[]> = {}): OutlineItem[] {
	return libraryPages.map(({ label, link }) => ({ label, link, ...(children[link]?.length ? { children: children[link] } : {}) }));
}
