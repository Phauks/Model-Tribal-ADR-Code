/**
 * A page's sources in the citation formats besides Citation Style Language JSON that citation
 * managers import (site/DESIGN.md, section 6, "Download"). Trevor asked on Nov. 23, 2026 for RIS,
 * which EndNote, Mendeley and Zotero read, and BibTeX, which LaTeX tools read. Both are written
 * from the same citation data as the CSL JSON file, so the three always list the same sources.
 */

/** The parts of a Citation Style Language item the sources use. */
export interface CitationItem {
	id: string;
	type?: string;
	title?: string;
	'title-short'?: string;
	author?: Name[];
	editor?: Name[];
	'container-title'?: string;
	'container-title-short'?: string;
	'collection-title'?: string;
	publisher?: string;
	'publisher-place'?: string;
	volume?: string | number;
	number?: string | number;
	page?: string;
	section?: string;
	medium?: string;
	URL?: string;
	issued?: { 'date-parts'?: (number | string)[][]; literal?: string };
	accessed?: { 'date-parts'?: (number | string)[][] };
	note?: string;
}

interface Name {
	family?: string;
	given?: string;
	literal?: string;
}

function dateParts(date: CitationItem['issued']): number[] {
	return (date?.['date-parts']?.[0] ?? []).map(Number).filter((part) => !Number.isNaN(part));
}

function nameText(name: Name): string {
	return name.literal ?? [name.family, name.given].filter(Boolean).join(', ');
}

// ---------------------------------------------------------------- RIS

/** RIS reference types for CSL types (the RIS specification's type list). */
const risTypes: Record<string, string> = {
	webpage: 'ELEC',
	dataset: 'DATA',
	legislation: 'STAT',
	bill: 'BILL',
	report: 'RPRT',
	book: 'BOOK',
	chapter: 'CHAP',
	treaty: 'GEN',
	legal_case: 'CASE',
	letter: 'PCOMM',
	'article-journal': 'JOUR',
	'article-newspaper': 'NEWS',
	'article-magazine': 'MGZN',
	thesis: 'THES',
	document: 'GEN'
};

function risDate(parts: number[], slashes = true): string {
	if (parts.length === 0) return '';
	const [year, month, day] = parts;
	if (!slashes) return String(year);
	return `${year}/${month ? String(month).padStart(2, '0') : ''}/${day ? String(day).padStart(2, '0') : ''}/`;
}

/** One source as RIS lines. */
export function risEntry(item: CitationItem): string {
	const lines: [string, string | undefined][] = [['TY', risTypes[item.type ?? ''] ?? 'GEN']];
	lines.push(['ID', item.id], ['TI', item.title], ['ST', item['title-short']]);
	for (const author of item.author ?? []) lines.push(['AU', nameText(author)]);
	for (const editor of item.editor ?? []) lines.push(['ED', nameText(editor)]);
	lines.push(
		['T2', item['container-title']],
		['T3', item['collection-title']],
		['J2', item['container-title-short']],
		['PB', item.publisher],
		['CY', item['publisher-place']],
		['VL', item.volume?.toString()],
		['IS', item.number?.toString()],
		['SE', item.section],
		['M3', item.medium]
	);
	const [start, end] = (item.page ?? '').split(/[-–]/);
	lines.push(['SP', start || undefined], ['EP', end || undefined]);
	const issued = dateParts(item.issued);
	lines.push(['PY', risDate(issued, false) || undefined], ['DA', risDate(issued) || undefined]);
	lines.push(['UR', item.URL], ['Y2', risDate(dateParts(item.accessed)) || undefined], ['N1', item.note]);
	return `${lines
		.filter((line): line is [string, string] => typeof line[1] === 'string' && line[1].trim() !== '')
		.map(([tag, value]) => `${tag}  - ${value.replace(/\s+/g, ' ').trim()}`)
		.join('\r\n')}\r\nER  - \r\n`;
}

export function risFile(items: CitationItem[]): string {
	return items.map(risEntry).join('\r\n');
}

// ---------------------------------------------------------------- BibTeX

/** BibTeX entry types for CSL types. A legal or government document is a "misc" with its kind noted, the usual choice in BibTeX. */
const bibtexTypes: Record<string, string> = {
	book: 'book',
	chapter: 'incollection',
	report: 'techreport',
	'article-journal': 'article',
	'article-magazine': 'article',
	'article-newspaper': 'article',
	thesis: 'phdthesis'
};

const bibtexSpecial: Record<string, string> = { '\\': '\\textbackslash{}', '{': '\\{', '}': '\\}', '&': '\\&', '%': '\\%', $: '\\$', '#': '\\#', _: '\\_', '~': '\\textasciitilde{}', '^': '\\textasciicircum{}' };

/** Escapes a value for BibTeX; letters outside ASCII stay as they are, which biber and modern BibTeX read as UTF-8. */
export function bibtexValue(text: string): string {
	return text.replace(/\s+/g, ' ').trim().replace(/[\\{}&%$#_~^]/g, (character) => bibtexSpecial[character]);
}

/** A BibTeX key: the source's own key, which is already letters, digits and hyphens. */
function bibtexKey(id: string): string {
	return id.replace(/[^A-Za-z0-9:_.-]+/g, '-');
}

const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** One source as a BibTeX entry. Organizations' names are braced so BibTeX keeps them whole. */
export function bibtexEntry(item: CitationItem): string {
	const type = bibtexTypes[item.type ?? ''] ?? 'misc';
	const names = (list: Name[] | undefined) =>
		(list ?? []).map((name) => (name.literal ? `{${bibtexValue(name.literal)}}` : bibtexValue(nameText(name)))).join(' and ');
	const issued = dateParts(item.issued);
	const accessed = dateParts(item.accessed);
	const container = item['container-title'];
	const fields: [string, string | undefined][] = [
		['title', item.title ? `{${bibtexValue(item.title)}}` : undefined],
		['author', names(item.author) || undefined],
		['editor', names(item.editor) || undefined],
		[type === 'article' ? 'journal' : type === 'incollection' ? 'booktitle' : 'howpublished', container ? bibtexValue(container) : undefined],
		['series', item['collection-title'] ? bibtexValue(item['collection-title']) : undefined],
		[type === 'techreport' ? 'institution' : 'publisher', item.publisher ? bibtexValue(item.publisher) : undefined],
		['address', item['publisher-place'] ? bibtexValue(item['publisher-place']) : undefined],
		['volume', item.volume?.toString()],
		['number', item.number ? bibtexValue(item.number.toString()) : undefined],
		['pages', item.page ? bibtexValue(item.page).replace(/[-–]/, '--') : undefined],
		['year', issued[0]?.toString()],
		['month', issued[1] ? monthNames[issued[1] - 1] : undefined],
		['url', item.URL],
		['urldate', accessed.length === 3 ? accessed.map((part) => String(part).padStart(2, '0')).join('-') : undefined],
		['note', [type === 'misc' && item.type ? item.type.replace(/[-_]/g, ' ') : '', item.note ?? ''].filter(Boolean).join('. ') || undefined]
	];
	const body = fields
		.filter((field): field is [string, string] => typeof field[1] === 'string' && field[1] !== '')
		// Month names are BibTeX's own macros, written without braces.
		.map(([name, value]) => `  ${name} = ${name === 'month' ? value : name === 'url' ? `{${value.replace(/[{}]/g, '')}}` : `{${value}}`}`)
		.join(',\n');
	return `@${type}{${bibtexKey(item.id)},\n${body}\n}\n`;
}

export function bibtexFile(items: CitationItem[]): string {
	return items.map(bibtexEntry).join('\n');
}
