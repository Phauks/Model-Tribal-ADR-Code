/**
 * What the masthead offers a person who can work on the page they are on:
 * Reading, Commenting and Editing, whether draft changes show, History and
 * Publish, and while editing a second row with the editor's tools (Trevor,
 * Nov. 23, 2026: "put the reading, edit, history, and publish in the header,
 * so that pages look exactly how they will"; option A of
 * design/header-page-controls, approved the same day). The page itself then
 * starts where it does for readers.
 *
 * A page offers its controls with offerPageControls() when it knows what the
 * person may do, and the masthead shows the newest offer
 * (PageControls.svelte). Offers stack, so a layout can offer a fallback for
 * every page, which joins the page's own offer while the page is open. Pass
 * getters for values that change, such as the mode, so the masthead follows
 * them.
 */
import { untrack, type Snippet } from 'svelte';
import { joinPageControls } from './join-page-controls.ts';

export type PageMode = 'reading' | 'commenting' | 'editing';

export interface PagePublish {
	/** The button's tooltip and accessible name, such as "Publish version 4 for readers". */
	title: string;
	/** A page to go to, such as the list of versions to choose from. */
	href?: string;
	/** Or a form to post, with its hidden fields. */
	action?: string;
	fields?: Record<string, string>;
	/** Or something to do on the page, such as opening a list of the changes to publish. */
	onclick?: () => void;
	/** How many drafts wait to be published, shown on the button when more than one (or one, with onclick). */
	count?: number;
}

export interface PageLink {
	title: string;
	href: string;
	icon: 'edit' | 'team';
}

export interface PageControls {
	/** The modes the person may choose; none hides the choice. */
	modes: readonly PageMode[];
	mode?: PageMode;
	setMode?: (mode: PageMode) => void;
	/** Whether draft changes show, where there is a published text to compare them with. */
	drafts?: { shown: boolean; set: (shown: boolean) => void } | null;
	/** Links for a page edited elsewhere, such as a nation's page. */
	links?: readonly PageLink[];
	history?: { title: string; href: string } | null;
	publish?: PagePublish | null;
}

// Raw, so the getters a page passes are kept as they are, not copied into state.
let offers = $state.raw<{ controls: PageControls; fallback: boolean }[]>([]);

/** The controls the masthead shows now, or null on a page that offers none. */
export function currentPageControls(): PageControls | null {
	const own = offers.findLast((offer) => !offer.fallback)?.controls;
	const fallback = offers.findLast((offer) => offer.fallback)?.controls;
	if (own && fallback) return joinPageControls(own, fallback);
	return own ?? fallback ?? null;
}

/**
 * Offers the page's controls to the masthead; call the returned function to
 * take them back. A fallback, such as the site text's controls that every
 * page has (src/lib/components/SiteTextEditor.svelte), is joined to the
 * page's own offer (joinPageControls), whenever either was offered.
 */
export function offerPageControls(controls: PageControls, { fallback = false }: { fallback?: boolean } = {}): () => void {
	const offer = { controls, fallback };
	// Read without tracking, so a page can offer from an effect without that effect depending on the list.
	offers = [...untrack(() => offers), offer];
	return () => {
		offers = offers.filter((each) => each !== offer);
	};
}

let tools = $state.raw<{ snippet: Snippet }[]>([]);

/** The editor's tools, shown in a second row of the masthead while editing, or null. */
export function currentPageTools(): Snippet | null {
	return tools.at(-1)?.snippet ?? null;
}

/**
 * Puts an editor's tools in the masthead's second row while the editor is
 * open; call the returned function when it closes. The snippet keeps the
 * editor's own state and styles wherever it is shown.
 */
export function offerPageTools(snippet: Snippet): () => void {
	const offer = { snippet };
	tools = [...untrack(() => tools), offer];
	return () => {
		tools = tools.filter((each) => each !== offer);
	};
}
