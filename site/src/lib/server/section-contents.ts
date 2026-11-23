/**
 * The pages inside each section of the site, for the sidebar's second column
 * (SiteSidebar.svelte). The first column lists only the sections; the second
 * lists the pages of the section being read, and its long list, such as the
 * nations or the glossary's terms, with a filter (Trevor, Nov. 23, 2026). The
 * root layout sends the section's contents with each page, so nothing loads.
 *
 * Most lists are known when the site is built. The essays are published from
 * the database, and their pages are rendered by the Worker, which reads them.
 */
import { libraryOutline } from '#lib/library-pages.ts';
import type { SectionContents } from '#lib/sidebar-outline.ts';
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

/** The contents of each section built with the site, by the section's name (its address without the slash). */
const builtContents: Record<string, () => SectionContents> = {
	nations: () => ({
		pages: nationsPages,
		// The nations come from a module the browser keeps (src/lib/section-lists.ts).
		entries: { noun: 'nations', items: [], list: 'nations' }
	}),
	stories: () => ({
		pages: [{ label: 'All stories', link: '/stories' }],
		entries: {
			noun: 'stories',
			items: storySummaries()
				.map((story) => ({ label: story.title, link: `/stories/${story.id}` }))
				.sort(byLabel)
		}
	}),
	glossary: () => ({
		pages: [],
		entries: {
			noun: 'terms',
			items: publishedGlossary()
				.map((record) => ({ label: record.term, link: `/glossary/${record.id}` }))
				.sort(byLabel)
		}
	}),
	library: () => ({ pages: libraryOutline() }),
	events: () => ({
		pages: [
			{ label: 'Upcoming events', link: '/events' },
			{ label: 'Past events', link: '/events?when=past' }
		]
	}),
	store: () => ({
		pages: [
			{ label: 'Books', link: '/store#books' },
			{ label: 'Special order', link: '/book' }
		]
	}),
	about: () => ({
		pages: [
			{ label: 'About the project', link: '/about' },
			{ label: 'Timeline to public review', link: '/about/timeline' }
		]
	})
};

/** The sections whose essays are read from the database. */
const essayParts = { foundations: 'foundations', essays: 'essays' } as const;

/** The sections whose contents are known when the site is built. */
export const builtSections = Object.keys(builtContents);

/** A section's contents, or undefined for a section without any. */
export async function sectionContents(section: string): Promise<SectionContents | undefined> {
	if (Object.hasOwn(builtContents, section)) return builtContents[section]();
	if (Object.hasOwn(essayParts, section)) {
		// Loaded only here, so pages outside the essays do not load the essay pages.
		const { essayIndex } = await import('./essay-pages.ts');
		const index = await essayIndex(essayParts[section as keyof typeof essayParts]);
		return { pages: index.outline.items };
	}
	return undefined;
}
