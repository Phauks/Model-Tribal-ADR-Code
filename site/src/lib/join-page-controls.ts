/**
 * Joins a page's own masthead controls with the fallbacks every page has (the
 * site text's, src/lib/components/SiteTextEditor.svelte, and the page's
 * comments, src/lib/components/PageComments.svelte), for
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
	// A page with comments of its own, such as an essay, keeps Commenting for them (src/lib/components/PageComments.svelte stays out).
	const fallbackTakes = (mode: PageMode) => fallback.modes.includes(mode) && (mode !== 'commenting' || !own.modes.includes('commenting'));
	return {
		modes: modeOrder.filter((mode) => own.modes.includes(mode) || fallback.modes.includes(mode)),
		get mode() {
			if (fallbackEditing()) return 'editing';
			if (fallback.mode === 'commenting' && fallbackTakes('commenting')) return 'commenting';
			return own.mode ?? 'reading';
		},
		setMode(chosen: PageMode) {
			fallback.setMode?.(fallbackTakes(chosen) ? chosen : 'reading');
			if (own.modes.includes(chosen)) own.setMode?.(chosen);
			else if (own.modes.includes('reading')) own.setMode?.('reading');
		},
		get openComments() {
			return own.modes.includes('commenting') ? own.openComments : (fallback.openComments ?? own.openComments);
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


/**
 * Several fallbacks joined into one, such as the site text's Editing and the
 * page's Commenting: each takes the modes it offers and reads otherwise, and
 * the one not reading leads, with its drafts, History and Publish.
 */
export function joinFallbacks(fallbacks: readonly PageControls[]): PageControls {
	const leading = () => fallbacks.find((each) => (each.mode ?? 'reading') !== 'reading');
	const first = <Key extends 'drafts' | 'history' | 'publish'>(key: Key): PageControls[Key] | null => {
		const lead = leading();
		if (lead && lead[key]) return lead[key];
		return fallbacks.map((each) => each[key]).find((value) => value) ?? null;
	};
	return {
		modes: modeOrder.filter((mode) => fallbacks.some((each) => each.modes.includes(mode))),
		get mode() {
			return leading()?.mode ?? 'reading';
		},
		setMode(chosen: PageMode) {
			for (const each of fallbacks) each.setMode?.(each.modes.includes(chosen) ? chosen : 'reading');
		},
		get drafts() {
			return first('drafts');
		},
		links: fallbacks.flatMap((each) => each.links ?? []),
		get history() {
			return first('history');
		},
		get publish() {
			return first('publish');
		},
		get openComments() {
			return fallbacks.map((each) => each.openComments).find((count) => count !== undefined);
		}
	};
}
