/**
 * The other places a reader can read a cited case or law: official texts
 * (GovInfo, eCFR, the Office of the Law Revision Counsel, the Library of
 * Congress, the Supreme Court), free sites (CourtListener, Justia, Oyez,
 * Cornell LII, Google Scholar), subscription services (Westlaw, Lexis) and
 * Wikipedia as background. scripts/caselaw/reading_links.py finds and checks
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

/** "A", "A and B", "A, B and C". */
function listed(items: string[]): string {
	if (items.length < 2) return items.join('');
	return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
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

const groupWords = {
	read: 'Read it at',
	subscription: 'With a subscription:',
	background: 'Background, not legal authority:'
};

/**
 * The record's reading links as one short line of HTML to follow a citation,
 * such as "Read it at Cornell LII, CourtListener and Oyez. With a
 * subscription: Westlaw and Lexis. Background, not legal authority:
 * Wikipedia." Empty when the record has none.
 */
export function readingLinksHtml(readingLinks: ReadingLinks | undefined): string {
	const groups = readingLinkGroups(readingLinks?.links);
	if (groups.length === 0) return '';
	const sentences = groups.map(
		(group) =>
			`${groupWords[group.access]} ${listed(
				group.links.map((link) => `<a href="${escapeHtml(link.link)}" data-reading-site="${escapeHtml(link.site)}">${escapeHtml(link.label)}</a>`)
			)}.`
	);
	return ` <span class="reading-links">${sentences.join(' ')}</span>`;
}
