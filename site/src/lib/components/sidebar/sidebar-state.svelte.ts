/**
 * What the sidebar has open, in one place (SiteSidebar.svelte). The wide
 * column and the phone menu share it, so they always agree.
 *
 * - Sections, and the Workspace group, remember being opened or shut from
 *   page to page, in this browser only. Until the reader chooses, the section
 *   being read is open and the others are shut.
 * - Entries inside an outline open along the way to the page or heading being
 *   read; what the reader opens or shuts there lasts until the next page.
 * - Every section's pages come with the page (sidebarLists, from the root
 *   layout), so nothing is loaded when a section opens. Only a page built
 *   ahead of time lacks the essays' lists, which come from the database; it
 *   reads them from /sidebar/<section>.json as it opens, and until they come
 *   those sections simply have no caret (src/lib/server/section-contents.ts).
 * - app.html opens and shuts the remembered sections before the page paints,
 *   with a style that restore() takes away once the sidebar applies them.
 */
import { parseSectionChoices, sectionChoicesKey } from '#lib/sidebar-outline.ts';
import type { OutlineItem } from '#lib/site-sections.ts';

/** Whether the reader hid the wide sidebar; read before the page paints in app.html. */
export const sidebarHiddenKey = 'sidebar-hidden';

/** The style app.html adds so remembered sections are open from the first paint. */
export const earlyChoicesStyleId = 'sidebar-early-choices';

export class SidebarState {
	sectionChoices = $state<Record<string, boolean>>({});
	itemChoices = $state<Record<string, boolean>>({});
	/** Lists read in the browser, for a page built without them. */
	fetched = $state<Record<string, OutlineItem[]>>({});
	#asked = new Set<string>();
	activeHeading = $state<string | undefined>(undefined);

	/** Reads the reader's choices once, when the sidebar starts. */
	restore(): void {
		try {
			this.sectionChoices = parseSectionChoices(localStorage.getItem(sectionChoicesKey));
		} catch {
			// Storage can be blocked; every section then starts as the defaults say.
		}
		document.getElementById(earlyChoicesStyleId)?.remove();
	}

	isOpen(key: string, byDefault: boolean): boolean {
		return this.sectionChoices[key] ?? byDefault;
	}

	setOpen(key: string, open: boolean): void {
		this.sectionChoices = { ...this.sectionChoices, [key]: open };
		try {
			localStorage.setItem(sectionChoicesKey, JSON.stringify(this.sectionChoices));
		} catch {
			// Nothing to remember with; the choice lasts for this page only.
		}
	}

	/** Reads a section's pages that the page came without, once. If they cannot be read, the section stays without a caret. */
	fetchList(sectionLink: string): void {
		if (this.#asked.has(sectionLink)) return;
		this.#asked.add(sectionLink);
		fetch(`/sidebar${sectionLink}.json`)
			.then((response) => (response.ok ? (response.json() as Promise<OutlineItem[]>) : Promise.reject(response.status)))
			.then((items) => (this.fetched = { ...this.fetched, [sectionLink]: items }))
			.catch(() => {
				// The section's name still links to its page.
			});
	}

	toggleItem(link: string, nowOpen: boolean): void {
		this.itemChoices = { ...this.itemChoices, [link]: !nowOpen };
	}

	/** On a new page, entries inside outlines open along the way to it again. */
	resetItems(): void {
		this.itemChoices = {};
	}
}

/** Forgets what the sidebar remembers on this device (Settings, Data). */
export function forgetSidebarChoices(): void {
	try {
		localStorage.removeItem(sectionChoicesKey);
		localStorage.removeItem(sidebarHiddenKey);
		delete document.documentElement.dataset.sidebarHidden;
	} catch {
		// Storage can be blocked; there is then nothing to forget.
	}
}
