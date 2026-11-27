/**
 * Whether the page's first render in the browser has finished.
 *
 * Parts of a page drawn on the server are first taken over by the browser (hydration), and must start the way the server drew them; their buttons appear once the browser has them. A part made later, such as a map view's table fetched when the view is chosen, has nothing to match, so it can start with its buttons and be drawn once rather than twice. The site's layout marks the start (src/routes/+layout.svelte) once every part of the first page is running.
 */
let started = false;

export function pageStarted(): boolean {
	return started;
}

export function markPageStarted(): void {
	started = true;
	// Also on the page, as <html data-started="on">, for the checks that press the page's controls (tools/check-accessibility-live.mjs): a control pressed before the page has started may not answer yet.
	document.documentElement.dataset.started = 'on';
}
