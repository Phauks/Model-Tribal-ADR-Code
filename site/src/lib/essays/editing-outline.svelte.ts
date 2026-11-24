/**
 * What the essay page gives the sidebar while the essay is edited or
 * commented on (essay-editor-mockups/4 and v2-1): the essay's outline as the
 * draft stands, in place of the published headings, and the person's own
 * work, "Your work", under it. The page sets it as the editor opens and
 * clears it when the editor closes (EssayArticle.svelte); the sidebar uses it
 * only on the page it was set for (SiteSidebar.svelte).
 */
import type { OutlineItem } from '#lib/site-sections.ts';

/** The person's work, under "Your work" in the sidebar. */
export interface YourWork {
	/** Open review requests waiting on them. */
	reviewRequests: number;
	/** Comments that mention them, answer them or are assigned to them. */
	commentsForYou: number;
	/** Essays with versions they saved that are not published yet. */
	drafts: { title: string; link: string }[];
}

export interface EditingOutline {
	/** The page's address. */
	path: string;
	items: OutlineItem[];
	work: YourWork | null;
}

export const editingOutline = $state<{ current: EditingOutline | null }>({ current: null });
