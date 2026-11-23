/**
 * What the masthead's Download menu offers on the page a reader is on
 * (site/DESIGN.md, section 6, "Download"). Trevor asked on Nov. 22, 2026 that
 * Download open a list of the kinds of download a reader may want, rather
 * than fetch one JSON file. Every page offers a PDF (through the Print
 * dialog), reading offline and the Downloads page; this file adds the files
 * a page has of its own, each built with the site, and says whether the page
 * is one record a reader may cite.
 */

/** A file the page offers, built with the site. */
export interface PageFile {
	/** What the file holds, such as "This nation’s record". */
	label: string;
	/** The file format as readers know it, such as "CSV" or "JSON". */
	format: string;
	/** One line on what the file is for. */
	description: string;
	/** Picks the icon. */
	kind: 'data' | 'table' | 'sources';
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
