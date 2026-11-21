import { describe, expect, it } from 'vitest';
import {
	filterRows,
	foldForSearch,
	problemsIn,
	sortRows,
	type TableColumn,
	type TableRow
} from '../src/lib/tables/table-definition.ts';

const columns: TableColumn[] = [
	{ key: 'name', header: 'Name', isRowHeader: true, sortable: true, searchable: true },
	{ key: 'count', header: 'Count', type: 'number', sortable: true },
	{ key: 'checked', header: 'Checked', type: 'date', sortable: true }
];

function row(key: string, name: string, count?: number, checked?: string): TableRow {
	return {
		key,
		cells: {
			name: { text: name },
			count: { text: count === undefined ? '' : String(count), sortValue: count },
			checked: { text: checked ?? '', sortValue: checked }
		}
	};
}

const rows = [
	row('zebra', 'Zebra Nation', 3, '2026-03-04'),
	row('accent', 'Ärger Nation', 10, '2025-12-31'),
	row('lower', 'aardvark Nation', 2),
	row('ten', 'Sample Nation 10', undefined, '2026-01-15'),
	row('two', 'Sample Nation 2', 1, '2026-10-01'),
	row('okina', 'ʻOkina Nation', 5, '2026-02-01')
];

const keys = (list: TableRow[]) => list.map((entry) => entry.key);

describe('sortRows', () => {
	it('sorts text ignoring case and accents, with numbers in order', () => {
		const sorted = sortRows(columns, rows, { key: 'name', direction: 'ascending' });
		// The ʻokina is a letter to the collator, with its own place after H and
		// before I, so "ʻOkina" does not sort with the O names. Where such names
		// belong is an open style question (spikes/tables/REPORT.md, open question 1).
		expect(keys(sorted)).toEqual(['lower', 'accent', 'okina', 'two', 'ten', 'zebra']);
	});

	it('sorts numbers as numbers and keeps empty cells last both ways', () => {
		expect(keys(sortRows(columns, rows, { key: 'count', direction: 'ascending' }))).toEqual([
			'two',
			'lower',
			'zebra',
			'okina',
			'accent',
			'ten'
		]);
		expect(keys(sortRows(columns, rows, { key: 'count', direction: 'descending' }))).toEqual([
			'accent',
			'okina',
			'zebra',
			'lower',
			'two',
			'ten'
		]);
	});

	it('sorts dates by their ISO value', () => {
		const sorted = sortRows(columns, rows, { key: 'checked', direction: 'descending' });
		expect(keys(sorted)).toEqual(['two', 'zebra', 'okina', 'ten', 'accent', 'lower']);
	});

	it('keeps tied rows in the order they came in', () => {
		const tied = [row('first', 'Same'), row('second', 'same'), row('third', 'SAME')];
		expect(keys(sortRows(columns, tied, { key: 'name', direction: 'descending' }))).toEqual([
			'first',
			'second',
			'third'
		]);
	});

	it('leaves rows alone for an unknown column', () => {
		expect(sortRows(columns, rows, { key: 'missing', direction: 'ascending' })).toBe(rows);
	});
});

describe('filterRows', () => {
	it('ignores accents and case', () => {
		expect(foldForSearch('Ärger')).toBe('arger');
		expect(keys(filterRows(columns, rows, 'ARGER'))).toEqual(['accent']);
	});

	it('needs every word typed', () => {
		expect(keys(filterRows(columns, rows, 'sample 2'))).toEqual(['two']);
		expect(keys(filterRows(columns, rows, 'nation zebra'))).toEqual(['zebra']);
	});

	it('looks only in searchable columns', () => {
		expect(filterRows(columns, rows, '2026')).toEqual([]);
	});

	it('returns every row for an empty search', () => {
		expect(filterRows(columns, rows, '   ')).toBe(rows);
	});
});

describe('problemsIn', () => {
	it('finds none in a sound table', () => {
		expect(problemsIn(columns, rows)).toEqual([]);
	});

	it('finds repeated keys and missing cells', () => {
		const broken = [...rows, row('zebra', 'Again'), { key: 'empty', cells: {} }];
		expect(problemsIn(columns, broken)).toEqual([
			'row "zebra" is listed twice',
			'row "empty" has no "name" cell',
			'row "empty" has no "count" cell',
			'row "empty" has no "checked" cell'
		]);
	});
});
