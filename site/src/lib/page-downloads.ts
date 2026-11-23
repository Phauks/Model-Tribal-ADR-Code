/**
 * What the masthead's Download menu offers on the page a reader is on
 * (site/DESIGN.md, section 6, "Download"). Trevor asked on Nov. 22, 2026 that
 * Download open a list of the kinds of download a reader may want, rather
 * than fetch one JSON file. Every page offers a PDF (through the Print
 * dialog), reading offline and the Downloads page; this file adds the files
 * a page has of its own, each built with the site, and says whether the page
 * is one record a reader may cite.
 *
 * This is the one list of what a page offers (Trevor asked on Nov. 23, 2026
 * for the export functions to be consolidated): the menu shows it, and the
 * page formats below are made from one reading of the page
 * (src/lib/page-document.ts).
 */

/** A format the browser makes from the page as shown, offered on every page. */
export interface PageFormat {
	id: 'markdown' | 'word' | 'opendocument';
	/** The format as readers know it. */
	format: string;
	extension: string;
	mediaType: string;
	description: string;
}

export const pageFormats: PageFormat[] = [
	{
		id: 'word',
		format: 'Word',
		extension: 'docx',
		mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		description: 'To edit in Microsoft Word, Google Docs or Pages'
	},
	{
		id: 'opendocument',
		format: 'ODT',
		extension: 'odt',
		mediaType: 'application/vnd.oasis.opendocument.text',
		description: 'To edit in LibreOffice or another OpenDocument editor'
	},
	{
		id: 'markdown',
		format: 'Markdown',
		extension: 'md',
		mediaType: 'text/markdown;charset=utf-8',
		description: 'Plain text with headings, links and sources, for notes apps and editors'
	}
];

/** A file the page offers, built with the site. */
export interface PageFile {
	/** What the file holds, such as "This nation’s record". */
	label: string;
	/** The file format as readers know it, such as "CSV" or "JSON". */
	format: string;
	/** One line on what the file is for. */
	description: string;
	/** Picks the icon. */
	kind: 'data' | 'table' | 'sources' | 'contact' | 'map';
	link: string;
}

export interface PageDownloads {
	files: PageFile[];
	/** The page is about one record (a nation, a glossary entry, a story), so it offers a citation. */
	citable: boolean;
}

export function pageDownloads(path: string): PageDownloads {
	const nation = /^\/nations\/([^/]+)$/.exec(path)?.[1];
	if (nation && nation !== 'map' && nation !== 'recourse' && nation !== 'data') {
		return {
			citable: true,
			files: [
				{
					label: 'This nation’s record',
					format: 'JSON',
					description: 'Every fact on this page with its source, for programs and research',
					kind: 'data',
					link: `/nations/${nation}/record.json`
				},
				{
					label: 'This page’s sources',
					format: 'CSL JSON',
					description: 'For Zotero or another citation manager',
					kind: 'sources',
					link: `/nations/${nation}/sources.json`
				},
				{
					label: 'This page’s sources',
					format: 'RIS',
					description: 'For EndNote, Mendeley or another citation manager',
					kind: 'sources',
					link: `/nations/${nation}/sources.ris`
				},
				{
					label: 'This page’s sources',
					format: 'BibTeX',
					description: 'For LaTeX and BibTeX-based tools',
					kind: 'sources',
					link: `/nations/${nation}/sources.bib`
				},
				{
					label: 'Government office contacts',
					format: 'vCard',
					description: 'The offices’ public addresses, phones and emails, for an address book',
					kind: 'contact',
					link: `/nations/${nation}/contacts.vcf`
				}
			]
		};
	}
	if (path === '/nations' || /^\/nations\/(letter|state)\/[^/]+$/.test(path)) {
		return {
			citable: false,
			files: [
				{
					label: 'The list of nations',
					format: 'CSV',
					description: 'Every nation and community with its recognition and states, for a spreadsheet',
					kind: 'table',
					link: '/nations/nations.csv'
				}
			]
		};
	}
	if (path === '/nations/map') {
		return { citable: false, files: mapFiles };
	}
	if (path === '/nations/recourse') {
		return {
			citable: false,
			files: [
				{
					label: 'Dispute resolution provisions',
					format: 'CSV',
					description: 'Every provision on this page, with its citation, for a spreadsheet',
					kind: 'table',
					link: '/nations/recourse/provisions.csv'
				},
				{
					label: 'Dispute resolution provisions',
					format: 'JSON',
					description: 'The same list, for programs and research',
					kind: 'data',
					link: '/nations/recourse/provisions.json'
				}
			]
		};
	}
	if (path === '/glossary' || path.startsWith('/glossary/')) {
		return {
			citable: path !== '/glossary',
			files: [
				{
					label: 'The glossary',
					format: 'JSON',
					description: 'Every term with its short definition, for programs and research',
					kind: 'data',
					link: '/glossary/terms.json'
				}
			]
		};
	}
	return { citable: /^\/stories\/[^/]+$/.test(path), files: [] };
}

/** The map's layers as GeoJSON (RFC 7946), for mapping programs; also listed on the Downloads page. */
export const mapFiles: PageFile[] = [
	{
		label: 'Land areas',
		format: 'GeoJSON',
		description: 'The Census Bureau’s American Indian and Alaska Native areas, simplified for a national map',
		kind: 'map',
		link: '/nations/map/land-areas.geojson'
	},
	{
		label: 'Bureau of Indian Affairs regions',
		format: 'GeoJSON',
		description: 'The twelve regions’ outlines, simplified for a national map',
		kind: 'map',
		link: '/nations/map/bureau-of-indian-affairs-regions.geojson'
	},
	{
		label: 'Offices of nations without a Census land area',
		format: 'GeoJSON',
		description: 'The dots on the drawn map, each placed from the office’s public address',
		kind: 'map',
		link: '/nations/map/government-offices.geojson'
	}
];

/** "Nov. 22, 2026", the Indigo Book's month abbreviations. */
export function citationDate(date: Date): string {
	const months = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
	return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/**
 * A citation to a page of the site, in the form the Indigo Book gives for
 * an internet source: the page's title, the site's name with the content
 * version, the address, and the day the reader visited it, since the page can
 * change. The title is italic in the HTML form.
 */
export function pageCitation(
	title: string,
	siteName: string,
	contentVersion: string | undefined,
	address: string,
	visited: Date
): { text: string; html: string } {
	const version = contentVersion ? ` (draft content ver. ${contentVersion})` : '';
	const rest = `, ${siteName}${version}, ${address} (last visited ${citationDate(visited)}).`;
	const escape = (value: string) =>
		value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
	return { text: `${title}${rest}`, html: `<i>${escape(title)}</i>${escape(rest)}` };
}
