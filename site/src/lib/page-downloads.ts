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

import { dataChartList, dataChartTableLink } from './data-chart-list.ts';

/**
 * A file's extension as readers see it on a format button, ".docx" from "/a/b.docx". Trevor asked on
 * Nov. 23, 2026 that buttons show the extension rather than a format's name, since "Word" could be
 * the old .doc as well as .docx.
 */
export function fileExtension(link: string): string {
	const name = link.split(/[?#]/)[0].split('/').at(-1) ?? '';
	const dot = name.lastIndexOf('.');
	return dot > 0 ? name.slice(dot).toLowerCase() : '';
}

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

/** One format of a file the page offers, built with the site. */
export interface PageFileLink {
	/** The file format as readers know it, such as "CSV" or "JSON". */
	format: string;
	link: string;
}

/** A file the page offers, in one or more formats. The menu shows one row for it, with a button for each format. */
export interface PageFile {
	/** What the file holds, such as "This nation’s record". */
	label: string;
	/** One line on what the file is for. */
	description: string;
	/** Picks the icon and the group the menu lists the file under. */
	kind: 'data' | 'table' | 'sources' | 'contact' | 'map';
	links: PageFileLink[];
}

/**
 * The groups the menu lists files under, in this order, so that a reader sees at a glance what is
 * the page itself, what is data, what is for a citation manager and what is for an address book or
 * a mapping program (Trevor asked on Nov. 23, 2026 that downloads be better separated).
 */
export const fileGroups: { heading: string; kinds: PageFile['kind'][] }[] = [
	{ heading: 'Data', kinds: ['data', 'table'] },
	{ heading: 'Sources for a citation manager', kinds: ['sources'] },
	{ heading: 'Contacts for an address book', kinds: ['contact'] },
	{ heading: 'Map layers for a mapping program', kinds: ['map'] }
];

/** A page's files sorted into the menu's groups, leaving out groups with none. */
export function groupedFiles(files: PageFile[]): { heading: string; files: PageFile[] }[] {
	return fileGroups
		.map((group) => ({ heading: group.heading, files: files.filter((file) => group.kinds.includes(file.kind)) }))
		.filter((group) => group.files.length > 0);
}

export interface PageDownloads {
	files: PageFile[];
	/** The page is about one record (a nation, a glossary entry, a story), so it offers a citation. */
	citable: boolean;
}

/** On the map page, the view on screen, whose table the menu offers first. */
export function pageDownloads(path: string, mapTable?: { file: string; label: string }): PageDownloads {
	const nation = /^\/nations\/([^/]+)$/.exec(path)?.[1];
	if (nation && nation !== 'map' && nation !== 'recourse' && nation !== 'data' && nation !== 'timeline' && nation !== 'federal-offices') {
		return {
			citable: true,
			files: [
				{
					label: 'This nation’s record',
					description: 'Every fact on this page with its source, for programs and research',
					kind: 'data',
					links: [{ format: 'JSON', link: `/nations/${nation}/record.json` }]
				},
				{
					label: 'This nation’s timeline',
					description: 'Every dated entry with its citation and link: CSV for a spreadsheet, JSON for programs',
					kind: 'table',
					links: [
						{ format: 'CSV', link: `/nations/${nation}/timeline.csv` },
						{ format: 'JSON', link: `/nations/${nation}/timeline.json` }
					]
				},
				{
					label: 'This page’s sources',
					description: 'CSL JSON for Zotero, RIS for EndNote or Mendeley, BibTeX for LaTeX',
					kind: 'sources',
					links: [
						{ format: 'CSL JSON', link: `/nations/${nation}/sources.json` },
						{ format: 'RIS', link: `/nations/${nation}/sources.ris` },
						{ format: 'BibTeX', link: `/nations/${nation}/sources.bib` }
					]
				},
				{
					label: 'Government office contacts',
					description: 'The offices’ public addresses, phones and emails',
					kind: 'contact',
					links: [{ format: 'vCard', link: `/nations/${nation}/contacts.vcf` }]
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
					description: 'Every nation and community with its recognition and states, for a spreadsheet',
					kind: 'table',
					links: [{ format: 'CSV', link: '/nations/nations.csv' }]
				}
			]
		};
	}
	if (path === '/nations/map') {
		const table: PageFile[] = mapTable
			? [
					{
						label: `The ${mapTable.label} table`,
						description: 'The table beside the map, for a spreadsheet',
						kind: 'table',
						links: [{ format: 'CSV', link: `/nations/map/tables/${mapTable.file}.csv` }]
					}
				]
			: [];
		return { citable: false, files: [...table, ...mapFiles] };
	}
	if (path === '/nations/data') {
		// Each chart's table on its own (Trevor, Nov. 23, 2026).
		return {
			citable: false,
			files: dataChartList.map((chart) => ({
				label: chart.title,
				description: 'This chart’s table: CSV or Excel for a spreadsheet, JSON for programs',
				kind: 'table' as const,
				links: [
					{ format: 'CSV', link: dataChartTableLink(chart.identifier, 'csv') },
					{ format: 'Excel', link: dataChartTableLink(chart.identifier, 'xlsx') },
					{ format: 'JSON', link: dataChartTableLink(chart.identifier, 'json') }
				]
			}))
		};
	}
	if (path === '/nations/recourse') {
		return {
			citable: false,
			files: [
				{
					label: 'Dispute resolution provisions',
					description: 'Every provision on this page with its citation: CSV for a spreadsheet, JSON for programs',
					kind: 'table',
					links: [
						{ format: 'CSV', link: '/nations/recourse/provisions.csv' },
						{ format: 'JSON', link: '/nations/recourse/provisions.json' }
					]
				}
			]
		};
	}
	if (path === '/nations/timeline') {
		return {
			citable: false,
			files: [
				{
					label: 'The timeline',
					description: 'Every dated entry with its citation and link: CSV for a spreadsheet, JSON for programs',
					kind: 'table',
					links: [
						{ format: 'CSV', link: '/nations/timeline/entries.csv' },
						{ format: 'JSON', link: '/nations/timeline/entries.json' }
					]
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
					description: 'Every term with its short definition, for programs and research',
					kind: 'data',
					links: [{ format: 'JSON', link: '/glossary/terms.json' }]
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
		description: 'The Census Bureau’s American Indian and Alaska Native areas, simplified for a national map',
		kind: 'map',
		links: [{ format: 'GeoJSON', link: '/nations/map/land-areas.geojson' }]
	},
	{
		label: 'Bureau of Indian Affairs regions',
		description: 'The twelve regions’ outlines, simplified for a national map',
		kind: 'map',
		links: [{ format: 'GeoJSON', link: '/nations/map/bureau-of-indian-affairs-regions.geojson' }]
	},
	{
		label: 'Offices of nations without a Census land area',
		description: 'The dots on the drawn map, each placed from the office’s public address',
		kind: 'map',
		links: [{ format: 'GeoJSON', link: '/nations/map/government-offices.geojson' }]
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
