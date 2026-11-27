/**
 * Pictures load before the page prints. Pictures on long pages, such as an
 * essay's figures, load only when the reader scrolls near them
 * (loading="lazy"), and a browser asked to print may take its snapshot
 * before they arrive, leaving a blank where a picture should be (seen in
 * Chromium while checking essay pictures in print, Nov. 26, 2026). The Print
 * dialog waits for them; the browser's own Print command gets them started.
 */

/** Asks every picture still waiting to be scrolled to for its file now. */
export function startLoadingPictures(root: ParentNode = document): HTMLImageElement[] {
	const waiting = [...root.querySelectorAll<HTMLImageElement>('img[loading="lazy"]')];
	for (const picture of waiting) picture.loading = 'eager';
	return waiting;
}

/** Loads every picture on the page, waiting at most `limit` milliseconds, so a slow file never holds up printing for long. */
export async function loadPicturesForPrint(root: ParentNode = document, limit = 5000): Promise<void> {
	startLoadingPictures(root);
	const pending = [...root.querySelectorAll<HTMLImageElement>('img')].filter((picture) => !picture.complete);
	if (!pending.length) return;
	const loaded = Promise.all(
		pending.map(
			(picture) =>
				new Promise<void>((resolve) => {
					picture.addEventListener('load', () => resolve(), { once: true });
					picture.addEventListener('error', () => resolve(), { once: true });
				})
		)
	);
	await Promise.race([loaded, new Promise<void>((resolve) => setTimeout(resolve, limit))]);
}
