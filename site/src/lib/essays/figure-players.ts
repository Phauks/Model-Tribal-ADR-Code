/**
 * The page side of essay figures (render.ts). A YouTube video shows only its
 * still frame until the reader presses it; then this swaps in YouTube's
 * privacy-enhanced player (youtube-nocookie.com), so readers who never play
 * a video never load a YouTube page. Before printing, every transcript is
 * unfolded so the printed page carries what was said.
 *
 * A figure's file is served only after the virus check passes; until then
 * its address answers 409 (docs/uploads.md). A picture or player that fails
 * to load is swapped for a line saying so, rather than a broken image.
 *
 * Used as a Svelte action on the element that holds an essay's HTML.
 */

/** Why a figure's file did not load: still in the virus check, or something else. */
export type FigureFileProblem = 'checking' | 'missing';

const problemWords: Record<FigureFileProblem, string> = {
	checking: 'This file is still being checked for viruses. It shows here once the check passes.',
	missing: 'This file could not be loaded.'
};

/**
 * Calls `onProblem` for each figure picture, video or recording under
 * `element` that fails to load, including one that failed before this
 * started watching. YouTube still frames are left alone.
 */
export function watchFigureFiles(
	element: HTMLElement,
	onProblem: (media: HTMLElement, problem: FigureFileProblem) => void
): { destroy(): void } {
	const seen = new WeakSet<HTMLElement>();
	const report = async (media: HTMLElement) => {
		if (seen.has(media) || media.closest('.essay-figure-youtube')) return;
		const address = media.getAttribute('src');
		if (!address?.startsWith('/files/')) return;
		seen.add(media);
		const answer = await fetch(address, { method: 'HEAD' }).catch(() => /* expected: the site could not be reached; the figure is shown as missing, and the server reports its own failures. */ null);
		onProblem(media, answer?.status === 409 ? 'checking' : 'missing');
	};
	const failed = (event: Event) => {
		const target = event.target as HTMLElement | null;
		if (target?.matches('.essay-figure :is(img, video, audio)')) void report(target);
	};
	element.addEventListener('error', failed, true);
	for (const media of element.querySelectorAll<HTMLImageElement | HTMLMediaElement>('.essay-figure :is(img, video, audio)')) {
		const broken = media instanceof HTMLImageElement ? media.complete && media.naturalWidth === 0 : media.error !== null;
		if (broken) void report(media);
	}
	return { destroy: () => element.removeEventListener('error', failed, true) };
}

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
	const watching = watchFigureFiles(element, (media, problem) => {
		const note = document.createElement('p');
		note.className = 'essay-figure-missing';
		note.textContent = problemWords[problem];
		media.replaceWith(note);
	});
	return {
		destroy() {
			element.removeEventListener('click', play);
			window.removeEventListener('beforeprint', unfold);
			watching.destroy();
		}
	};
}
