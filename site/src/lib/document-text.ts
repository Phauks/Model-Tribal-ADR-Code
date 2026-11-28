/**
 * What every page that shows a source's text says about the copy it shows
 * (Trevor, Nov. 27, 2026: "when showing text source info, lets try one
 * consolidated method"; he chose design B the same day, design/document-text/
 * in the project files). A law's, a case's and a copy's own page all build
 * this one shape, so the Text card (src/lib/components/DocumentText.svelte)
 * reads alike everywhere: the file's format by its extension, its size, where
 * it was published, when the copy was made, how far its words can be
 * trusted, its SHA-256 with a link to verify it, and the links to open,
 * download and ask to remove it.
 *
 * Shared by the build, the Worker and the page, so it must stay plain.
 */
import { fileName, verifyLink } from './checksums.ts';
import { copyPagePath, copyPath, fileSize, nameRequestPath, removalRequestPath, type PublicCopy } from './public-copies.ts';
import { readableDate } from './readable-date.ts';

/** How far the words of a copy can be trusted (the trust label). */
export type TrustKind = 'official' | 'publisher' | 'transcription' | 'ocr';

export interface TrustLabel {
	kind: TrustKind;
	/** The badge's words, such as "Official text". */
	label: string;
	/** What it means, in one sentence, for the badge's title. */
	detail: string;
	/** Shown as Verified (the official text) or Unverified (the rest), as the site's review badges are. */
	verified: boolean;
}

export interface DocumentFile {
	/** The copy's key in the bucket. */
	key: string;
	/** The file's own address on this site, /copies/<key>. */
	file: string;
	/** The copy's reading page, /copies/view/<key>. */
	page: string;
	/** The name a download is saved under. */
	name: string;
	/** The format as its extension, such as ".pdf", ".txt" or ".html". */
	extension: string;
	/** How the text is shown: in the site's own PDF viewer, as page text from a transcribed text or a saved web page, or as a picture. */
	shown: 'pdf' | 'text' | 'page' | 'image';
	size: string;
	/** A PDF's number of pages, when counted. */
	pages?: number;
	/** The site the original was published at, by host name, and its address. */
	publishedAt?: { host: string; link: string };
	/** The date the copy was made, in words, such as "Nov. 23, 2026". */
	captured?: string;
	sha256: string;
	verify: string;
	removal: string;
	/** A court opinion with protected people's names replaced: the notice and the request link. */
	namesReplaced?: { request: string };
	/** The record's title, which the PDF viewer's bar shows in place of the file's own (an IBIA file calls itself "C:\03wpd\03ibi"). */
	title: string;
	/** For a text or a saved web page: the reading version's address without its extension (.json, .md, .html) and the name a download of it takes. */
	reading?: { path: string; name: string };
	trust: TrustLabel;
	/** Another copy of the same document as a PDF, shown beside the text ("Scan"), with the page it opens at. */
	scan?: { file: string; name: string; pages?: number; page?: number };
	/** The Code title the text belongs to, such as "25", so "section 5321 of this title" links. */
	codeTitle?: string;
}

const extensions: Record<string, string> = { 'application/pdf': '.pdf', 'text/plain': '.txt', 'text/html': '.html', 'image/jpeg': '.jpg' };

/** The names of the places the project's copies were published, by host; any other host is named by itself. */
const publisherNames: Record<string, string> = {
	'govinfo.gov': 'GovInfo',
	'oha.doi.gov': 'Office of Hearings and Appeals, Interior Board of Indian Appeals',
	'federalregister.gov': 'Federal Register',
	'static.case.law': 'Caselaw Access Project',
	'case.law': 'Caselaw Access Project',
	'bia.gov': 'Bureau of Indian Affairs',
	'nigc.gov': 'National Indian Gaming Commission',
	'narf.org': 'Native American Rights Fund, National Indian Law Library',
	'peacemaking.narf.org': 'Native American Rights Fund, Indigenous Peacemaking Initiative',
	'thorpe.law.ou.edu': 'University of Oklahoma Law Library, Native American Constitution and Law Digitization Project',
	'treaties.okstate.edu': 'Oklahoma State University Tribal Treaties Database',
	'dc.library.okstate.edu': 'Oklahoma State University Library Digital Collections',
	'loc.gov': 'Library of Congress',
	'tile.loc.gov': 'Library of Congress',
	'archive.org': 'Internet Archive',
	'ecfr.gov': 'Electronic Code of Federal Regulations',
	'congress.gov': 'Congress.gov',
	'law.cornell.edu': 'Legal Information Institute, Cornell Law School',
	'supremecourt.gov': 'Supreme Court of the United States',
	'uscode.house.gov': 'Office of the Law Revision Counsel',
	'epa.gov': 'Environmental Protection Agency',
	'ihs.gov': 'Indian Health Service',
	'doi.gov': 'Department of the Interior',
	'digitalcommons.law.ou.edu': 'University of Oklahoma College of Law Digital Commons',
	'digitalrepository.unm.edu': 'University of New Mexico Digital Repository',
	'lawcat.berkeley.edu': 'Berkeley Law Library',
	'app.leg.wa.gov': 'Washington State Legislature',
	'execleg.sos.ok.gov': 'Oklahoma Secretary of State',
	'oklegislature.gov': 'Oklahoma Legislature',
	'oregonlegislature.gov': 'Oregon State Legislature',
	'mca.legmt.gov': 'Montana Legislature',
	'azleg.gov': 'Arizona State Legislature',
	'leg.state.nv.us': 'Nevada Legislature',
	'akleg.gov': 'Alaska State Legislature',
	'ncleg.gov': 'North Carolina General Assembly',
	'law.lis.virginia.gov': 'Virginia Law',
	'scstatehouse.gov': 'South Carolina Legislature',
	'delcode.delaware.gov': 'Delaware Code Online',
	'webserver.rilegislature.gov': 'Rhode Island General Assembly'
};

/** A host without "www.". */
export function hostOf(link: string): string | undefined {
	return URL.canParse(link) ? new URL(link).hostname.replace(/^www\./, '') : undefined;
}

/** What to call the place a document was published, such as "GovInfo" for govinfo.gov; the host itself when the project has no name for it. */
export function publisherName(link: string): string | undefined {
	const host = hostOf(link);
	if (!host) return undefined;
	return publisherNames[host] ?? publisherNames[host.split('.').slice(-2).join('.')] ?? host;
}

/** A government's own site: federal and state (.gov, .mil, .us) and the Supreme Court's. */
function isGovernmentHost(host: string | undefined): boolean {
	return Boolean(host && (/\.(?:gov|mil|us)$/.test(host) || host === 'gov'));
}

/** How far a copy's words can be trusted, from where it was published and what kind of file it is. */
export function trustOf(copy: Pick<PublicCopy, 'mediaType' | 'links'> & Partial<Pick<PublicCopy, 'derivedFrom'>>): TrustLabel {
	const host = hostOf(copy.links.at(-1) ?? copy.links[0] ?? '');
	const publisher = host ? (publisherName(`https://${host}/`) ?? host) : 'its publisher';
	if (copy.derivedFrom) {
		return {
			kind: 'ocr',
			label: 'Text from the scan, unchecked',
			detail: `Taken by computer from the words in the scan ${publisher} published, and not checked word for word. A word can be misread or out of order, and margin notes can fall between lines; check a quotation against the scan.`,
			verified: false
		};
	}
	if (host === 'static.case.law' || host === 'case.law') {
		return {
			kind: 'ocr',
			label: 'OCR, unchecked',
			detail: 'Read by computer (OCR) from the printed reports by the Caselaw Access Project and not checked word for word. A word can be misread; check a quotation against the official report.',
			verified: false
		};
	}
	if (isGovernmentHost(host)) {
		return { kind: 'official', label: 'Official text', detail: `The government’s own published file, byte for byte as ${publisher} published it.`, verified: true };
	}
	if (copy.mediaType === 'application/pdf' || copy.mediaType === 'image/jpeg') {
		return { kind: 'publisher', label: 'Publisher’s file', detail: `The file byte for byte as ${publisher} published it, which is not the government’s own copy.`, verified: false };
	}
	return {
		kind: 'transcription',
		label: 'Publisher’s transcription',
		detail: `Typed from the printed text by ${publisher}. It has not been checked word for word against the printing.`,
		verified: false
	};
}

/** The details the card needs that a served copy's own entry may lack. */
export interface DocumentFileOptions {
	/** The record's title, for the PDF viewer's bar and the downloads. */
	title: string;
	/** Another copy of the same document as a PDF, for the Scan view. */
	scan?: Pick<PublicCopy, 'key' | 'pages'> & { page?: number };
	codeTitle?: string;
}

/** The Text card's details for one served copy. */
export function documentFile(
	copy: Pick<PublicCopy, 'key' | 'mediaType' | 'sha256' | 'bytes' | 'links'> & Partial<Pick<PublicCopy, 'captured' | 'namesReplaced' | 'pages' | 'derivedFrom'>> & { name?: string },
	options: DocumentFileOptions
): DocumentFile {
	const file = copyPath(copy);
	// The name the file is saved under (src/lib/readable-file-names.ts), else the last part of its address.
	const name = copy.name || fileName(file);
	const original = copy.links.at(-1) ?? copy.links[0];
	const host = original ? hostOf(original) : undefined;
	const extension = extensions[copy.mediaType] ?? (name.includes('.') ? name.slice(name.lastIndexOf('.')) : '');
	const shown = copy.mediaType === 'application/pdf' ? 'pdf' : copy.mediaType === 'text/html' ? 'page' : copy.mediaType === 'image/jpeg' ? 'image' : 'text';
	const base = name.includes('.') ? name.slice(0, name.lastIndexOf('.')) : name;
	const scanFile = options.scan ? copyPath(options.scan) : undefined;
	return {
		key: copy.key,
		file,
		page: copyPagePath(copy),
		name,
		extension,
		shown,
		size: fileSize(copy.bytes),
		...(copy.pages ? { pages: copy.pages } : {}),
		// A copy with names replaced does not point to the original, which still has the names in it.
		...(original && host && !copy.namesReplaced ? { publishedAt: { host, link: original } } : {}),
		...(copy.captured ? { captured: readableDate(copy.captured.slice(0, 10)) } : {}),
		sha256: copy.sha256,
		verify: verifyLink(copy.sha256, name),
		removal: removalRequestPath(copy),
		...(copy.namesReplaced ? { namesReplaced: { request: nameRequestPath(copy) } } : {}),
		title: options.title,
		...(shown === 'text' || shown === 'page' ? { reading: { path: readingPath(copy.key), name: base } } : {}),
		trust: trustOf(copy),
		...(options.scan && scanFile
			? { scan: { file: scanFile, name: fileName(scanFile), ...(options.scan.pages ? { pages: options.scan.pages } : {}), ...(options.scan.page ? { page: options.scan.page } : {}) } }
			: {}),
		...(options.codeTitle ? { codeTitle: options.codeTitle } : {})
	};
}

/** The request form, filled in to offer something a copy lacks, such as a drawing its text refers to (docs/requests.md, "contribute"). */
export function suggestionPath(key: string): string {
	return `/requests?${new URLSearchParams({ kind: 'contribute', record: `copies/${key}` }).toString().replaceAll('%2F', '/')}`;
}

/** Where a copy's reading version is served, without its extension: /copies/reading/<key>, with .json, .md or .html after it. */
export function readingPath(key: string): string {
	return `/copies/reading/${key.split('/').map(encodeURIComponent).join('/')}`;
}

/** What /copies/reading/<key>.json answers. */
export interface ReadingAnswer {
	html: string;
	note?: string;
	pages: string[];
	printedLines: boolean;
	words: number;
}

/** What it answers when a nation chose to have the text cited only (src/lib/nation-restrictions.ts). */
export interface ReadingRestricted {
	restricted: 'cite';
}

/**
 * An Indigo Book citation with a pinpoint page: after the first page of a
 * reporter citation ("144 Ariz. 129, 132 (1985)"), else ", at 132" at the end
 * of the citation before its date. A span of pages is "132–33".
 */
export function pinpointCitation(citation: string, first: string, last = first): string {
	const pin = pageSpan(first, last);
	const cleaned = citation.replace(/\.\s*$/, '');
	const reporter = /^(.*?\b\d+\s+[A-Z][A-Za-z0-9.' ]*?\s\d+)(?=\s*[(,]|$)/.exec(cleaned);
	if (reporter && !/\b(?:Pub\. L\.|Stat\.|U\.S\.C\.|C\.F\.R\.)/.test(reporter[1])) return `${reporter[1]}, ${pin}${cleaned.slice(reporter[1].length)}.`;
	const dated = /^(.*?)(\s\([^()]*\d{4}\))$/.exec(cleaned);
	return dated ? `${dated[1]}, at ${pin}${dated[2]}.` : `${cleaned}, at ${pin}.`;
}

/** "132", or "132–33" for a span, dropping the repeated digits as the Indigo Book does. */
export function pageSpan(first: string, last: string): string {
	if (first === last || !/^\d+$/.test(first) || !/^\d+$/.test(last) || Number(last) < Number(first)) return first;
	if (first.length !== last.length) return `${first}–${last}`;
	let same = 0;
	while (same < first.length - 2 && first[same] === last[same]) same++;
	return `${first}–${last.slice(same)}`;
}
