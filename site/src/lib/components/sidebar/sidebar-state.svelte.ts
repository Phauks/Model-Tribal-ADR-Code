/**
 * What the sidebar has open, in one place (SiteSidebar.svelte). The wide
 * column and the phone menu share it, so they always agree.
 *
 * - The Workspace group remembers being opened or shut from page to page, in
 *   this browser only.
 * - Entries in the second column open along the way to the page or heading
 *   being read; what the reader opens or shuts there lasts until the next page.
 */
import { parseSectionChoices, sectionChoicesKey } from '#lib/sidebar-outline.ts';

/** Whether the reader hid the wide sidebar; read before the page paints in app.html. */
export const sidebarHiddenKey = 'sidebar-hidden';

export class SidebarState {
	sectionChoices = $state<Record<string, boolean>>({});
	itemChoices = $state<Record<string, boolean>>({});
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
		try {
			localStorage.setItem(sectionChoicesKey, JSON.stringify(this.sectionChoices));
		} catch {
			// Nothing to remember with; the choice lasts for this page only.
		}
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
