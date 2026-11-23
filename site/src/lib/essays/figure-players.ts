/**
 * The page side of essay figures (render.ts). A YouTube video shows only its
 * still frame until the reader presses it; then this swaps in YouTube's
 * privacy-enhanced player (youtube-nocookie.com), so readers who never play
 * a video never load a YouTube page. Before printing, every transcript is
 * unfolded so the printed page carries what was said.
 *
 * Used as a Svelte action on the element that holds an essay's HTML.
 */
export function figurePlayers(element: HTMLElement): { destroy(): void } {
	const play = (event: MouseEvent) => {
		if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a.essay-figure-youtube');
		const embed = link?.dataset.embed;
		if (!link || !embed || !element.contains(link)) return;
		event.preventDefault();
		const frame = document.createElement('iframe');
		frame.className = 'essay-figure-frame';
		frame.src = `${embed}?autoplay=1`;
		frame.title = link.dataset.title || 'Video';
		frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
		frame.referrerPolicy = 'strict-origin-when-cross-origin';
		frame.allowFullscreen = true;
		link.replaceWith(frame);
		frame.focus();
	};
	const unfold = () => {
		for (const transcript of element.querySelectorAll<HTMLDetailsElement>('details.essay-figure-transcript')) transcript.open = true;
	};
	element.addEventListener('click', play);
	window.addEventListener('beforeprint', unfold);
	return {
		destroy() {
			element.removeEventListener('click', play);
			window.removeEventListener('beforeprint', unfold);
		}
	};
}
