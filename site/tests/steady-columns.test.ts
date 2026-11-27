import { describe, expect, it } from 'vitest';
import { steadyColumns } from '../src/lib/tables/steady-columns.ts';
import type { TableColumn, TableRow } from '../src/lib/tables/table-definition.ts';

const columns: TableColumn[] = [
	{ key: 'name', header: 'Name', sortable: true },
	{ key: 'state', header: 'State', sortable: true },
	{ key: 'count', header: 'Cases', type: 'number' }
];

function row(key: string, name: string, state: string, count: string): TableRow {
	return { key, cells: { name: { text: name }, state: { text: state }, count: { text: count } } };
}

describe('steady column widths', () => {
	const rows = [row('a', 'Absentee-Shawnee Tribe of Indians of Oklahoma', 'Oklahoma', '12'), row('b', 'Hopi Tribe', 'Arizona', '1,204')];

	it('shares the whole width, the longest text taking the most', () => {
		const { shares } = steadyColumns(columns, rows);
		expect(shares.reduce((sum, share) => sum + share, 0)).toBeCloseTo(100, 0);
		expect(shares[0]).toBeGreaterThan(shares[1]);
		expect(shares[1]).toBeGreaterThan(shares[2]);
	});

	it('never goes below the longest word or the header', () => {
		const { least } = steadyColumns(columns, rows, new Set(['state']));
		// "Absentee-Shawnee" (16 letters), "Oklahoma" against "State" with arrow and funnel, "1,204" against "Cases".
		expect(least).toBeGreaterThan(16 * 0.5 + 8 * 0.5 + 5 * 0.5);
	});

	it('depends only on the rows, not their order or how many have arrived', () => {
		expect(steadyColumns(columns, [...rows].reverse())).toEqual(steadyColumns(columns, rows));
	});

	it('sizes a badge column by its badges, not the longer wording kept for the download', () => {
		const badgeColumns: TableColumn[] = [
			{ key: 'name', header: 'Name' },
			{ key: 'recognition', header: 'Recognition', custom: true }
		];
		const wording = 'Federally recognized: on the list the Bureau of Indian Affairs publishes each year under the List Act';
		const badgeRows: TableRow[] = Array.from({ length: 10 }, (_, index) => ({
			key: String(index),
			cells: { name: { text: 'Hopi Tribe of Arizona' }, recognition: { text: wording, values: ['Federal'] } }
		}));
		const { shares } = steadyColumns(badgeColumns, badgeRows);
		expect(shares[1]).toBeLessThan(shares[0]);
	});

	it('keeps the table wide enough for every header, its arrow and its funnel', () => {
		const many: TableColumn[] = Array.from({ length: 7 }, (_, index) => ({ key: `c${index}`, header: `Heading ${index}`, sortable: true, filterable: true }));
		const longRows: TableRow[] = [{ key: 'a', cells: Object.fromEntries(many.map((column, index) => [column.key, { text: index === 0 ? 'a very long title '.repeat(8) : 'x' }])) }];
		const { shares, least } = steadyColumns(many, longRows, new Set(many.map((column) => column.key)));
		const header = 7 * 0.56 + 1.4 + 1.8 + 1.6;
		for (const share of shares) expect((share / 100) * least).toBeGreaterThanOrEqual(header - 0.05);
	});
});
