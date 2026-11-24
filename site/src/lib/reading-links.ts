/**
 * The other places a reader can read a cited case or law: official texts
 * (GovInfo, eCFR, the Office of the Law Revision Counsel, the Library of
 * Congress, the Supreme Court), free sites (CourtListener, Justia, Oyez,
 * Cornell LII, Google Scholar), subscription services (Westlaw, Lexis) and
 * Wikipedia as further reading. scripts/caselaw/reading_links.py finds and checks
 * them from the settings in research/reading-links/sites.yaml and writes them
 * into each source record's `reading_links` block (Trevor, Nov. 23, 2026).
 *
 * One rule for every page: every citation that prints a source record (the
 * Sources lists, essays, glossary, stories, case and law boxes) calls
 * readingLinksHtml() after the citation, so a case reads the same wherever it
 * is cited.
 */

export type ReadingAccess = 'official' | 'free' | 'subscription' | 'background';

export interface ReadingLink {
	site: string;
	label: string;
	access: ReadingAccess;
	link: string;
	/** The site turns away automated checks; the link follows its own stable address pattern. */
	unchecked?: boolean;
}

export interface ReadingLinks {
	checked: string;
	links: ReadingLink[];
}

const libraryOfCongressItem = /^https:\/\/www\.loc\.gov\/item\/usrep(\d{3})(\d{3,4})\/?$/;

/**
 * The PDFs of a Supreme Court case's official report among its reading
 * links: the Library of Congress scan of the United States Reports, whose PDF
 * sits at a fixed address beside the item page, and the Court's own slip
 * opinion or preliminary print. The site keeps its own copy of each
 * (tools/fetch-public-copies.mjs), so a case's text is on this site even when
 * its record cites a web page.
 */
export function officialReportLinks(readingLinks: ReadingLinks | undefined): string[] {
	const found: string[] = [];
	for (const entry of readingLinks?.links ?? []) {
		const item = entry.site === 'library-of-congress' ? libraryOfCongressItem.exec(entry.link) : null;
		if (item) {
			const name = `usrep${item[1]}${item[2]}`;
			found.push(`https://tile.loc.gov/storage-services/service/ll/usrep/usrep${item[1]}/${name}/${name}.pdf`);
		} else if (entry.site === 'supremecourt') {
			found.push(entry.link);
		}
	}
	return found;
}

function escapeHtml(text: string): string {
	return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

/** The links in reading order, grouped: official and free texts, then subscription services, then background. */
export function readingLinkGroups(links: ReadingLink[] = []): { access: 'read' | 'subscription' | 'background'; links: ReadingLink[] }[] {
	const groups = [
		{ access: 'read' as const, links: links.filter((link) => link.access === 'official' || link.access === 'free') },
		{ access: 'subscription' as const, links: links.filter((link) => link.access === 'subscription') },
		{ access: 'background' as const, links: links.filter((link) => link.access === 'background') }
	];
	return groups.filter((group) => group.links.length > 0);
}

// Lucide 1.77.0 (ISC; LICENSES/Lucide.txt): book-open-text and chevron-down, written out because citations are built as HTML text.
const bookIcon =
	'<svg class="reading-icon" xmlns="http://www.w3.org/2000/svg" width="1.15em" height="1.15em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 5v16"/><path d="M16 13h2"/><path d="M16 9h2"/><path d="M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z"/><path d="M6 13h2"/><path d="M6 9h2"/></svg>';
const chevronIcon =
	'<svg class="reading-chevron" xmlns="http://www.w3.org/2000/svg" width="0.9em" height="0.9em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6"/></svg>';

function linkHtml(link: ReadingLink): string {
	return `<a href="${escapeHtml(link.link)}" data-reading-site="${escapeHtml(link.site)}">${escapeHtml(link.label)}</a>`;
}

/**
 * Where else a cited case or law can be read, as HTML to follow its
 * citation: a small book icon with the number of places and an arrow, which
 * opens the list below (Trevor chose this design on Nov. 23, 2026). The list
 * has a line for the site's own saved copy, when there is one (`saved`, from
 * savedCopyLink in src/lib/server/markdown.ts), a line for the official and
 * free texts followed by Westlaw and Lexis, which need a subscription, and a
 * line "Further reading: Wikipedia". Without scripts the button is
 * hidden and the list shows. Empty when there is nothing to list.
 */
export function readingLinksHtml(readingLinks: ReadingLinks | undefined, saved = ''): string {
	const sites: string[] = [];
	const further: string[] = [];
	for (const group of readingLinkGroups(readingLinks?.links)) {
		for (const link of group.links) {
			if (group.access === 'subscription') {
				// No "$" on the page (Trevor, Nov. 23, 2026: "assume people understand"); screen readers still hear it needs a subscription.
				sites.push(`<span class="reading-item">${linkHtml(link)}<span class="visually-hidden"> (subscription)</span></span>`);
			} else if (group.access === 'background') {
				further.push(linkHtml(link));
			} else {
				sites.push(linkHtml(link));
			}
		}
	}
	const count = (saved ? 1 : 0) + sites.length + further.length;
	if (count === 0) return '';
	// One line for each place, with no dots between them: the saved copy, each other site, then further reading (Trevor, Nov. 23,
	// 2026: "our saved copy should get its own line and further reading as well"; Nov. 24: "new line each where to read. Don't use dot to separate").
	const lines = [
		saved && `<span class="reading-line reading-saved">${saved}</span>`,
		...sites.map((site) => `<span class="reading-line">${site}</span>`),
		...further.map((link) => `<span class="reading-line reading-further">Further reading: ${link}</span>`)
	].filter(Boolean);
	const places = `${count} ${count === 1 ? 'place' : 'places'}`;
	// The list follows the button straight after, so the button needs no id to point to it: copies of a citation (a preview, a note under its paragraph) drop ids.
	const button =
		`<button type="button" class="reading-toggle needs-scripts" aria-expanded="false" aria-label="Where to read it, ${places}" title="Where to read it">` +
		`${bookIcon}<span class="reading-count" aria-hidden="true">${count}</span>${chevronIcon}</button>`;
	return ` <span class="reading-links">${button}<span class="reading-list">${lines.join('')}</span></span>`;
}

/** Opens or closes the list after a reading links button; the site's layout listens for clicks on any page. */
export function toggleReadingLinks(event: MouseEvent): void {
	const button = event.target instanceof Element ? event.target.closest('.reading-toggle') : null;
	if (!button) return;
	button.setAttribute('aria-expanded', String(button.getAttribute('aria-expanded') !== 'true'));
}

/**
 * A citation with its reading links moved to the end of `after`, such as the
 * citation markers at the head of a case box, so the icon follows them.
 */
export function readingLinksAfter(citation: string, after: string): string {
	const at = citation.indexOf(' <span class="reading-links">');
	return at < 0 ? citation + after : citation.slice(0, at) + after + citation.slice(at);
}
