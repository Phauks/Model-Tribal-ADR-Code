import { error } from '@sveltejs/kit';
import { byStateColumns, byStateRows, hasStateTable, landAreaColumns, landAreaRows, mapTableFile, regionColumns, regionRows, shadedTable, stateColumns, stateRows } from '#lib/map-tables.ts';
import { landAreasView, nationsMapPage, shadedView } from '#lib/server/nations-map.ts';
import { shadedMapViews } from '#lib/shaded-map-views.ts';
import { rowsToCsv, type TableColumn, type TableRow } from '#lib/tables/table-definition.ts';
import type { EntryGenerator, RequestHandler } from './$types';
import { csvResponse } from '#lib/csv.ts';

// Each map view's table as a CSV file, for the masthead's Download menu (src/lib/page-downloads.ts), which offers the one for the view on screen. Built with the site, from the same columns and rows as the tables on /nations/map.
export const prerender = true;

function tables(): Map<string, () => { columns: TableColumn[]; rows: TableRow[] }> {
	const found = new Map<string, () => { columns: TableColumn[]; rows: TableRow[] }>([
		[mapTableFile('states'), () => ({ columns: stateColumns, rows: stateRows(nationsMapPage().stateRows) })],
		[mapTableFile('regions'), () => ({ columns: regionColumns, rows: regionRows(nationsMapPage().regionRows) })],
		[mapTableFile('lands'), () => ({ columns: landAreaColumns, rows: landAreaRows(landAreasView().rows) })]
	]);
	for (const view of shadedMapViews) {
		found.set(mapTableFile(view), () => shadedTable(shadedView(view)));
		if (hasStateTable(view, shadedView(view))) found.set(mapTableFile(view, 'state'), () => ({ columns: byStateColumns(shadedView(view)), rows: byStateRows(shadedView(view)) }));
	}
	return found;
}

export const entries: EntryGenerator = () => [...tables().keys()].map((table) => ({ table }));

export const GET: RequestHandler = ({ params }) => {
	const build = tables().get(params.table);
	if (!build) error(404, 'There is no map table by that name');
	const { columns, rows } = build();
	// Addresses are written from the site's root, since the file is built before the site has a domain.
	return csvResponse(rowsToCsv(columns, rows), { fileName: `${params.table}.csv` });
};
