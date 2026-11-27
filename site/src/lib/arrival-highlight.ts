/**
 * The place a link goes to on a page, such as a source in the References list or the marker a
 * source's number links back to, is highlighted for a moment, so the eye finds it (site/DESIGN.md,
 * section 6, "Citations"). It arrives marked in the fill-in yellow, which fades to the resting
 * highlight, and the highlight goes away a few seconds later, or as soon as the reader clicks or
 * taps anywhere else. Trevor reported on Nov. 27, 2026 that the highlight stayed: "once i selected a
 * citation, a highlighted yellow field around it would not go away." The browser's own `:target`
 * lasts until the address changes again, so with scripts on the highlight follows the
 * `data-arrived` attribute this module adds and takes away; without scripts, `:target` still
 * shows it (global.css).
 *
 * Nothing here moves focus: the browser and SvelteKit already do that when they go to the place,
 * and the focus ring (global.css, `:focus-visible`) is drawn apart from this highlight, so it stays
 * visible after the highlight goes.
 *
 * This module must load in Node (for tests and prerendering); anything that needs a browser
 * checks for it first.
 */

/** The attribute the arrival styles in global.css (and some pages) look for. */
export const arrivedAttribute = 'data-arrived';

/** How long the highlight stays, counted from arrival: the 1.6 s fade and a short rest. */
export const arrivalFor = 4000;

/** How long to wait for a place a list fetches later, such as a long References list (LazySourceList.svelte). */
export const waitForPlaceFor = 5000;

interface Arrival {
	element: Element;
	timer: ReturnType<typeof setTimeout>;
}

let current: Arrival | undefined;
let waiting: { observer: MutationObserver; timer: ReturnType<typeof setTimeout> } | undefined;

/** The element now highlighted, if any. */
export function arrivedElement(): Element | undefined {
	return current?.element;
}

/** Takes the highlight away now. */
export function clearArrival(): void {
	if (!current) return;
	clearTimeout(current.timer);
	current.element.removeAttribute(arrivedAttribute);
	current = undefined;
}

function stopWaiting(): void {
	if (!waiting) return;
	waiting.observer.disconnect();
	clearTimeout(waiting.timer);
	waiting = undefined;
}

/** Highlights one element, starting its fade again if it was already highlighted. */
export function markElement(element: Element): void {
	stopWaiting();
	clearArrival();
	// Reading the layout between taking the attribute away and putting it back starts the fade again.
	void (element as HTMLElement).offsetWidth;
	element.setAttribute(arrivedAttribute, '');
	current = { element, timer: setTimeout(clearArrival, arrivalFor) };
}

/** The id a fragment such as "#source-3" names, or undefined for an empty one. */
export function fragmentId(hash: string): string | undefined {
	const raw = hash.startsWith('#') ? hash.slice(1) : hash;
	if (!raw) return undefined;
	try {
		return decodeURIComponent(raw);
	} catch {
		// expected: a fragment that does not decode is used as typed.
		return raw;
	}
}

/**
 * Highlights the element with this id. When it is not on the page yet, as with a References list
 * that is fetched once the address points into it, waits a few seconds for it to appear.
 */
export function markArrival(id: string): void {
	if (typeof document === 'undefined') return;
	const element = document.getElementById(id);
	if (element) {
		markElement(element);
		return;
	}
	stopWaiting();
	clearArrival();
	const observer = new MutationObserver(() => {
		const found = document.getElementById(id);
		if (found) markElement(found);
	});
	observer.observe(document.body, { childList: true, subtree: true });
	waiting = { observer, timer: setTimeout(stopWaiting, waitForPlaceFor) };
}

/** Highlights the place the address now points to, unless it is the one already highlighted. */
function fromAddress(): void {
	const id = fragmentId(location.hash);
	if (!id) {
		stopWaiting();
		clearArrival();
		return;
	}
	if (current?.element.id === id) return;
	markArrival(id);
}

/** The id a link goes to on this same page, or undefined for a link to another page. */
export function samePageTarget(link: HTMLAnchorElement, here: Location | URL): string | undefined {
	if (!link.hash) return undefined;
	if (link.origin !== here.origin || link.pathname !== here.pathname || link.search !== here.search) return undefined;
	return fragmentId(link.hash);
}

/**
 * Starts watching for arrivals: when the page opens at an address with a fragment, when the
 * fragment changes (a link on the page, Back or Forward), and when a reader selects a link to the
 * place the address already points to, which changes nothing in the address. A press of the
 * pointer anywhere outside the highlighted place takes the highlight away. Returns the function
 * that stops watching.
 */
export function watchArrivals(): () => void {
	const onClick = (event: MouseEvent) => {
		// SvelteKit itself cancels the click on a link to the place already in the address, so a cancelled click still counts; a click that opens a new tab or window does not.
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		const link = (event.target as Element | null)?.closest?.('a[href*="#"]');
		if (!(link instanceof HTMLAnchorElement)) return;
		const id = samePageTarget(link, location);
		if (!id) return;
		// After the browser or SvelteKit has gone to the place, so it is open and in view.
		setTimeout(() => {
			if (current?.element.id !== id) markArrival(id);
		});
	};
	const onPointerDown = (event: PointerEvent) => {
		const target = event.target as Node | null;
		if (current && target && current.element.contains(target)) return;
		clearArrival();
	};
	window.addEventListener('hashchange', fromAddress);
	document.addEventListener('click', onClick);
	document.addEventListener('pointerdown', onPointerDown, true);
	return () => {
		window.removeEventListener('hashchange', fromAddress);
		document.removeEventListener('click', onClick);
		document.removeEventListener('pointerdown', onPointerDown, true);
		stopWaiting();
		clearArrival();
	};
}

/** For SvelteKit's afterNavigate: a page opened at an address with a fragment highlights the place. */
export function arriveAfterNavigate(): void {
	fromAddress();
}
