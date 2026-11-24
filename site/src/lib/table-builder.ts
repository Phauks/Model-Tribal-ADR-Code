/**
 * Build a table (/nations/data/build): a reader picks one of the site's
 * datasets, chooses its columns, filters it, groups it and counts or sums
 * it, and sees the result in the shared table and chart (Trevor, Nov. 24,
 * 2026: "build functionality so people can build their own tables too").
 *
 * Everything here runs in the browser and in tests: the build writes each
 * dataset once as JSON (src/lib/server/table-builder-datasets.ts), and these
 * functions turn a dataset and the reader's settings into the DataTable's
 * columns and rows, or a BarChart's bars. The settings live in the page
 * address, so a built table can be bookmarked and shared.
 *
 * Every count opens to the rows it counts (site/DESIGN.md, "Every count
 * opens to its records"): a grouped count links to the same dataset with
 * that group's filter added and the grouping taken off.
 */
import type { BarChartData } from './bar-chart.ts';
import { readableDate } from './readable-date.ts';
import { filterIsActive, foldForSearch, type ColumnFilter, type ColumnFilters, type TableColumn, type TableRow } from './tables/table-definition.ts';

export type BuilderColumnType = 'text' | 'number' | 'date' | 'list';

export interface BuilderColumn {
	key: string;
	header: string;
	/** A list column holds several values per row, such as a nation's states; a row counts under each. */
	type: BuilderColumnType;
	/** Shown before the reader chooses columns. */
	starting?: boolean;
}

/** One cell's value: text, a number, or a list of texts. Null when nothing is recorded. */
export type BuilderValue = string | number | string[] | null;

export interface BuilderDataset {
	identifier: string;
	/** What the dataset menu calls it, such as "Native nations". */
	title: string;
	/** What one row is: [singular, plural]. */
	rowName: [string, string];
	/** The column that names each row and links to its page. */
	nameColumn: string;
	/** The column of nation names, for "Number of nations"; left out for the nations dataset itself. */
	nationColumn?: string;
	columns: BuilderColumn[];
	/** One array per row, in the order of columns. */
	rows: BuilderValue[][];
	/** Each row's page, in the order of rows; empty when a row has none. */
	links: string[];
	/** Where the data comes from, linked under the result. */
	sourceHref: string;
}

/** What the dataset menu needs before a dataset is fetched. */
export interface BuilderDatasetSummary {
	identifier: string;
	title: string;
	rowCount: number;
}

/** How each group is measured. */
export type BuilderMeasure = { kind: 'rows' } | { kind: 'nations' } | { kind: 'sum' | 'average'; column: string };

export interface BuilderSettings {
	dataset: string;
	/** The columns shown when the rows are not grouped, in the dataset's order. */
	columns: string[];
	/**
	 * Each filtered column's filter, as the shared table's header filters set it (Trevor, Nov. 24, 2026: filters sit on
	 * the column headers): the values ticked, any of which a row may have, or words the cell contains.
	 */
	filters: ColumnFilters;
	/** The column whose values become the result's rows. */
	groupBy?: string;
	/** A second column whose values become the result's columns. */
	across?: string;
	measure: BuilderMeasure;
}

/** Where the page lives, and each dataset's file. */
export const builderPath = '/nations/data/build';
export const builderDatasetPath = (identifier: string): string => `${builderPath}/${identifier}.json`;

/** The text a value shows, and the values a filter or group matches. */
export function valuesOf(value: BuilderValue): string[] {
	if (value === null || value === '') return [];
	if (Array.isArray(value)) return value;
	return [String(value)];
}

function textOf(value: BuilderValue): string {
	if (typeof value === 'number') return value.toLocaleString('en-US');
	return valuesOf(value).join(', ');
}

export function startingSettings(dataset: BuilderDataset): BuilderSettings {
	return {
		dataset: dataset.identifier,
		columns: dataset.columns.filter((column) => column.starting).map((column) => column.key),
		filters: {},
		measure: { kind: 'rows' }
	};
}

/* Address --------------------------------------------------------------- */

function measureText(measure: BuilderMeasure): string {
	return measure.kind === 'sum' || measure.kind === 'average' ? `${measure.kind}.${measure.column}` : measure.kind;
}

/** Writes the settings into address parameters, leaving out what matches the dataset's starting settings. */
export function settingsToAddress(settings: BuilderSettings, dataset: BuilderDataset): URLSearchParams {
	const parameters = new URLSearchParams();
	parameters.set('data', settings.dataset);
	const starting = startingSettings(dataset).columns.join(',');
	if (settings.columns.join(',') !== starting) parameters.set('columns', settings.columns.join(','));
	for (const [key, filter] of Object.entries(settings.filters)) {
		for (const value of filter.values ?? []) if (value) parameters.append(`where.${key}`, value);
		if ((filter.contains ?? '').trim() !== '') parameters.set(`where.${key}.contains`, filter.contains!.trim());
	}
	if (settings.groupBy) parameters.set('group', settings.groupBy);
	if (settings.groupBy && settings.across) parameters.set('across', settings.across);
	if (settings.measure.kind !== 'rows') parameters.set('value', measureText(settings.measure));
	return parameters;
}

/** Reads settings back from the address; columns the dataset lacks are ignored. */
export function settingsFromAddress(parameters: URLSearchParams, dataset: BuilderDataset): BuilderSettings {
	const known = new Map(dataset.columns.map((column) => [column.key, column]));
	const settings = startingSettings(dataset);
	const columns = parameters.get('columns');
	if (columns !== null) {
		const chosen = new Set(columns.split(',').filter((key) => known.has(key)));
		settings.columns = dataset.columns.filter((column) => chosen.has(column.key)).map((column) => column.key);
	}
	for (const column of dataset.columns) {
		if (column.type === 'number') continue;
		const values = [...new Set(parameters.getAll(`where.${column.key}`).filter(Boolean))];
		const contains = parameters.get(`where.${column.key}.contains`)?.trim() ?? '';
		const filter: ColumnFilter = { ...(values.length > 0 ? { values } : {}), ...(contains ? { contains } : {}) };
		if (filterIsActive(filter)) settings.filters[column.key] = filter;
	}
	const groupBy = parameters.get('group') ?? '';
	if (known.has(groupBy) && known.get(groupBy)?.type !== 'number') settings.groupBy = groupBy;
	const across = parameters.get('across') ?? '';
	if (settings.groupBy && across !== settings.groupBy && known.has(across) && known.get(across)?.type !== 'number') settings.across = across;
	const value = parameters.get('value') ?? '';
	if (value === 'nations' && dataset.nationColumn) settings.measure = { kind: 'nations' };
	const [kind, column] = value.split('.');
	if ((kind === 'sum' || kind === 'average') && known.get(column)?.type === 'number') settings.measure = { kind, column };
	return settings;
}

export function builderLink(settings: BuilderSettings, dataset: BuilderDataset): string {
	return `${builderPath}?${settingsToAddress(settings, dataset)}`;
}

/* Filtering ------------------------------------------------------------- */

function columnIndex(dataset: BuilderDataset, key: string): number {
	return dataset.columns.findIndex((column) => column.key === key);
}

/**
 * The indexes of the rows that pass every filter, as the shared table filters them (applyColumnFilters in
 * src/lib/tables/table-definition.ts): a row passes a filter of values when its cell has any value ticked (a list cell,
 * any of its values), and a "Contains" filter when its cell holds every word typed.
 */
export function filteredRowIndexes(dataset: BuilderDataset, filters: ColumnFilters, except?: string): number[] {
	const checks = Object.entries(filters)
		.filter(([key, filter]) => key !== except && filterIsActive(filter))
		.map(([key, filter]) => ({
			index: columnIndex(dataset, key),
			wanted: new Set(filter.values ?? []),
			words: foldForSearch(filter.contains ?? '').split(/\s+/).filter(Boolean)
		}))
		.filter((check) => check.index >= 0);
	const kept: number[] = [];
	dataset.rows.forEach((row, rowIndex) => {
		const passes = checks.every((check) => {
			const value = row[check.index];
			if (check.wanted.size > 0 && !valuesOf(value).some((each) => check.wanted.has(each))) return false;
			if (check.words.length > 0) {
				const text = foldForSearch(textOf(value));
				if (!check.words.every((word) => text.includes(word))) return false;
			}
			return true;
		});
		if (passes) kept.push(rowIndex);
	});
	return kept;
}

/** A column's values with how many rows each keeps, given the other filters, in reading order as the shared table lists them. */
export function filterOptions(dataset: BuilderDataset, filters: ColumnFilters, key: string): { value: string; count: number }[] {
	const index = columnIndex(dataset, key);
	const counts = new Map<string, number>();
	for (const rowIndex of filteredRowIndexes(dataset, filters, key)) {
		for (const value of new Set(valuesOf(dataset.rows[rowIndex][index]))) counts.set(value, (counts.get(value) ?? 0) + 1);
	}
	return [...counts]
		.map(([value, count]) => ({ value, count }))
		.sort((first, second) => first.value.localeCompare(second.value, 'en', { numeric: true, sensitivity: 'base' }));
}

/** What kind of filter a column takes: a list of values to tick, or "Contains" for the column naming each row; numbers take none. */
export function builderFilterKind(dataset: BuilderDataset, key: string): 'values' | 'contains' | undefined {
	const column = dataset.columns.find((candidate) => candidate.key === key);
	if (!column || column.type === 'number') return undefined;
	return key === dataset.nameColumn ? 'contains' : 'values';
}

/* Results --------------------------------------------------------------- */

/**
 * The columns and rows of the ungrouped table: one row per record, the name linked to its page, a list cell's values
 * kept apart for its filter. Placed elsewhere, it has the chosen columns and the rows the filters leave. On the page
 * itself (`whole`), it has every column and every row: the shared table shows the chosen columns, with the rest in its
 * list of columns, and filters the rows from the column headers (Trevor, Nov. 24, 2026: one flow for readers and the
 * team, so the builder uses the table's own column chooser and header filters).
 */
export function recordTable(dataset: BuilderDataset, settings: BuilderSettings, whole = false): { columns: TableColumn[]; rows: TableRow[] } {
	const shown = whole ? dataset.columns : dataset.columns.filter((column) => column.key === dataset.nameColumn || settings.columns.includes(column.key));
	const columns: TableColumn[] = shown.map((column) => {
		const kind = builderFilterKind(dataset, column.key);
		return {
			key: column.key,
			header: column.header,
			type: column.type === 'number' ? 'number' : column.type === 'date' ? 'date' : 'text',
			isRowHeader: column.key === dataset.nameColumn,
			sortable: true,
			searchable: column.type !== 'number',
			filterable: kind === 'values',
			optional: !column.starting && column.key !== dataset.nameColumn
		};
	});
	const indexes = shown.map((column) => columnIndex(dataset, column.key));
	const kept = whole ? dataset.rows.map((_, rowIndex) => rowIndex) : filteredRowIndexes(dataset, settings.filters);
	const rows = kept.map((rowIndex) => {
		const row = dataset.rows[rowIndex];
		const cells: TableRow['cells'] = {};
		shown.forEach((column, position) => {
			const value = row[indexes[position]];
			cells[column.key] = {
				text: textOf(value),
				sortValue: typeof value === 'number' ? value : undefined,
				href: column.key === dataset.nameColumn ? dataset.links[rowIndex] || undefined : undefined,
				values: Array.isArray(value) ? value : undefined
			};
		});
		return { key: String(rowIndex), cells };
	});
	return { columns, rows };
}

/**
 * The columns a reader chose in the shared table's list of columns, in the dataset's order, as the settings keep them:
 * the starting columns when the reader resets them. The name column is always shown, so it is kept as the starting
 * columns keep it.
 */
export function chosenColumns(dataset: BuilderDataset, keys: string[] | undefined): string[] {
	const starting = startingSettings(dataset).columns;
	if (!keys) return starting;
	const chosen = new Set(keys);
	return dataset.columns
		.filter((column) => (column.key === dataset.nameColumn ? starting.includes(column.key) : chosen.has(column.key)))
		.map((column) => column.key);
}

/** What the value column is called, such as "Native nations" or "Average of Words". */
export function measureHeader(dataset: BuilderDataset, measure: BuilderMeasure): string {
	if (measure.kind === 'rows') return capitalized(dataset.rowName[1]);
	if (measure.kind === 'nations') return 'Nations';
	const header = dataset.columns.find((column) => column.key === measure.column)?.header ?? measure.column;
	return `${measure.kind === 'sum' ? 'Sum' : 'Average'} of ${header.toLocaleLowerCase('en-US')}`;
}

const capitalized = (text: string): string => text.charAt(0).toLocaleUpperCase('en-US') + text.slice(1);

/** Measures one group of rows. */
function measured(dataset: BuilderDataset, measure: BuilderMeasure, rowIndexes: number[]): number {
	if (measure.kind === 'rows') return rowIndexes.length;
	if (measure.kind === 'nations') {
		const index = columnIndex(dataset, dataset.nationColumn ?? '');
		return new Set(rowIndexes.flatMap((rowIndex) => valuesOf(dataset.rows[rowIndex][index]))).size;
	}
	const index = columnIndex(dataset, measure.column);
	const numbers = rowIndexes.map((rowIndex) => dataset.rows[rowIndex][index]).filter((value): value is number => typeof value === 'number');
	const sum = numbers.reduce((total, value) => total + value, 0);
	if (measure.kind === 'sum') return sum;
	return numbers.length === 0 ? 0 : Math.round((sum / numbers.length) * 10) / 10;
}

/** The label a row with no value in the grouped column counts under. */
export const notRecorded = 'Not recorded';

/** Groups rows by a column's values; a list cell counts under each of its values. Groups come largest first by the measure (dates in date order), "Not recorded" last. */
function grouped(dataset: BuilderDataset, key: string, rowIndexes: number[], measure: BuilderMeasure): Map<string, number[]> {
	const index = columnIndex(dataset, key);
	const groups = new Map<string, number[]>();
	for (const rowIndex of rowIndexes) {
		const values = valuesOf(dataset.rows[rowIndex][index]);
		for (const value of values.length > 0 ? new Set(values) : [notRecorded]) groups.set(value, [...(groups.get(value) ?? []), rowIndex]);
	}
	const type = dataset.columns[index]?.type;
	const sizes = new Map([...groups].map(([label, members]) => [label, measured(dataset, measure, members)]));
	return new Map(
		[...groups].sort(([first], [second]) => {
			if (first === notRecorded || second === notRecorded) return first === notRecorded ? 1 : -1;
			if (type === 'date') return first.localeCompare(second);
			return (sizes.get(second) ?? 0) - (sizes.get(first) ?? 0) || first.localeCompare(second, 'en', { numeric: true, sensitivity: 'base' });
		})
	);
}

/** The link a group's count opens: the same rows, filtered to the group, ungrouped. */
function drillLink(dataset: BuilderDataset, settings: BuilderSettings, added: Record<string, string>): string {
	const filters = { ...settings.filters };
	for (const [key, value] of Object.entries(added)) {
		if (value !== notRecorded) filters[key] = { ...filters[key], values: [value] };
	}
	return builderLink({ ...settings, filters, groupBy: undefined, across: undefined, measure: { kind: 'rows' } }, dataset);
}

function headerOf(dataset: BuilderDataset, key: string): string {
	return dataset.columns.find((column) => column.key === key)?.header ?? key;
}

/** A sentence-case title for a grouped result, such as "Native nations by state". */
export function resultTitle(dataset: BuilderDataset, settings: BuilderSettings): string {
	const what = settings.measure.kind === 'rows' ? capitalized(dataset.rowName[1]) : measureHeader(dataset, settings.measure);
	const by = [settings.groupBy, settings.across].filter((key): key is string => Boolean(key)).map((key) => headerOf(dataset, key).toLocaleLowerCase('en-US'));
	const where = Object.values(settings.filters).flatMap((filter) => [...(filter.values ?? []), ...(filter.contains ? [`“${filter.contains}”`] : [])]);
	return `${what}${by.length > 0 ? ` by ${by.join(' and ')}` : ''}${where.length > 0 ? `: ${where.join(', ')}` : ''}`;
}

/** The grouped result as a bar chart, which also shows as a pie when each row counts under one group, and as a table. */
export function groupedChart(dataset: BuilderDataset, settings: BuilderSettings): BarChartData | undefined {
	if (!settings.groupBy || settings.across) return undefined;
	const groupColumn = dataset.columns.find((column) => column.key === settings.groupBy);
	const groups = grouped(dataset, settings.groupBy, filteredRowIndexes(dataset, settings.filters), settings.measure);
	return {
		identifier: 'built-table',
		title: resultTitle(dataset, settings),
		description: '',
		labelHeader: headerOf(dataset, settings.groupBy),
		valueHeader: measureHeader(dataset, settings.measure),
		source: dataset.title,
		sourceHref: dataset.sourceHref,
		bars: [...groups].map(([label, rowIndexes]) => ({
			label,
			value: measured(dataset, settings.measure, rowIndexes),
			href: drillLink(dataset, settings, { [settings.groupBy as string]: label })
		})),
		shown: 20,
		partsOfWhole: groupColumn?.type !== 'list' && settings.measure.kind === 'rows'
	};
}

/** The two-way result: one row per value of groupBy, one column per value of across, and a Total column. */
export function crossTable(dataset: BuilderDataset, settings: BuilderSettings): { columns: TableColumn[]; rows: TableRow[] } | undefined {
	if (!settings.groupBy || !settings.across) return undefined;
	const kept = filteredRowIndexes(dataset, settings.filters);
	const rowGroups = grouped(dataset, settings.groupBy, kept, settings.measure);
	const columnGroups = [...grouped(dataset, settings.across, kept, settings.measure).keys()];
	const acrossIndex = columnIndex(dataset, settings.across);
	// A Sum row adds up each column (Trevor, Nov. 24, 2026: "If you have a total, just put a Sum Row at the bottom of the table"), where the parts make a whole: each row counted under one group, and a count or a sum measured.
	const sum = dataset.columns.find((column) => column.key === settings.groupBy)?.type !== 'list' && (settings.measure.kind === 'rows' || settings.measure.kind === 'sum');
	const columns: TableColumn[] = [
		{ key: 'group', header: headerOf(dataset, settings.groupBy), isRowHeader: true, sortable: true },
		...columnGroups.map((value, position) => ({ key: `across-${position}`, header: value, type: 'number' as const, sortable: true, sum })),
		{ key: 'total', header: 'Total', type: 'number', sortable: true, sum }
	];
	const cellOf = (value: number, href: string) => ({ text: value === 0 ? '' : value.toLocaleString('en-US'), sortValue: value, href: value === 0 ? undefined : href });
	const rows: TableRow[] = [...rowGroups].map(([label, rowIndexes]) => {
		const cells: TableRow['cells'] = { group: { text: label } };
		columnGroups.forEach((value, position) => {
			const inColumn = rowIndexes.filter((rowIndex) => {
				const values = valuesOf(dataset.rows[rowIndex][acrossIndex]);
				return value === notRecorded ? values.length === 0 : values.includes(value);
			});
			cells[`across-${position}`] = cellOf(measured(dataset, settings.measure, inColumn), drillLink(dataset, settings, { [settings.groupBy as string]: label, [settings.across as string]: value }));
		});
		cells.total = cellOf(measured(dataset, settings.measure, rowIndexes), drillLink(dataset, settings, { [settings.groupBy as string]: label }));
		return { key: label, cells };
	});
	return { columns, rows };
}

/* Placing a built table elsewhere --------------------------------------- */

/** The dataset a Build a table address names, and the address's parameters; undefined when it isn't one. */
export function builderAddressParts(link: string): { dataset: string; parameters: URLSearchParams } | undefined {
	let url: URL;
	try {
		url = new URL(link, 'https://site.invalid');
	} catch {
		return undefined;
	}
	if (url.pathname !== builderPath) return undefined;
	const dataset = url.searchParams.get('data');
	return dataset ? { dataset, parameters: url.searchParams } : undefined;
}

/** What a built table is, wherever it is placed: a chart for one grouping, a table otherwise, with the address that rebuilds it. */
export type BuiltResult =
	| { kind: 'chart'; title: string; chart: BarChartData; link: string }
	| { kind: 'table'; title: string; columns: TableColumn[]; rows: TableRow[]; link: string };

/** Works out what a Build a table address shows, from its dataset. */
export function builtResult(dataset: BuilderDataset, parameters: URLSearchParams): BuiltResult {
	const settings = settingsFromAddress(parameters, dataset);
	const link = builderLink(settings, dataset);
	const title = resultTitle(dataset, settings);
	const chart = groupedChart(dataset, settings);
	if (chart) return { kind: 'chart', title, chart, link };
	const table = crossTable(dataset, settings) ?? recordTable(dataset, settings);
	return { kind: 'table', title, columns: table.columns, rows: table.rows, link };
}

/** A built chart as an essay's chart figure takes it (src/lib/essays/figures.ts). */
export interface EssayChart {
	caption: string;
	labelHeader: string;
	valueHeader: string;
	rows: [string, number][];
	/** Names the data and the day, and links back to the builder. */
	credit: string;
}

/** A built chart as an essay chart, with its numbers as they are on the given day; null when the result is not a chart of one grouping. */
export function essayChartOf(dataset: BuilderDataset, parameters: URLSearchParams, today: string): EssayChart | null {
	const result = builtResult(dataset, parameters);
	if (result.kind !== 'chart') return null;
	return {
		caption: result.title,
		labelHeader: result.chart.labelHeader,
		valueHeader: result.chart.valueHeader,
		rows: result.chart.bars.map((bar) => [bar.label, bar.value]),
		credit: `${dataset.title}, as of ${today}: [Build a table](${result.link})`
	};
}

/**
 * The essay editor's "Add to essay" (Trevor, Nov. 24, 2026: making our own charts should be "the same flow"): reads a
 * Build a table address, fetches its dataset and gives the chart to place, dated today. Null for an address it can't
 * read or a result that isn't a chart. Runs in the browser.
 */
export async function essayChartFrom(link: string, fetcher: typeof fetch = fetch): Promise<EssayChart | null> {
	const parts = builderAddressParts(link);
	if (!parts) return null;
	try {
		const response = await fetcher(builderDatasetPath(parts.dataset));
		if (!response.ok) return null;
		const dataset = (await response.json()) as BuilderDataset;
		return essayChartOf(dataset, parts.parameters, readableDate(new Date().toISOString().slice(0, 10)));
	} catch {
		return null;
	}
}
