/**
 * The shape every data table takes, and the one set of rules for sorting
 * and searching it (decision recorded in spikes/tables/REPORT.md, pull
 * request #27). The website's DataTable component uses these rules; the
 * print book and the ebook are meant to use the same definitions and the
 * same order, so a table reads the same in every edition.
 *
 * A table is a list of columns and a list of rows. Each row holds one cell
 * per column:
 *
 * - "text" is what readers see and what the search box looks in.
 * - "sortValue" is what sorting uses when it differs from the text: a date
 *   shown as "Mar 4, 2026" sorts by "2026-03-04", a count by its number.
 * - "href" makes the cell a link.
 */

export type ColumnType = 'text' | 'number' | 'date';
export type SortDirection = 'ascending' | 'descending';

export interface TableColumn {
	/** Matches a key in every row's cells. */
	key: string;
	/** Header text, in sentence case. */
	header: string;
	/** How the column sorts. Text by default. */
	type?: ColumnType;
	/** This column's cells are the row's header (<th scope="row">). */
	isRowHeader?: boolean;
	/** Readers can sort the table by this column. */
	sortable?: boolean;
	/** The search box looks in this column. */
	searchable?: boolean;
	/** The page draws this column's cells itself, through the cell snippet. */
	custom?: boolean;
}

export interface TableCell {
	text: string;
	sortValue?: string | number;
	href?: string;
}

export interface TableRow {
	/** Unique within the table. */
	key: string;
	/** An id for the row, so other pages and the maps can link to it. */
	anchor?: string;
	cells: Record<string, TableCell>;
}

export interface TableSort {
	key: string;
	direction: SortDirection;
}

/**
 * Text sorts the way readers expect in English: letters with accents sort
 * with their base letter, case is ignored, and numbers inside text sort as
 * numbers ("Area 2" before "Area 10"). Intl.Collator, ECMA-402 section 10.
 */
const textCollator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

function sortValueOf(cell: TableCell | undefined): string | number | undefined {
	const value = cell?.sortValue ?? cell?.text;
	if (value === undefined || value === '') return undefined;
	if (typeof value === 'number' && Number.isNaN(value)) return undefined;
	return value;
}

/**
 * Compares two cells of one column, ascending. Empty cells are reported as
 * undefined by sortValueOf and handled by sortRows, so they stay last in
 * both directions.
 */
function compareValues(type: ColumnType, first: string | number, second: string | number): number {
	if (type === 'number') return Number(first) - Number(second);
	// Dates sort by their ISO 8601 value, which sorts correctly as plain text.
	if (type === 'date') return String(first) < String(second) ? -1 : String(first) > String(second) ? 1 : 0;
	return textCollator.compare(String(first), String(second));
}

/**
 * Sorts rows by one column. The sort is stable (ECMAScript 2019 and later),
 * so rows that tie keep the order they came in. Empty cells go last whichever
 * way the column is sorted.
 */
export function sortRows(columns: TableColumn[], rows: TableRow[], sort: TableSort): TableRow[] {
	const column = columns.find((candidate) => candidate.key === sort.key);
	if (!column) return rows;
	const type = column.type ?? 'text';
	const sign = sort.direction === 'descending' ? -1 : 1;
	return [...rows].sort((firstRow, secondRow) => {
		const first = sortValueOf(firstRow.cells[column.key]);
		const second = sortValueOf(secondRow.cells[column.key]);
		if (first === undefined && second === undefined) return 0;
		if (first === undefined) return 1;
		if (second === undefined) return -1;
		return sign * compareValues(type, first, second);
	});
}

/**
 * Folds text for searching: accents and case are ignored, so "a" finds "Ä"
 * and "e" finds "É". Letters that are not accents, such as the ʻokina, are
 * kept, so they must be typed (Unicode Standard Annex #15, decomposition).
 */
export function foldForSearch(text: string): string {
	return text.normalize('NFD').replace(/\p{Mark}/gu, '').toLocaleLowerCase('en');
}

/** Keeps the rows where every word typed appears in a searchable cell. */
export function filterRows(columns: TableColumn[], rows: TableRow[], query: string): TableRow[] {
	const words = foldForSearch(query).split(/\s+/).filter(Boolean);
	if (words.length === 0) return rows;
	const keys = columns.filter((column) => column.searchable).map((column) => column.key);
	return rows.filter((row) => {
		const haystack = foldForSearch(keys.map((key) => row.cells[key]?.text ?? '').join(' '));
		return words.every((word) => haystack.includes(word));
	});
}

/** The problems in a table, for tests and builds. An empty list means none. */
export function problemsIn(columns: TableColumn[], rows: TableRow[]): string[] {
	const problems: string[] = [];
	const keys = new Set<string>();
	for (const column of columns) {
		if (keys.has(column.key)) problems.push(`column "${column.key}" is listed twice`);
		keys.add(column.key);
	}
	if (columns.filter((column) => column.isRowHeader).length > 1) {
		problems.push('more than one column is the row header');
	}
	const rowKeys = new Set<string>();
	for (const row of rows) {
		if (rowKeys.has(row.key)) problems.push(`row "${row.key}" is listed twice`);
		rowKeys.add(row.key);
		for (const key of keys) {
			if (row.cells[key] === undefined) problems.push(`row "${row.key}" has no "${key}" cell`);
		}
	}
	return problems;
}
