/**
 * Copying to the clipboard, and keeping the page address in step with what the reader has chosen so a copied link opens the same view.
 */

/** Copies plain text. Rejects when the browser refuses or has no Clipboard API, so each caller can say what to do by hand. */
export async function copyText(text: string): Promise<void> {
	await navigator.clipboard.writeText(text);
}

/** Copies text with an HTML version, for editors that keep formatting, or the text alone where the browser can't write both. Rejects when the browser refuses. */
export async function copyRichText(text: string, html: string): Promise<void> {
	if (typeof ClipboardItem === 'function' && navigator.clipboard?.write) {
		await navigator.clipboard.write([
			new ClipboardItem({
				'text/plain': new Blob([text], { type: 'text/plain' }),
				'text/html': new Blob([html], { type: 'text/html' })
			})
		]);
	} else {
		await navigator.clipboard.writeText(text);
	}
}

/** Copies the page's address and returns the line to show: that it was copied, or the address to copy by hand. */
export async function copyPageLink(): Promise<string> {
	try {
		await copyText(location.href);
		return 'Link copied.';
	} catch {
		// expected: the browser would not copy; the reader is shown the address to copy by hand.
		return `Copy this link: ${location.href}`;
	}
}

/** Puts a new query string in the address bar, keeping the path and the #fragment, without adding to the browser's history. Does nothing when the address would not change. */
export function replaceAddressSearch(search: string): void {
	const next = `${location.pathname}${search ? `?${search}` : ''}${location.hash}`;
	if (next !== `${location.pathname}${location.search}${location.hash}`) {
		history.replaceState(history.state, '', next);
	}
}
