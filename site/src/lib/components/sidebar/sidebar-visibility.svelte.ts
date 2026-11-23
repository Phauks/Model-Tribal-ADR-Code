/**
 * Whether the wide sidebar is shown (SiteSidebar.svelte). The button that
 * hides and shows it sits at the top left of the masthead, beside the site's
 * name (SiteHeader.svelte), and Ctrl+\ or Command+\ does the same (Trevor,
 * Nov. 23, 2026). Hidden, the sidebar is gone and the page takes the whole
 * width. The choice is remembered on this device, and app.html marks the page
 * before it is drawn, so a hidden sidebar never flashes open.
 */
import { sidebarHiddenKey } from './sidebar-state.svelte.ts';

export const sidebarVisibility = $state({ shown: true });

/** Reads the reader's choice, once the page has started. */
export function restoreSidebarVisibility(): void {
	sidebarVisibility.shown = document.documentElement.dataset.sidebarHidden !== 'true';
}

export function setSidebarShown(shown: boolean): void {
	sidebarVisibility.shown = shown;
	if (shown) delete document.documentElement.dataset.sidebarHidden;
	else document.documentElement.dataset.sidebarHidden = 'true';
	try {
		localStorage.setItem(sidebarHiddenKey, String(!shown));
	} catch {
		// Nothing to remember with; the choice lasts for this page only.
	}
}

export function toggleSidebar(): void {
	setSidebarShown(!sidebarVisibility.shown);
}

/** Ctrl+\ (Command+\ on a Mac) hides or shows the sidebar, as in many editors. */
export function isSidebarShortcut(event: KeyboardEvent): boolean {
	return event.key === '\\' && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey;
}
