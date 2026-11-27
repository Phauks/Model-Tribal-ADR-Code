/**
 * A SHA-256 a reader copies with one click (Trevor, Nov. 24, 2026: "allow clicking a sha-256 to
 * copy to clipboard"). Every hash the site shows uses this one piece of markup, whether a Svelte
 * page draws it (src/lib/components/CopyHash.svelte) or it is built as HTML text, as a citation's
 * saved copy line is (src/lib/server/markdown.ts). The site's layout listens for clicks on any
 * page and copies the hash of the button clicked (copyHashOnClick).
 *
 * The hash itself is the button, so it is reached with Tab and copied with Enter or Space. It is
 * shaded on hover and glows for a moment once copied, with no icon or word beside it (Trevor, Nov.
 * 24, 2026: "we don't need it to say copied or have the copy symbol"); a status line after the
 * button tells a screen reader. Where a line names the hash without showing it, such as "SHA-256"
 * in a citation's saved copy line, the button is a copy icon alone, which turns to a check and
 * shows "Copied" beside it.
 */
import { escapeHtml } from './escape-html.ts';
import { copyText } from '#lib/clipboard.ts';

/** How long the glow, or the check and "Copied", show. */
export const copiedFor = 2000;

// Lucide 1.77.0 (ISC; LICENSES/Lucide.txt): copy and check, written out because the markup is also built as HTML text.
const copyIcon =
	'<svg class="copy-hash-icon copy-hash-copy" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
const checkIcon =
	'<svg class="copy-hash-icon copy-hash-check" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 6 9 17l-5-5"/></svg>';

/**
 * The markup for one hash. `label` names the file the hash belongs to for a screen reader, such
 * as "the CSV file"; `iconOnly` shows the copy icon without the hash.
 */
export function copyHashHtml(sha256: string, options: { label?: string; iconOnly?: boolean } = {}): string {
	const hash = escapeHtml(sha256);
	const of = options.label ? ` of ${escapeHtml(options.label)}` : '';
	// A shown hash is the button's own name, so what a reader sees is what a screen reader says (WCAG 2.5.3).
	const body = options.iconOnly
		? `${copyIcon}${checkIcon}`
		: `<code class="copy-hash-text">${hash}</code><span class="visually-hidden">, copy the SHA-256${of}</span>`;
	const name = options.iconOnly ? ` aria-label="Copy the SHA-256${of}"` : '';
	return (
		`<span class="copy-hash${options.iconOnly ? ' copy-hash-icon-only' : ''}">` +
		`<button type="button" class="copy-hash-button" data-sha256="${hash}"${name} title="Copy">${body}</button>` +
		`<span class="copy-hash-status" role="status"></span></span>`
	);
}

const timers = new WeakMap<Element, ReturnType<typeof setTimeout>>();

/** Writes text to the clipboard, falling back to a hidden text box where the Clipboard API is missing. */
async function writeText(text: string): Promise<boolean> {
	try {
		await copyText(text);
		return true;
	} catch {
		// expected: no Clipboard API, or it refused; the hidden text box below copies instead.
		const field = document.createElement('textarea');
		field.value = text;
		field.setAttribute('readonly', '');
		field.style.position = 'fixed';
		field.style.opacity = '0';
		document.body.append(field);
		field.select();
		const done = document.execCommand?.('copy') ?? false;
		field.remove();
		return done;
	}
}

/** Copies the hash of a copy button that was clicked; the site's layout listens for clicks on any page. */
export async function copyHashOnClick(event: MouseEvent): Promise<void> {
	const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('.copy-hash-button') : null;
	const sha256 = button?.dataset.sha256;
	if (!button || !sha256) return;
	event.preventDefault();
	const status = button.nextElementSibling;
	const copied = await writeText(sha256);
	button.dataset.copied = copied ? 'yes' : 'no';
	button.title = copied ? 'Copied' : 'Could not copy';
	if (status) status.textContent = copied ? 'Copied' : 'Could not copy. Select the SHA-256 and copy it yourself.';
	clearTimeout(timers.get(button));
	timers.set(
		button,
		setTimeout(() => {
			delete button.dataset.copied;
			button.title = 'Copy';
			if (status) status.textContent = '';
		}, copiedFor)
	);
}
