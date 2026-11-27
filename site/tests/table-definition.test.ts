import { describe, expect, it } from 'vitest';
import {
	applyColumnFilters,
	columnTotal,
	defaultColumnKeys,
	filterChoices,
	filterIsActive,
	filterKind,
	filterKindFor,
	tickListLimit,
	shownColumnsOf,
	filterRows,
	readTableState,
	rowsToCsv,
	writeTableState,
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

describe('column filters', () => {
	const stateColumns: TableColumn[] = [
		{ key: 'name', header: 'Name', isRowHeader: true, sortable: true },
		{ key: 'states', header: 'States', sortable: true, filterable: true }
	];
	const stateRows: TableRow[] = [
		{ key: 'navajo', cells: { name: { text: 'Navajo Nation', href: '/nations/navajo-nation' }, states: { text: 'Arizona, New Mexico, Utah', values: ['Arizona', 'New Mexico', 'Utah'] } } },
		{ key: 'hopi', cells: { name: { text: 'Hopi Tribe' }, states: { text: 'Arizona', values: ['Arizona'] } } },
		{ key: 'zuni', cells: { name: { text: 'Zuni Tribe, "Pueblo"' }, states: { text: 'New Mexico' } } },
		{ key: 'none', cells: { name: { text: 'No State' }, states: { text: '' } } }
	];

	it('lists each value once, in reading order, with the rows it leaves', () => {
		expect(filterChoices(stateColumns[1], stateRows)).toEqual([
			{ value: 'Arizona', count: 2 },
			{ value: 'New Mexico', count: 2 },
			{ value: 'Utah', count: 1 }
		]);
	});

	it('keeps rows whose values include any value ticked, and every row without filters', () => {
		expect(keys(applyColumnFilters(stateRows, { states: { values: ['New Mexico'] } }))).toEqual(['navajo', 'zuni']);
		expect(keys(applyColumnFilters(stateRows, { states: { values: ['Utah', 'New Mexico'] } }))).toEqual(['navajo', 'zuni']);
		expect(keys(applyColumnFilters(stateRows, { states: { values: [] } }))).toEqual(keys(stateRows));
	});

	it('keeps rows whose cell contains every word typed, ignoring accents and case', () => {
		expect(keys(applyColumnFilters(stateRows, { name: { contains: 'TRIBE' } }))).toEqual(['hopi', 'zuni']);
		expect(keys(applyColumnFilters(stateRows, { name: { contains: 'zuñi pueblo' } }))).toEqual(['zuni']);
		expect(keys(applyColumnFilters(stateRows, { name: { contains: '  ' } }))).toEqual(keys(stateRows));
	});

	it('gives a filterable column a list of values and a searchable one a "Contains" box', () => {
		expect(filterKind({ key: 'a', header: 'A', filterable: true, searchable: true })).toBe('values');
		expect(filterKind({ key: 'a', header: 'A', searchable: true })).toBe('contains');
		expect(filterKind({ key: 'a', header: 'A' })).toBeUndefined();
		expect(filterIsActive({ values: [], contains: ' ' })).toBe(false);
		expect(filterIsActive({ contains: 'x' })).toBe(true);
	});

	it('lists the values of a searchable column when there are few enough to pick from', () => {
		const kind: TableColumn = { key: 'kind', header: 'Kind', searchable: true };
		const name: TableColumn = { key: 'name', header: 'Name', searchable: true, isRowHeader: true };
		const rowsOf = (texts: string[]): TableRow[] => texts.map((text, index) => ({ key: String(index), cells: { kind: { text }, name: { text } } }));
		const fewKinds = rowsOf(Array.from({ length: 135 }, (_, index) => ['Petition', 'Proposed finding', 'Final determination'][index % 3]));
		expect(filterKindFor(kind, fewKinds)).toBe('values');
		// The column naming each row keeps "Contains", however few its values.
		expect(filterKindFor(name, fewKinds)).toBe('contains');
		// A small table lists even one-of-a-kind values; a long column of them, such as docket numbers, takes "Contains".
		expect(filterKindFor(kind, rowsOf(['M-1', 'M-2', 'M-3']))).toBe('values');
		expect(filterKindFor(kind, rowsOf(Array.from({ length: 200 }, (_, index) => `M-${index}`)))).toBe('contains');
		// Too many values to list.
		expect(filterKindFor(kind, rowsOf(Array.from({ length: (tickListLimit + 1) * 3 }, (_, index) => `Court ${index % (tickListLimit + 1)}`)))).toBe('contains');
		expect(filterKindFor(kind, rowsOf(['', '']))).toBe('contains');
		expect(filterKindFor({ key: 'kind', header: 'Kind', filterable: true }, rowsOf(Array.from({ length: 900 }, (_, index) => `${index}`)))).toBe('values');
		expect(filterKindFor({ key: 'kind', header: 'Kind' }, fewKinds)).toBeUndefined();
	});

	it('reads ticked values and "Contains" for a searchable column, which may offer either', () => {
		const columns: TableColumn[] = [{ key: 'kind', header: 'Kind', searchable: true }];
		expect(readTableState('t', columns, new URLSearchParams('t.kind=Petition&t.kind=Petition&t.kind=Final'))).toEqual({ query: '', filters: { kind: { values: ['Petition', 'Final'] } } });
		expect(readTableState('t', columns, new URLSearchParams('t.kind.contains=finding'))).toEqual({ query: '', filters: { kind: { contains: 'finding' } } });
	});

	it('writes the state into the address and reads it back', () => {
		const written = writeTableState(
			'nations-a',
			{ query: ' paiute ', sort: { key: 'states', direction: 'descending' }, filters: { states: { values: ['Utah', 'Arizona'] } } },
			new URLSearchParams('other=1&nations-a.q=old'),
			{ key: 'name', direction: 'ascending' }
		);
		expect(written.toString()).toBe('other=1&nations-a.q=paiute&nations-a.sort=-states&nations-a.states=Utah&nations-a.states=Arizona');
		expect(readTableState('nations-a', stateColumns, written)).toEqual({
			query: 'paiute',
			sort: { key: 'states', direction: 'descending' },
			filters: { states: { values: ['Utah', 'Arizona'] } }
		});
	});

	it('writes a "Contains" filter and the columns shown, and reads them back', () => {
		const columns: TableColumn[] = [{ ...stateColumns[0], searchable: true }, stateColumns[1], { key: 'region', header: 'Region', optional: true }];
		const written = writeTableState('t', { query: '', filters: { name: { contains: ' paiute ' } }, columns: ['name', 'region'] }, new URLSearchParams());
		expect(written.toString()).toBe('t.name.contains=paiute&t.columns=name%2Cregion');
		expect(readTableState('t', columns, written)).toEqual({ query: '', filters: { name: { contains: 'paiute' } }, columns: ['name', 'region'] });
		expect(readTableState('t', columns, new URLSearchParams('t.columns=nope,states')).columns).toEqual(['states']);
	});

	it('reads a link made before filters took several values', () => {
		expect(readTableState('t', stateColumns, new URLSearchParams('t.states=Utah')).filters).toEqual({ states: { values: ['Utah'] } });
	});

	it('leaves the default sort out of the address and ignores unknown columns', () => {
		const written = writeTableState('t', { query: '', sort: { key: 'name', direction: 'ascending' }, filters: {} }, new URLSearchParams(), {
			key: 'name',
			direction: 'ascending'
		});
		expect(written.toString()).toBe('');
		expect(readTableState('t', stateColumns, new URLSearchParams('t.sort=-nope&t.name=x'))).toEqual({ query: '', filters: {} });
	});

	it('writes CSV with quoted fields, full link addresses and CR LF line ends', () => {
		expect(rowsToCsv(stateColumns, stateRows.slice(0, 3), 'https://example.org')).toBe(
			'Name,Name (link),States\r\n' +
				'Navajo Nation,https://example.org/nations/navajo-nation,"Arizona, New Mexico, Utah"\r\n' +
				'Hopi Tribe,,Arizona\r\n' +
				'"Zuni Tribe, ""Pueblo""",,New Mexico\r\n'
		);
	});

	it('leaves the columns kept out of downloads out of the CSV', () => {
		const kept: TableColumn[] = [
			{ key: 'name', header: 'Name', isRowHeader: true },
			{ key: 'needs', header: 'Access needs', keepOutOfDownload: true },
			{ key: 'action', header: 'Action', hiddenHeader: true, keepOutOfDownload: true }
		];
		const keptRows: TableRow[] = [{ key: 'a', cells: { name: { text: 'Test Person' }, needs: { text: 'Private' }, action: { text: 'Cancel' } } }];
		expect(rowsToCsv(kept, keptRows)).toBe('Name\r\nTest Person\r\n');
	});
});

describe('the Sum row and the columns shown', () => {
	const numberColumns: TableColumn[] = [
		{ key: 'label', header: 'Method', isRowHeader: true },
		{ key: 'value', header: 'Provisions', type: 'number', sum: true },
		{ key: 'note', header: 'Note', optional: true }
	];
	const numberRows: TableRow[] = [
		{ key: 'a', cells: { label: { text: 'Peacemaking' }, value: { text: '1,503', sortValue: 1503 }, note: { text: '' } } },
		{ key: 'b', cells: { label: { text: 'Arbitration' }, value: { text: '385' }, note: { text: '' } } },
		{ key: 'c', cells: { label: { text: 'Unknown' }, value: { text: '' }, note: { text: '' } } }
	];

	it('adds up a column from its sort values, or else its text, skipping empty cells', () => {
		expect(columnTotal(numberColumns[1], numberRows)).toBe(1888);
	});

	it('shows every column but the optional ones until a reader chooses, and always the row header', () => {
		expect(defaultColumnKeys(numberColumns)).toEqual(['label', 'value']);
		expect(shownColumnsOf(numberColumns, undefined).map((column) => column.key)).toEqual(['label', 'value']);
		expect(shownColumnsOf(numberColumns, ['note']).map((column) => column.key)).toEqual(['label', 'note']);
	});
});
