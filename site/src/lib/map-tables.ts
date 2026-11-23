/**
 * The tables beside each view of the map on /nations/map: their columns and rows, built the same way for the page and for each table's CSV file (/nations/map/tables/<table>.csv), which the masthead's Download menu offers for the view on screen (Trevor, 2026-11-23: downloads belong in the Download menu, not under the map).
 */
import { shadedViewDefinitions, type ShadedMapView } from './shaded-map-views.ts';
import type { TableColumn, TableRow } from './tables/table-definition.ts';
import type { LandAreaRow, ShadedViewData } from './server/nations-map.ts';

/** What a shaded view's table needs: the view's data without its drawings. */
export type ShadedTableData = Pick<ShadedViewData, 'view' | 'section' | 'nationRows' | 'areaRows' | 'kindColumns' | 'stateColumns' | 'stateRows'>;

interface PlaceRow {
	name: string;
	nations: unknown[];
}

/*
 * A count column is drawn by the page (custom), so the number opens the row's
 * list of nations (Trevor, Nov. 23, 2026: "all tables should be clickable into
 * the data to explain itself"); the CSV keeps the plain number.
 */
export const stateColumns: TableColumn[] = [
	{ key: 'state', header: 'State or territory', isRowHeader: true, sortable: true, custom: true },
	{ key: 'count', header: 'Nations', type: 'number', sortable: true, custom: true }
];

export function stateRows(rows: (PlaceRow & { code: string })[]): TableRow[] {
	return rows.map((row) => ({
		key: `state-${row.code}`,
		anchor: `state-${row.code}`,
		cells: {
			state: { text: row.name },
			count: { text: row.nations.length.toLocaleString('en-US'), sortValue: row.nations.length }
		}
	}));
}

export const regionColumns: TableColumn[] = [
	{ key: 'region', header: 'Region', isRowHeader: true, sortable: true, custom: true },
	{ key: 'count', header: 'Nations', type: 'number', sortable: true, custom: true }
];

export function regionRows(rows: (PlaceRow & { anchor: string; states: string[] })[]): TableRow[] {
	return rows.map((row) => ({
		key: row.anchor,
		anchor: row.anchor,
		cells: {
			region: { text: row.name },
			count: { text: row.nations.length.toLocaleString('en-US'), sortValue: row.nations.length },
			// Not a column: shown when the region's row is opened.
			states: { text: row.states.join(', ') }
		}
	}));
}

export const landAreaColumns: TableColumn[] = [
	{ key: 'area', header: 'Area', isRowHeader: true, sortable: true, custom: true },
	{ key: 'kind', header: 'Kind', sortable: true, filterable: true },
	{ key: 'count', header: 'Nations linked', type: 'number', sortable: true, custom: true }
];

export function landAreaRows(rows: LandAreaRow[]): TableRow[] {
	return rows.map((row) => ({
		key: row.anchor,
		anchor: row.anchor,
		cells: {
			area: { text: row.name },
			kind: { text: row.kindLabel },
			count: { text: row.nations.length.toLocaleString('en-US'), sortValue: row.nations.length }
		}
	}));
}

/** Most shaded views' tables list nations; each name goes to the section of the nation's page that has the view's facts and their sources. */
export function nationColumns(body: ShadedTableData): TableColumn[] {
	const first: TableColumn[] = [
		{ key: 'nation', header: 'Nation', isRowHeader: true, sortable: true },
		{ key: 'states', header: 'States', sortable: true, filterable: true }
	];
	// Some tables say which kinds each nation has, one Yes column each, since the map can shade only one.
	if (body.kindColumns.length > 0) {
		return [...first, ...body.kindColumns.map((column) => ({ key: `kind-${column.key}`, header: column.header, sortable: true, filterable: true }))];
	}
	return [...first, { key: 'category', header: shadedViewDefinitions[body.view].categoryHeader ?? 'Category', sortable: true, filterable: true }];
}

export function nationRows(body: ShadedTableData): TableRow[] {
	return body.nationRows.map((row) => ({
		key: row.anchor,
		anchor: row.anchor,
		cells: {
			nation: { text: row.name, href: `/nations/${row.id}#${body.section}` },
			states: { text: row.states.join(', '), values: row.states },
			category: { text: row.category },
			...Object.fromEntries(body.kindColumns.map((column) => [`kind-${column.key}`, { text: (row.kinds as Record<string, boolean>)[column.key] ? 'Yes' : '' }]))
		}
	}));
}

/** A shaded view whose table lists categories, as the Indian Health Service view lists its Areas, or land areas, as the Census Residents view does: each row opens to its nations. */
export function categoryColumns(body: ShadedTableData): TableColumn[] {
	const definition = shadedViewDefinitions[body.view];
	return [
		{ key: 'area', header: definition.categoryHeader ?? 'Category', isRowHeader: true, sortable: true, custom: true },
		...(definition.valueHeader ? [{ key: 'value', header: definition.valueHeader, type: 'number' as const, sortable: true }] : []),
		{ key: 'count', header: 'Nations', type: 'number', sortable: true, custom: true }
	];
}

export function categoryRows(body: ShadedTableData): TableRow[] {
	return body.areaRows.map((row) => ({
		key: row.anchor,
		anchor: row.anchor,
		cells: {
			area: { text: row.name },
			value: { text: row.value?.toLocaleString('en-US') ?? '', sortValue: row.value ?? 0 },
			count: { text: row.nations.length.toLocaleString('en-US'), sortValue: row.nations.length },
			// Not a column: shown when the Area's row is opened.
			states: { text: row.states.join(', ') }
		}
	}));
}

/** A shaded view by state: each state's nations, and how many have each category. */
export function byStateColumns(body: ShadedTableData): TableColumn[] {
	return [
		{ key: 'state', header: 'State', isRowHeader: true, sortable: true },
		// Each count opens to the nations it is made of (Trevor, Nov. 23, 2026: every table opens to the data behind it).
		{ key: 'total', header: 'Nations', type: 'number', sortable: true, custom: true },
		...body.stateColumns.map((column) => ({ key: `count-${column.key}`, header: column.header, type: 'number' as const, sortable: true, custom: true }))
	];
}

export function byStateRows(body: ShadedTableData): TableRow[] {
	return body.stateRows.map((row) => ({
		key: row.anchor,
		anchor: row.anchor,
		cells: {
			state: { text: row.name, href: `/nations/state/${row.code.toLowerCase()}` },
			total: { text: row.total.toLocaleString('en-US'), sortValue: row.total },
			...Object.fromEntries(
				body.stateColumns.map((column) => {
					const count = (row.counts as Record<string, number>)[column.key] ?? 0;
					return [`count-${column.key}`, { text: count.toLocaleString('en-US'), sortValue: count }];
				})
			)
		}
	}));
}

/** The table a shaded view shows by nation. */
export function shadedTable(body: ShadedTableData): { columns: TableColumn[]; rows: TableRow[] } {
	return shadedViewDefinitions[body.view].rows === 'nations' ? { columns: nationColumns(body), rows: nationRows(body) } : { columns: categoryColumns(body), rows: categoryRows(body) };
}

/** The name of a view's table file, and of its by-state table's. */
export function mapTableFile(view: string, by: 'nation' | 'state' = 'nation'): string {
	if (by === 'state') return `${view}-by-state`;
	return ({ states: 'nations-by-state', lands: 'land-areas' } as Record<string, string>)[view] ?? view;
}

/** Whether a shaded view has a table by state; the same test the page uses to offer the switch. */
export const hasStateTable = (view: ShadedMapView, body: Pick<ShadedTableData, 'stateRows'>): boolean => body.stateRows.length > 0 && shadedViewDefinitions[view].byState !== false;
