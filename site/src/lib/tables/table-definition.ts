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
	/**
	 * Readers can narrow the table to some of this column's values, ticked in
	 * a list under the column's header. A searchable column that is not
	 * filterable gets a "Contains" box there instead.
	 */
	filterable?: boolean;
	/** The column starts hidden; a reader can add it from the list of columns. */
	optional?: boolean;
	/** A number column that the table's Sum row adds up. */
	sum?: boolean;
}

export interface TableCell {
	text: string;
	sortValue?: string | number;
	href?: string;
	/**
	 * The values a column filter matches, when they differ from the text: a
	 * cell listing "Arizona, New Mexico" matches the filters for both states.
	 */
	values?: string[];
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

/* Column filters --------------------------------------------------------- */

/**
 * How one column narrows the table (Trevor, Nov. 24, 2026: filters sit on
 * the column headers, as in a spreadsheet). `values`: the rows whose cell has
 * any of these values. `contains`: the rows whose cell holds every word typed.
 */
export interface ColumnFilter {
	values?: string[];
	contains?: string;
}

/** Each column's filter, by column key. A column left out is not filtered. */
export type ColumnFilters = Record<string, ColumnFilter>;

/** What kind of filter a column offers under its header, if any. */
export function filterKind(column: TableColumn): 'values' | 'contains' | undefined {
	if (column.filterable) return 'values';
	if (column.searchable) return 'contains';
	return undefined;
}

/** Whether a filter narrows anything. */
export function filterIsActive(filter: ColumnFilter | undefined): boolean {
	return Boolean(filter && ((filter.values?.length ?? 0) > 0 || (filter.contains ?? '').trim() !== ''));
}

export interface FilterChoice {
	value: string;
	/** How many rows the choice leaves, among the rows given. */
	count: number;
}

function valuesOf(cell: TableCell | undefined): string[] {
	if (!cell) return [];
	if (cell.values) return cell.values.filter((value) => value !== '');
	return cell.text === '' ? [] : [cell.text];
}

/** The values a column can be narrowed to, in reading order, each with its row count. */
export function filterChoices(column: TableColumn, rows: TableRow[]): FilterChoice[] {
	const counts = new Map<string, number>();
	for (const row of rows) {
		for (const value of new Set(valuesOf(row.cells[column.key]))) {
			counts.set(value, (counts.get(value) ?? 0) + 1);
		}
	}
	return [...counts]
		.map(([value, count]) => ({ value, count }))
		.sort((first, second) => textCollator.compare(first.value, second.value));
}

/** Keeps the rows that match every column filter. */
export function applyColumnFilters(rows: TableRow[], filters: ColumnFilters): TableRow[] {
	const active = Object.entries(filters).filter(([, filter]) => filterIsActive(filter));
	if (active.length === 0) return rows;
	const tests = active.map(([key, filter]) => {
		const wanted = new Set(filter.values ?? []);
		const words = foldForSearch(filter.contains ?? '').split(/\s+/).filter(Boolean);
		return (row: TableRow) => {
			const cell = row.cells[key];
			if (wanted.size > 0 && !valuesOf(cell).some((value) => wanted.has(value))) return false;
			if (words.length > 0) {
				const text = foldForSearch(cell?.text ?? '');
				if (!words.every((word) => text.includes(word))) return false;
			}
			return true;
		};
	});
	return rows.filter((row) => tests.every((test) => test(row)));
}

/* The Sum row ------------------------------------------------------------- */

/** A cell's number, from its sort value or else its text ("1,467" is 1467); undefined when it has none. */
function numberOf(cell: TableCell | undefined): number | undefined {
	const value = cell?.sortValue ?? cell?.text;
	if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
	if (value === undefined) return undefined;
	const parsed = Number(String(value).replaceAll(',', '').trim());
	return String(value).trim() !== '' && Number.isFinite(parsed) ? parsed : undefined;
}

/** What a column adds up to over the rows given, for the table's Sum row. */
export function columnTotal(column: TableColumn, rows: TableRow[]): number {
	return rows.reduce((total, row) => total + (numberOf(row.cells[column.key]) ?? 0), 0);
}

/* Columns a reader shows and hides ---------------------------------------- */

/** The columns a table shows before a reader changes them: all but the optional ones. */
export function defaultColumnKeys(columns: TableColumn[]): string[] {
	return columns.filter((column) => !column.optional).map((column) => column.key);
}

/**
 * The columns to draw, in the table's own order: the ones chosen, and always
 * the row header, which names each row. With nothing chosen, the default.
 */
export function shownColumnsOf(columns: TableColumn[], chosen: string[] | undefined): TableColumn[] {
	const keys = new Set(chosen ?? defaultColumnKeys(columns));
	const rowHeader = columns.find((column) => column.isRowHeader) ?? columns[0];
	return columns.filter((column) => column === rowHeader || keys.has(column.key));
}

/* A table's state in the page address ------------------------------------ */

/** What a reader has done to a table: the search text, the sort, the column filters and the columns shown. */
export interface TableState {
	query: string;
	sort?: TableSort;
	filters: ColumnFilters;
	/** The keys of the columns shown, when the reader changed them. */
	columns?: string[];
}

/**
 * Writes a table's state into the page address, so a copied link opens the
 * table the same way. Each parameter starts with the table's identifier, so
 * two tables on one page keep apart: "nations-a.q=paiute",
 * "nations-a.sort=-states" (a minus sign for descending),
 * "nations-a.states=Nevada&nations-a.states=Utah" (one for each value
 * ticked), "nations-a.name.contains=paiute" and
 * "nations-a.columns=name,states". The default sort and columns and empty
 * values are left out.
 */
export function writeTableState(
	identifier: string,
	state: TableState,
	parameters: URLSearchParams,
	defaultSort?: TableSort
): URLSearchParams {
	const next = new URLSearchParams(parameters);
	for (const name of [...next.keys()]) {
		if (name.startsWith(`${identifier}.`)) next.delete(name);
	}
	if (state.query.trim() !== '') next.set(`${identifier}.q`, state.query.trim());
	const sort = state.sort;
	if (sort && (sort.key !== defaultSort?.key || sort.direction !== defaultSort?.direction)) {
		next.set(`${identifier}.sort`, `${sort.direction === 'descending' ? '-' : ''}${sort.key}`);
	}
	for (const [key, filter] of Object.entries(state.filters)) {
		for (const value of filter.values ?? []) if (value) next.append(`${identifier}.${key}`, value);
		if ((filter.contains ?? '').trim() !== '') next.set(`${identifier}.${key}.contains`, filter.contains!.trim());
	}
	if (state.columns) next.set(`${identifier}.columns`, state.columns.join(','));
	return next;
}

/** Reads a table's state back from the page address; unknown columns and values are ignored. */
export function readTableState(identifier: string, columns: TableColumn[], parameters: URLSearchParams): TableState {
	const state: TableState = { query: parameters.get(`${identifier}.q`) ?? '', filters: {} };
	const sortText = parameters.get(`${identifier}.sort`);
	if (sortText) {
		const descending = sortText.startsWith('-');
		const key = descending ? sortText.slice(1) : sortText;
		if (columns.some((column) => column.key === key && column.sortable)) {
			state.sort = { key, direction: descending ? 'descending' : 'ascending' };
		}
	}
	for (const column of columns) {
		const kind = filterKind(column);
		if (kind === 'values') {
			const values = parameters.getAll(`${identifier}.${column.key}`).filter(Boolean);
			if (values.length > 0) state.filters[column.key] = { values: [...new Set(values)] };
		} else if (kind === 'contains') {
			const contains = parameters.get(`${identifier}.${column.key}.contains`)?.trim();
			if (contains) state.filters[column.key] = { contains };
		}
	}
	const shown = parameters.get(`${identifier}.columns`);
	if (shown !== null) {
		const known = new Set(columns.map((column) => column.key));
		state.columns = [...new Set(shown.split(','))].filter((key) => known.has(key));
	}
	return state;
}

/* Download ---------------------------------------------------------------- */

/** Quotes a value for CSV (RFC 4180, section 2). */
function csvField(value: string): string {
	return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** A downloaded table's cell: its text and, for a linked column's own cell, the address it links to. */
export interface DownloadCell {
	text: string;
	link?: string;
}

/**
 * The rows laid out for a download, the same for the .csv and the .xlsx file:
 * a header row of column headers, then one line per row with each cell's text,
 * and a link's address in a column of its own after the cell, so a spreadsheet
 * keeps both. An address on this site is made whole with `origin`.
 */
export function downloadCells(columns: TableColumn[], rows: TableRow[], origin = ''): { header: string[]; lines: DownloadCell[][] } {
	const linked = columns.filter((column) => rows.some((row) => row.cells[column.key]?.href));
	const header: string[] = [];
	for (const column of columns) {
		header.push(column.header);
		if (linked.includes(column)) header.push(`${column.header} (link)`);
	}
	const lines = rows.map((row) => {
		const fields: DownloadCell[] = [];
		for (const column of columns) {
			const cell = row.cells[column.key];
			const href = cell?.href ?? '';
			const link = href.startsWith('/') ? `${origin}${href}` : href;
			fields.push(link ? { text: cell?.text ?? '', link } : { text: cell?.text ?? '' });
			if (linked.includes(column)) fields.push({ text: link });
		}
		return fields;
	});
	return { header, lines };
}

/**
 * The rows as comma-separated values (RFC 4180), laid out as `downloadCells`
 * lays them out. Lines end in CR LF, as the RFC asks.
 */
export function rowsToCsv(columns: TableColumn[], rows: TableRow[], origin = ''): string {
	const { header, lines } = downloadCells(columns, rows, origin);
	const text = lines.map((fields) => fields.map((field) => csvField(field.text)).join(','));
	return `${[header.map(csvField).join(','), ...text].join('\r\n')}\r\n`;
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
