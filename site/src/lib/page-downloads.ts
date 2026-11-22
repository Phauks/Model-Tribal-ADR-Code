/**
 * The file the masthead's Download link offers for the page a reader is on
 * (site/DESIGN.md, section 6, "Masthead"). Each is built with the site: a
 * nation's record, the whole nations index, or the glossary's terms. Pages
 * with no file of their own get no Download link; the book and the data
 * exports are on the Downloads page.
 */
export interface PageDownload {
	/** Says what the file holds, such as "Download this record". */
	label: string;
	/** The file format, such as "CSV" or "JSON". */
	format: string;
	link: string;
}

export function downloadFor(path: string): PageDownload | undefined {
	const nation = /^\/nations\/([^/]+)$/.exec(path)?.[1];
	if (nation && nation !== 'map') {
		return { label: 'Download this record', format: 'JSON', link: `/nations/${nation}/record.json` };
	}
	if (path === '/nations' || /^\/nations\/(letter|state)\/[^/]+$/.test(path)) {
		return { label: 'Download the list', format: 'CSV', link: '/nations/nations.csv' };
	}
	if (path === '/glossary' || path.startsWith('/glossary/')) {
		return { label: 'Download the glossary', format: 'JSON', link: '/glossary/terms.json' };
	}
	return undefined;
}
