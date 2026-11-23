/**
 * What the sidebar has open, in one place (SiteSidebar.svelte). The wide
 * column and the phone menu share it, so they always agree.
 *
 * - Sections, and the Workspace group, remember being opened or shut from
 *   page to page, in this browser only. Until the reader chooses, the section
 *   being read is open and the others are shut.
 * - Entries inside an outline open along the way to the page or heading being
 *   read; what the reader opens or shuts there lasts until the next page.
 * - The pages of a section the reader opens from elsewhere are fetched once,
 *   from /sidebar/<section>.json (src/lib/server/section-contents.ts).
 */
import { parseSectionChoices, sectionChoicesKey } from '#lib/sidebar-outline.ts';
import type { OutlineItem } from '#lib/site-sections.ts';

/** Whether the reader hid the wide sidebar; read before the page paints in app.html. */
export const sidebarHiddenKey = 'sidebar-hidden';

export type LoadedPages = OutlineItem[] | 'loading' | 'failed';

export class SidebarState {
	sectionChoices = $state<Record<string, boolean>>({});
	itemChoices = $state<Record<string, boolean>>({});
	loaded = $state<Record<string, LoadedPages>>({});
	activeHeading = $state<string | undefined>(undefined);

	/** Reads the reader's choices once, when the sidebar starts. */
	restore(): void {
		try {
			this.sectionChoices = parseSectionChoices(localStorage.getItem(sectionChoicesKey));
		} catch {
			// Storage can be blocked; every section then starts as the defaults say.
		}
	}

	isOpen(key: string, byDefault: boolean): boolean {
		return this.sectionChoices[key] ?? byDefault;
	}

	setOpen(key: string, open: boolean): void {
		this.sectionChoices = { ...this.sectionChoices, [key]: open };
		// A list that failed is tried again when the reader opens it again.
		if (open && this.loaded[key] === 'failed') {
			this.loaded = Object.fromEntries(Object.entries(this.loaded).filter(([link]) => link !== key));
		}
		try {
			localStorage.setItem(sectionChoicesKey, JSON.stringify(this.sectionChoices));
		} catch {
			// Nothing to remember with; the choice lasts for this page only.
		}
	}

	/** Fetches a section's pages, once. */
	load(sectionLink: string): void {
		if (this.loaded[sectionLink]) return;
		this.loaded = { ...this.loaded, [sectionLink]: 'loading' };
		fetch(`/sidebar${sectionLink}.json`)
			.then((response) => (response.ok ? (response.json() as Promise<OutlineItem[]>) : Promise.reject(response.status)))
			.then((items) => (this.loaded = { ...this.loaded, [sectionLink]: items }))
			.catch(() => (this.loaded = { ...this.loaded, [sectionLink]: 'failed' }));
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
