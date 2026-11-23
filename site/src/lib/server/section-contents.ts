/**
 * The pages inside each section of the site, for the sidebar (SiteSidebar.svelte).
 * Trevor asked on Nov. 23, 2026 for every section to open from any page, so a
 * reader can reach its pages without first going to its home page. The section
 * being read gets the same list from the root layout, so the two never differ.
 *
 * Most lists are known when the site is built; the essays are published from
 * the database, so their lists are read on request (/sidebar/[section].json).
 */
import { libraryOutline } from '#lib/library-pages.ts';
import type { OutlineItem } from '#lib/site-sections.ts';
import { publishedGlossary } from './glossary-entries.ts';
import { storySummaries } from './stories.ts';

const byLabel = (first: OutlineItem, second: OutlineItem) => first.label.localeCompare(second.label, 'en-US');

export const nationsPages: OutlineItem[] = [
	{ label: 'Directory', link: '/nations' },
	{ label: 'Map', link: '/nations/map' },
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

/** The sections whose lists are built with the site. */
export const builtSections = Object.keys(builtLists);

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
