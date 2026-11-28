/**
 * The Text card's copy for a law's or a case's page (src/lib/document-text.ts,
 * DocumentText.svelte), and the first line of its "Where to read it": the
 * place the document was published, its true original publisher (Trevor,
 * Nov. 27, 2026: "Where to read it" always lists the original source first,
 * not our intermediate copy). Built with the site.
 */
import { documentFile, publisherName, type DocumentFile } from '../document-text.ts';
import { escapeHtml } from '../escape-html.ts';
import { linkForMatching, type PublicCopy } from '../public-copies.ts';
import { officialReportLinks, type ReadingLinks } from '../reading-links.ts';
import { publicCopies, publicCopyFor, publicCopyWithDigest, scanTextCopies, storedStatuteText, type SourceRecord } from './content.ts';
import { copyFileNames } from './copy-lists.ts';

let byKey: Map<string, PublicCopy> | undefined;

/** A served copy by its key. */
export function publicCopyByKey(key: string | undefined): PublicCopy | undefined {
	if (!key) return undefined;
	byKey ??= new Map(publicCopies().map((copy) => [copy.key, copy]));
	return byKey.get(key);
}

/** Every copy the site serves of a record's document, in the order savedCopyFor tries them, each once. */
export function recordCopies(record: SourceRecord): PublicCopy[] {
	const stored = (record as SourceRecord & { file?: { checksum?: string } }).file?.checksum;
	const found = [...officialReportLinks(record.reading_links).map(publicCopyFor), publicCopyWithDigest(stored), storedStatuteText(record.key), publicCopyFor(record.original_link), publicCopyFor(record.citation.URL)];
	const seen = new Set<string>();
	return found.filter((copy): copy is PublicCopy => {
		if (!copy || seen.has(copy.key)) return false;
		seen.add(copy.key);
		return true;
	});
}

const isText = (copy: PublicCopy) => copy.mediaType === 'text/plain' || copy.mediaType === 'text/html';

let scanTexts: Map<string, PublicCopy> | undefined;

/** The text taken from a served scan's words (scripts/law/scan_texts.py), by the scan's key. */
export function textOfScan(key: string): PublicCopy | undefined {
	scanTexts ??= new Map(scanTextCopies().map((copy) => [copy.derivedFrom as string, copy] as const));
	return scanTexts.get(key);
}

/**
 * The card's copy: the first of the record's copies, except that a text of
 * the document comes before its PDF, which the card shows beside the text
 * as its scan. A PDF with no other text shows the text taken from its own
 * words, when the site keeps one.
 */
export function recordDocument(record: SourceRecord, title: string, copy: PublicCopy | undefined = recordCopies(record)[0]): DocumentFile | undefined {
	if (!copy) return undefined;
	const copies = recordCopies(record);
	let shown = copy;
	let scan = copies.find((other) => other.mediaType === 'application/pdf' && other.key !== copy.key);
	if (copy.mediaType === 'application/pdf') {
		// A text of the document first; else the text taken from this scan's own words.
		const text = copies.find(isText) ?? textOfScan(copy.key);
		if (text) {
			shown = text;
			scan = copy;
		} else scan = undefined;
	}
	const page = scan ? /#page=(\d{1,5})$/.exec([record.original_link, record.citation.URL].find((link) => link && publicCopyFor(link)?.key === scan?.key) ?? '')?.[1] : undefined;
	return documentFile({ ...shown, name: copyFileNames().get(shown.key) }, {
		title,
		...(scan ? { scan: { key: scan.key, pages: scan.pages, ...(page ? { page: Number(page) } : {}) } } : {}),
		...(/^usc-25-/.test(record.key) ? { codeTitle: '25' } : {})
	});
}

/**
 * A Title 25 section's own copy, for a section page whose older record has no
 * text (scripts/law/title_25_section_texts.py): the section's web page from
 * GovInfo, with the section's PDF beside it as its scan; the PDF alone when
 * the site keeps no web page of it.
 */
export function codeSectionDocument(slug: string, edition: number, title: string): DocumentFile | undefined {
	const stem = `united-states-code/${edition}/title-25-section-${slug}`;
	const text = publicCopyByKey(`${stem}.html`);
	const scan = publicCopyByKey(`${stem}.pdf`);
	const shown = text ?? scan;
	if (!shown) return undefined;
	return documentFile({ ...shown, name: copyFileNames().get(shown.key) }, {
		title,
		...(text && scan ? { scan: { key: scan.key, pages: scan.pages } } : {}),
		codeTitle: '25'
	});
}

/** The record's own published address: where the document is, at its publisher. */
export function originalLink(record: SourceRecord): string | undefined {
	const link = record.original_link ?? record.citation.URL;
	return link && /^https?:\/\//.test(link) ? link : undefined;
}

/**
 * "Where to read it": the original publisher first, then the other places,
 * without a second link to the same address. `extra` is a line the page adds
 * after the publisher, such as a whole-volume copy no card shows.
 */
export function whereToRead(record: SourceRecord, extra = ''): { readingLinks: ReadingLinks | undefined; first: string[]; count: number } {
	const link = originalLink(record);
	const name = link ? publisherName(link) : undefined;
	const first = link && name ? `<a href="${escapeHtml(link)}" data-reading-site="original">${escapeHtml(name)}</a>` : '';
	const matching = link ? linkForMatching(link) : undefined;
	const links = (record.reading_links?.links ?? []).filter((entry) => !matching || linkForMatching(entry.link) !== matching);
	const readingLinks = record.reading_links ? { ...record.reading_links, links } : undefined;
	const lines = [first, extra].filter(Boolean);
	return { readingLinks, first: lines, count: lines.length + links.length };
}
