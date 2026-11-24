import type { BarChartData } from '#lib/bar-chart.ts';
import type { TableColumn, TableRow } from '#lib/tables/table-definition.ts';
import { noneIdentified } from '#lib/search-status.ts';
import { coverageRows, coverageSections } from '#lib/server/coverage.ts';
import type { PageServerLoad } from './$types';

/** What a cell says when the section has something on record. */
const foundText = 'Found';

export const load: PageServerLoad = () => {
	const rows = coverageRows();
	const chart: BarChartData = {
		identifier: 'coverage-gaps',
		title: 'Sections with None Identified',
		description: 'How many nation pages say None Identified in each section.',
		labelHeader: 'Section',
		valueHeader: 'Nations',
		source: 'The nation pages',
		sourceHref: '/nations',
		bars: coverageSections.map((section) => ({
			label: section.label,
			value: rows.filter((row) => !row.found[section.key]).length,
			href: `/nations/coverage?coverage.${section.key}=${encodeURIComponent(noneIdentified.text)}#coverage-table`
		}))
	};
	const columns: TableColumn[] = [
		{ key: 'name', header: 'Nation', isRowHeader: true, sortable: true, searchable: true },
		{ key: 'states', header: 'States', sortable: true, filterable: true },
		...coverageSections.map((section) => ({ key: section.key, header: section.label, sortable: true, filterable: true, custom: true })),
		{ key: 'gaps', header: 'None Identified', type: 'number' as const, sortable: true, filterable: true }
	];
	const tableRows: TableRow[] = rows.map((row) => ({
		key: row.id,
		cells: {
			name: { text: row.name, href: `/nations/${row.id}` },
			states: { text: row.statesText, values: row.states },
			...Object.fromEntries(
				coverageSections.map((section) => [
					section.key,
					{ text: row.found[section.key] ? foundText : noneIdentified.text, sortValue: row.found[section.key] ? 1 : 0 }
				])
			),
			gaps: { text: String(row.gaps), sortValue: row.gaps }
		}
	}));
	return { chart, columns, rows: tableRows, nationCount: rows.length };
};
