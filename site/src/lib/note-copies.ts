/**
 * Copies of a note placed right under the paragraph that cites it. The
 * "Show the note under the paragraph" setting (src/lib/components/InlineNotes.svelte)
 * opens one when a reader selects a note number, and the print option "Each
 * note under its paragraph" (src/lib/components/PrintOptions.svelte) adds one
 * for every note number just before the page prints.
 *
 * The copy is the note's entry in the Sources section
 * (src/lib/components/SourceList.svelte) without the list of facts it supports.
 */

/** The block a note copy goes after. */
export function noteBlock(marker: Element): Element | null {
	return marker.closest('p, li, dd, blockquote, td');
}

/** Makes a copy of the note a marker points to, or null when there is none. */
export function noteCopy(marker: HTMLAnchorElement, className: string): HTMLElement | null {
	const number = marker.textContent?.trim() ?? '';
	const entry = marker.hash ? document.getElementById(decodeURIComponent(marker.hash.slice(1))) : null;
	if (!entry) return null;
	const note = entry.cloneNode(true) as Element;
	note.querySelector('.source-uses')?.remove();
	// Copies carry no ids, so the page never has two elements with one id.
	for (const element of note.querySelectorAll('[id]')) element.removeAttribute('id');
	const shown = document.createElement('div');
	shown.className = className;
	shown.id = `inline-note-${number}-${Math.random().toString(36).slice(2, 8)}`;
	shown.setAttribute('role', 'note');
	shown.setAttribute('aria-label', `Note ${number}`);
	shown.innerHTML = `<p>${number}. ${note.innerHTML.trim()}</p>`;
	return shown;
}
