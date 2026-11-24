/**
 * Copies of a source's entry in the Sources section
 * (src/lib/components/SourceList.svelte), shown away from the list:
 *
 * - the preview a marker shows when pointed at (src/lib/components/CitationPopup.svelte);
 * - the copy right under the paragraph that the "Show the note under the
 *   paragraph" setting opens (src/lib/components/InlineNotes.svelte);
 * - the copies the print option "Each note under its paragraph"
 *   (src/lib/components/PrintOptions.svelte) adds just before the page prints.
 *
 * A copy is the citation alone: without the list of facts the source
 * supports, without the number and the links back to the text, and without ids, so the page
 * never has two elements with one id.
 */

/** The block a note copy goes after. */
export function noteBlock(marker: Element): Element | null {
	return marker.closest('p, li, dd, blockquote, td');
}

/** The Sources entry a marker points to, or null when the page has none. */
export function noteEntry(marker: HTMLAnchorElement): Element | null {
	return marker.hash ? document.getElementById(decodeURIComponent(marker.hash.slice(1))) : null;
}

/**
 * The citation in a Sources entry, as HTML. With newTab, each link to
 * another site opens in a new tab and says so to screen readers, so a
 * reader keeps their place on the page.
 */
export function citationHtml(entry: Element, { newTab = false } = {}): string {
	const note = entry.cloneNode(true) as Element;
	for (const extra of note.querySelectorAll('.source-uses, .source-backlinks, .source-cited')) extra.remove();
	for (const element of note.querySelectorAll('[id]')) element.removeAttribute('id');
	// A copy starts with its places to read it closed, whatever the reader opened in the list (src/lib/reading-links.ts).
	for (const toggle of note.querySelectorAll('.reading-toggle')) toggle.setAttribute('aria-expanded', 'false');
	if (newTab) {
		for (const link of note.querySelectorAll<HTMLAnchorElement>('a[href]')) {
			if (link.origin === location.origin) continue;
			link.target = '_blank';
			link.rel = 'noopener noreferrer';
			const hint = document.createElement('span');
			hint.className = 'visually-hidden';
			hint.textContent = ' (opens in a new tab)';
			link.append(hint);
		}
	}
	return note.innerHTML.trim();
}

/** Makes a copy of the note a marker points to, or null when there is none. */
export function noteCopy(marker: HTMLAnchorElement, className: string): HTMLElement | null {
	const number = marker.textContent?.trim() ?? '';
	const entry = noteEntry(marker);
	if (!entry) return null;
	const shown = document.createElement('div');
	shown.className = className;
	shown.id = `inline-note-${number}-${Math.random().toString(36).slice(2, 8)}`;
	shown.setAttribute('role', 'note');
	shown.setAttribute('aria-label', `Note ${number}`);
	shown.innerHTML = `<p>${number}. ${citationHtml(entry)}</p>`;
	return shown;
}
