/**
 * Tools a page puts in the left sidebar, in place of the section's pages: the search page's Show,
 * Sort, Files and nation filters (Trevor asked on Nov. 27, 2026 that search use the left sidebar for
 * its tools; design/search-download/revision-3). On a wide screen they fill the column under the
 * tools' title; on a phone they open from their own sheet beside Menu (SiteSidebar.svelte).
 *
 * The snippet is drawn once in each place, so it is given a word to keep its ids apart.
 */
import { untrack, type Snippet } from 'svelte';

export interface SidebarTools {
	/** The column's title, such as "Search". */
	title: string;
	/** What the phone strip's button says, such as "Search tools". */
	sheetLabel: string;
	tools: Snippet<[string]>;
}

let offered = $state<SidebarTools[]>([]);

/** The tools the page being read offers, the latest first; undefined when it offers none. */
export const sidebarTools = {
	get current(): SidebarTools | undefined {
		return offered.at(-1);
	}
};

/** Puts a page's tools in the sidebar until the function it returns is called, when the page goes. */
export function offerSidebarTools(tools: SidebarTools): () => void {
	offered = [...untrack(() => offered), tools];
	return () => {
		offered = offered.filter((each) => each !== tools);
	};
}
