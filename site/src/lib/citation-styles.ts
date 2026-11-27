/**
 * Citations to a page of the site, and to the case or law a page is about, in
 * the styles readers are asked to use: the Indigo Book for legal writing (the
 * site's own style, which follows the same system as the Bluebook), Chicago,
 * APA and MLA (Trevor, Nov. 27, 2026: "when citing a page, allow citing in
 * various formats, MLA, APA, etc."). The Cite panel (CiteMenu.svelte) shows
 * one style at a time and remembers the reader's choice.
 *
 * The forms follow each style's own guidance for a web page and for legal
 * sources, as checked on Nov. 27, 2026:
 * - Indigo Book 2.1: an internet source gives the title, the site, the address
 *   and the day last visited; cases and laws keep their legal citation.
 * - Chicago Manual of Style, 18th ed., bibliography entry: the site's owner
 *   stands as author, the page's title in quotation marks, the date published
 *   or, failing one, the day accessed, then the address. Legal sources keep
 *   the legal citation (Purdue OWL, "Web Sources", Chicago 18th ed.).
 * - APA 7th ed.: the group author, the date or "n.d.", the title in italics;
 *   the site's name is left out when it is the author, and a page "designed to
 *   change over time" gets "Retrieved <date>, from <address>" (APA Style,
 *   "Webpage on a website references"). Legal sources keep the legal citation.
 * - MLA 9th ed.: the title in quotation marks, the site in italics, the address
 *   without "https://", and "Accessed <date>". A court case names the court as
 *   author and gives the reporter as a container (MLA Style Center,
 *   "Documenting Legal Works in MLA Style"); the names of laws are roman.
 */
import type { CitationItem } from './citation-formats.ts';

export const citationStyles = [
	{ key: 'indigo', label: 'Indigo Book', title: 'The Indigo Book: legal citation in the Bluebook’s system' },
	{ key: 'chicago', label: 'Chicago', title: 'Chicago Manual of Style, 18th edition: bibliography entry' },
	{ key: 'apa', label: 'APA', title: 'APA Style, 7th edition: reference list entry' },
	{ key: 'mla', label: 'MLA', title: 'MLA Handbook, 9th edition: works-cited entry' }
] as const;

export type CitationStyle = (typeof citationStyles)[number]['key'];

export const defaultCitationStyle: CitationStyle = 'indigo';

export function isCitationStyle(value: unknown): value is CitationStyle {
	return citationStyles.some((style) => style.key === value);
}

/** A citation as plain text, for pasting anywhere, and as HTML, which keeps the italics. */
export interface StyledCitation {
	text: string;
	html: string;
}

/** What a citation to a page of the site needs. */
export interface CitedPage {
	title: string;
	/** The title is a case's name, set in italics wherever the style italicizes case names. */
	titleIsCaseName?: boolean;
	siteName: string;
	/** The content version shown in the footer, which the Indigo form gives. */
	contentVersion?: string;
	address: string;
	visited: Date;
	/** The day the page was published, for a page that keeps each publication (an essay). Such a page is archived, so APA needs no retrieval date. */
	published?: Date;
}

/** The case or law a page is about: its legal citation, and the record's parts for the styles that rearrange them. */
export interface CitedRecord {
	kind: 'case' | 'law';
	/** The case's or law's name, as the page's heading gives it. */
	name: string;
	/** The citation in Indigo Book form: for a case, the reporter and year ("31 U.S. 515 (1832)"); for a law, the whole citation, name included. */
	citation: string;
	/** The record's kind, such as "federal-statute" or "intergovernmental-agreement", for a law. */
	lawKind?: string;
	reference?: CitedReference;
}

/** A case's court, reporter, volume, first page and date, from its record's citation (Citation Style Language names). */
export interface CitedReference {
	authority?: string;
	'container-title'?: string;
	volume?: string;
	page?: string;
	issued?: CitationItem['issued'];
}

// A piece of a citation: plain text, or text set in italics.
type Piece = string | { italic: string };

function render(pieces: Piece[]): StyledCitation {
	const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
	return {
		text: pieces.map((piece) => (typeof piece === 'string' ? piece : piece.italic)).join(''),
		html: pieces.map((piece) => (typeof piece === 'string' ? escape(piece) : `<i>${escape(piece.italic)}</i>`)).join('')
	};
}

const shortMonths = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
const longMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "Nov. 22, 2026", the Indigo Book's month abbreviations. */
export function indigoDate(date: Date): string {
	return `${shortMonths[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/** "November 22, 2026", as Chicago and APA write a date. */
function longDate(date: Date): string {
	return `${longMonths[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/** "22 Nov. 2026", as MLA writes a date. */
function mlaDate(date: Date): string {
	return `${date.getDate()} ${shortMonths[date.getMonth()]} ${date.getFullYear()}`;
}

/** Ends a citation with a period, unless its last words already end in one. */
function withPeriod(pieces: Piece[]): Piece[] {
	const last = pieces.at(-1);
	const text = last === undefined ? '' : typeof last === 'string' ? last : last.italic;
	return /[.?!]$/.test(text) ? pieces : [...pieces, '.'];
}

/** The page's title, in italics where the style italicizes a case name inside the title. */
function titlePieces(page: CitedPage, italicTitle: boolean): Piece[] {
	// A case name inside a title that is itself italic goes back to roman (APA's reverse italics).
	if (italicTitle) return page.titleIsCaseName ? [page.title] : [{ italic: page.title }];
	return page.titleIsCaseName ? [{ italic: page.title }] : [page.title];
}

/** The title inside quotation marks, with the period or comma inside them, as Chicago and MLA place it. */
function quotedTitle(page: CitedPage, closing: '.' | ','): Piece[] {
	return ['“', ...titlePieces(page, false), `${closing}”`];
}

/** A citation to a page of the site in one style. */
export function citePage(style: CitationStyle, page: CitedPage): StyledCitation {
	const { siteName, address, visited, published } = page;
	switch (style) {
		case 'indigo': {
			const version = page.contentVersion ? ` (draft content ver. ${page.contentVersion})` : '';
			return render([{ italic: page.title }, `, ${siteName}${version}, ${address} (last visited ${indigoDate(visited)}).`]);
		}
		case 'chicago': {
			const when = published ? `Published ${longDate(published)}` : `Accessed ${longDate(visited)}`;
			return render([`${siteName}. `, ...quotedTitle(page, '.'), ` ${when}. ${address}.`]);
		}
		case 'apa': {
			const date = published ? `${published.getFullYear()}, ${longMonths[published.getMonth()]} ${published.getDate()}` : 'n.d.';
			const where = published ? address : `Retrieved ${longDate(visited)}, from ${address}`;
			return render([`${siteName}. (${date}). `, ...withPeriod(titlePieces(page, true)), ` ${where}`]);
		}
		case 'mla': {
			const bare = address.replace(/^https?:\/\//, '');
			const date = published ? `${mlaDate(published)}, ` : '';
			return render([...quotedTitle(page, '.'), ' ', { italic: siteName }, `, ${date}${bare}. Accessed ${mlaDate(visited)}.`]);
		}
	}
}

/** Reporters' full names, which MLA gives as the container of a case. */
const reporterNames: Record<string, string> = {
	'U.S.': 'United States Reports',
	'S. Ct.': 'Supreme Court Reporter',
	'L. Ed.': 'United States Supreme Court Reports, Lawyers’ Edition',
	'L. Ed. 2d': 'United States Supreme Court Reports, Lawyers’ Edition, Second Series',
	'F.': 'Federal Reporter',
	'F.2d': 'Federal Reporter, Second Series',
	'F.3d': 'Federal Reporter, Third Series',
	'F.4th': 'Federal Reporter, Fourth Series',
	'F. Supp.': 'Federal Supplement',
	'F. Supp. 2d': 'Federal Supplement, Second Series',
	'F. Supp. 3d': 'Federal Supplement, Third Series',
	'Ct. Cl.': 'Court of Claims Reports',
	'Fed. Cl.': 'United States Court of Federal Claims Reports',
	IBIA: 'Interior Board of Indian Appeals Decisions',
	'Ind. Cl. Comm.': 'Indian Claims Commission Decisions',
	Stat: 'United States Statutes at Large',
	'Stat.': 'United States Statutes at Large'
};

/** The court as MLA names an author: the government, then the body. */
function mlaCourt(authority: string): string {
	return authority === 'Supreme Court of the United States' ? 'United States, Supreme Court' : authority;
}

function issuedDate(reference: CitedRecord['reference']): Date | undefined {
	const [year, month, day] = (reference?.issued?.['date-parts']?.[0] ?? []).map(Number);
	if (!year || !month || !day) return undefined;
	return new Date(year, month - 1, day);
}

/** The case or law in MLA's form, from the record's parts; MLA's shorter form for specialists ("name. citation.") when the parts are missing. */
function mlaRecord(record: CitedRecord): StyledCitation {
	const name = record.name.replace(/\s+\(\d{4}\)$/, '');
	if (record.kind === 'case') {
		const reference = record.reference;
		const reporter = reference?.['container-title'] ? reporterNames[reference['container-title']] : undefined;
		const year = reference?.issued?.['date-parts']?.[0]?.[0];
		if (reference?.authority && reporter && reference.volume && reference.page && year) {
			const date = issuedDate(reference);
			return render([`${mlaCourt(reference.authority)}. `, { italic: name }, '. ', { italic: reporter }, `, vol. ${reference.volume}, ${date ? mlaDate(date) : year}, p. ${reference.page}.`]);
		}
		return render([{ italic: name }, '. ', ...withPeriod([record.citation.replace(/\s*\((\d{4})\)$/, '. $1')])]);
	}
	// A law printed in the Statutes at Large: its volume and first page.
	const statute = /(\d+)\s+Stat\.\s+(\d+)/.exec(record.citation);
	const year = /(\d{4})\)?\.?$/.exec(record.citation)?.[1] ?? /\b(1[6-9]\d\d|20\d\d)\b/.exec(record.citation)?.[1];
	if (statute && year) {
		const author = record.lawKind === 'federal-statute' ? 'United States, Congress. ' : '';
		return render([`${author}${name}. `, { italic: reporterNames.Stat }, `, vol. ${statute[1]}, ${year}, p. ${statute[2]}.`]);
	}
	return render(withPeriod([`${name}. ${record.citation}`]));
}

/**
 * A citation to the case or law a page is about, in one style. The Indigo
 * Book, Chicago and APA all cite legal sources in the legal form, so the three
 * agree; MLA rearranges the parts into its own template.
 */
export function citeRecord(style: CitationStyle, record: CitedRecord): StyledCitation {
	if (style === 'mla') return mlaRecord(record);
	if (record.kind === 'case') return render(withPeriod([{ italic: record.name }, `, ${record.citation}`]));
	return render(withPeriod([record.citation]));
}
