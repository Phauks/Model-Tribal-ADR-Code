/**
 * Places a menu that opens as a popover (the HTML popover attribute) under the
 * button that opens it: lined up with the button's left or right edge, kept
 * inside the window, and no taller than the room below. A popover sits above
 * everything, so a table's scrolling box can't cut it off, but it is placed
 * by hand. Used by the shared table's filter menus and list of columns
 * (DataTable.svelte) and by Build a table's filters.
 */
export type PopoverEdge = 'left' | 'right';

export function placeUnder(popover: HTMLElement, anchor: HTMLElement, edge: PopoverEdge): void {
	const box = anchor.getBoundingClientRect();
	const room = document.documentElement.clientWidth;
	const margin = 16;
	const width = popover.offsetWidth;
	const left = edge === 'right' ? box.right - width : box.left - 8;
	popover.style.left = `${Math.max(margin, Math.min(left, room - width - margin))}px`;
	popover.style.top = `${box.bottom + 6}px`;
	popover.style.maxHeight = `${Math.max(160, window.innerHeight - box.bottom - 6 - margin)}px`;
}

/**
 * Places the popover now and again whenever the page scrolls, the window
 * changes size, or any of `watched` changes size (the rows and controls above
 * a button move it as the reader ticks values). Focuses its first field.
 * Returns what stops it.
 */
export function keepPlaced(popover: HTMLElement, anchor: HTMLElement, edge: PopoverEdge, watched: Element[]): () => void {
	const place = () => placeUnder(popover, anchor, edge);
	place();
	popover.querySelector<HTMLElement>('input:not([type="checkbox"]), input[type="checkbox"]:not(:disabled)')?.focus();
	window.addEventListener('scroll', place, true);
	window.addEventListener('resize', place);
	const resized = new ResizeObserver(place);
	for (const element of watched) resized.observe(element);
	return () => {
		window.removeEventListener('scroll', place, true);
		window.removeEventListener('resize', place);
		resized.disconnect();
	};
}
