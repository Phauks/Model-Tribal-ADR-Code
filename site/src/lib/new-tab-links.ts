/**
 * A Svelte attachment that makes every link to another website inside an
 * element open in a new tab, as Trevor asked for nation pages on Nov. 22, 2026
 * (site/DESIGN.md, section 6, "Links stay on the site"). Links within this
 * site keep opening in the same tab.
 *
 * Each outside link gets target="_blank" and rel="noopener noreferrer", so the
 * new page cannot reach back into this one, and aria-describedby pointing to
 * one hidden note, "Opens in a new tab", so screen readers announce it
 * (WCAG technique G201). The page must hold that note:
 *
 *   <span id={newTabNoteId} hidden>Opens in a new tab</span>
 *   <article {@attach outsideLinksOpenInNewTab}>…</article>
 *
 * Links added later, for example when the reader moves to another nation's
 * page, are handled as they appear.
 */
export const newTabNoteId = 'new-tab-note';

/** Whether a link's address goes to another website than `origin`. */
export function isOutsideLink(href: string, origin: string): boolean {
	if (!URL.canParse(href, origin)) return false;
	const url = new URL(href, origin);
	return (url.protocol === 'https:' || url.protocol === 'http:') && url.origin !== origin;
}

function markOutsideLinks(root: HTMLElement): void {
	for (const link of root.querySelectorAll<HTMLAnchorElement>('a[href]')) {
		if (link.target === '_blank' || !isOutsideLink(link.getAttribute('href') ?? '', location.origin)) continue;
		link.target = '_blank';
		link.rel = 'noopener noreferrer';
		const described = link.getAttribute('aria-describedby');
		link.setAttribute('aria-describedby', described ? `${described} ${newTabNoteId}` : newTabNoteId);
	}
}

export function outsideLinksOpenInNewTab(root: HTMLElement): () => void {
	markOutsideLinks(root);
	const observer = new MutationObserver(() => markOutsideLinks(root));
	observer.observe(root, { childList: true, subtree: true });
	return () => observer.disconnect();
}
