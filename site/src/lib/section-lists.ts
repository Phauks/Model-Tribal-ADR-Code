/**
 * The long lists the sidebar's second column takes from a shared module
 * rather than from each page's data (SiteSidebar.svelte). The nations' list
 * is long and the same on every Nations page, so the browser fetches it once,
 * with the site's scripts, and keeps it (vite.config.ts, virtual:section-lists).
 */
import { nationNames } from 'virtual:section-lists';
import type { SectionContents } from './sidebar-outline.ts';

/** The section's contents with a shared list filled in. */
export function withSharedLists(contents: SectionContents | undefined): SectionContents | undefined {
	if (contents?.entries?.list !== 'nations') return contents;
	return {
		...contents,
		entries: { ...contents.entries, items: nationNames.map(([label, id]) => ({ label, link: `/nations/${id}` })) }
	};
}
