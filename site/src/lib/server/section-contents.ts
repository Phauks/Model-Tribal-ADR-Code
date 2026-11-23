/**
 * The pages inside each section of the site, for the sidebar (SiteSidebar.svelte).
 * Trevor asked on Nov. 23, 2026 for every section to open from any page, so a
 * reader can reach its pages without first going to its home page, and for
 * the sidebar to have every list from the start, with nothing to load. The
 * root layout sends every list with the page (sidebarLists).
 *
 * Most lists are known when the site is built. The essays are published from
 * the database, so a page the Worker renders reads their lists as it renders;
 * a page built ahead of time cannot, and the sidebar reads them from
 * /sidebar/[section].json as the page opens.
 */
import { libraryOutline } from '#lib/library-pages.ts';
import type { OutlineItem } from '#lib/site-sections.ts';
import { publishedGlossary } from './glossary-entries.ts';
import { storySummaries } from './stories.ts';

const byLabel = (first: OutlineItem, second: OutlineItem) => first.label.localeCompare(second.label, 'en-US');

export const nationsPages: OutlineItem[] = [
	{ label: 'Directory', link: '/nations' },
	{ label: 'Map', link: '/nations/map' },
	{ label: 'Timeline', link: '/nations/timeline' },
	{ label: 'Find recourse', link: '/nations/recourse' },
	{ label: 'Data and charts', link: '/nations/data' }
];

export function storiesPages(): OutlineItem[] {
	return [
		{ label: 'All stories', link: '/stories' },
		...storySummaries()
			.map((story) => ({ label: story.title, link: `/stories/${story.id}` }))
			.sort(byLabel)
	];
}

export function glossaryPages(): OutlineItem[] {
	return publishedGlossary()
		.map((record) => ({ label: record.term, link: `/glossary/${record.id}` }))
		.sort(byLabel);
}

/** The lists built with the site, by the section's name (its address without the slash). */
const builtLists: Record<string, () => OutlineItem[]> = {
	stories: storiesPages,
	nations: () => nationsPages,
	library: () => libraryOutline(),
	glossary: glossaryPages,
	events: () => [
		{ label: 'Upcoming events', link: '/events' },
		{ label: 'Past events', link: '/events?when=past' }
	],
	about: () => [
		{ label: 'About the project', link: '/about' },
		{ label: 'Timeline to public review', link: '/about/timeline' }
	]
};

/** The lists read from the database on request: the published essays of each part. */
const essayParts = { foundations: 'foundations', essays: 'essays' } as const;

/** The sections whose lists are read from the database. */
export const essaySections = Object.keys(essayParts);

/** The pages inside a section, or undefined for a section the sidebar cannot open. */
export async function sectionContents(section: string): Promise<OutlineItem[] | undefined> {
	if (Object.hasOwn(builtLists, section)) return builtLists[section]();
	if (Object.hasOwn(essayParts, section)) {
		// Loaded only here, so the section layouts that share these lists do not load the essay pages.
		const { essayIndex } = await import('./essay-pages.ts');
		const index = await essayIndex(essayParts[section as keyof typeof essayParts]);
		return index.outline.items;
	}
	return undefined;
}

/**
 * Every section's pages, by the section's address. The essays' lists are
 * left out while the site is being built, when there is no database, and
 * when the database cannot be read.
 */
export async function allSectionLists(building: boolean): Promise<Record<string, OutlineItem[]>> {
	const lists: Record<string, OutlineItem[]> = {};
	for (const [section, list] of Object.entries(builtLists)) lists[`/${section}`] = list();
	if (building) return lists;
	try {
		const { essayLists } = await import('./essay-pages.ts');
		const byPart = await essayLists();
		for (const [section, part] of Object.entries(essayParts)) lists[`/${section}`] = byPart[part] ?? [];
	} catch (problem) {
		// The sidebar then reads these lists in the browser.
		console.error('Could not list the essays for the sidebar', problem);
	}
	return lists;
}
