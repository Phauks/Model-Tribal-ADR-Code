/**
 * A Svelte attachment for boxes that scroll sideways, such as wide tables on
 * a phone. While the box's content is wider than the box, the box takes
 * keyboard focus, so a keyboard user can scroll it with the arrow keys
 * (WCAG 2.1.1, keyboard). When everything fits, it is left out of the tab
 * order so it adds no empty stop.
 *
 * Use: <div class="table-scroll" role="region" aria-label="…" {@attach keyboardScroll}>
 */
export function keyboardScroll(box: HTMLElement): () => void {
	const update = () => {
		if (box.scrollWidth > box.clientWidth) box.tabIndex = 0;
		else box.removeAttribute('tabindex');
	};
	update();
	const observer = new ResizeObserver(update);
	observer.observe(box);
	if (box.firstElementChild) observer.observe(box.firstElementChild);
	return () => observer.disconnect();
}
