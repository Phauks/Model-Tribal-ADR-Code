/**
 * Joins a page's own masthead controls with the fallback every page has (the
 * site text's, src/lib/components/SiteTextEditor.svelte), for
 * page-editing.svelte.ts. Kept apart so tests can load it without Svelte.
 */
import type { PageControls, PageMode } from './page-editing.svelte.ts';

const modeOrder: readonly PageMode[] = ['reading', 'commenting', 'editing'];

/**
 * A page's own controls joined with a fallback's, so one Editing button
 * covers both: the page's editor where it has one, and the fallback's
 * editing (the site text) everywhere else on the page. While only the
 * fallback is editing, its drafts, History and Publish show.
 */
export function joinPageControls(own: PageControls, fallback: PageControls): PageControls {
	const fallbackEditing = () => fallback.mode === 'editing';
	return {
		modes: modeOrder.filter((mode) => own.modes.includes(mode) || fallback.modes.includes(mode)),
		get mode() {
			if (fallbackEditing()) return 'editing';
			return own.mode ?? 'reading';
		},
		setMode(chosen: PageMode) {
			fallback.setMode?.(fallback.modes.includes(chosen) ? chosen : 'reading');
			if (own.modes.includes(chosen)) own.setMode?.(chosen);
			else if (own.modes.includes('reading')) own.setMode?.('reading');
		},
		get drafts() {
			return (fallbackEditing() && !own.modes.includes('editing') ? fallback.drafts : own.drafts) ?? fallback.drafts ?? null;
		},
		links: own.links,
		get history() {
			return (fallbackEditing() && !own.modes.includes('editing') ? fallback.history : own.history) ?? fallback.history ?? null;
		},
		get publish() {
			// Site text waiting to be published comes first while editing; the page's own versions stay a click away in its History.
			if (fallbackEditing()) return fallback.publish ?? own.publish ?? null;
			return own.publish ?? fallback.publish ?? null;
		}
	};
}

