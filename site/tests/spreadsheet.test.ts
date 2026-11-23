import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { cellNumber, columnLetters, rowsToSpreadsheet, sheetName } from '../src/lib/spreadsheet.ts';
import { downloadCells, rowsToCsv, type TableColumn, type TableRow } from '../src/lib/tables/table-definition.ts';

const columns: TableColumn[] = [
	{ key: 'name', header: 'Nation', isRowHeader: true },
	{ key: 'count', header: 'Provisions', type: 'number' }
];
const rows: TableRow[] = [
	{ key: 'a', cells: { name: { text: 'Pueblo of <Acoma> & friends', href: '/nations/acoma' }, count: { text: '1,200' } } },
	{ key: 'b', cells: { name: { text: 'Navajo Nation' }, count: { text: '007' } } }
];

describe('spreadsheet download', () => {
	it('names columns as a spreadsheet does', () => {
		expect([0, 25, 26, 27, 701, 702].map(columnLetters)).toEqual(['A', 'Z', 'AA', 'AB', 'ZZ', 'AAA']);
	});

	it('reads plain numbers as numbers and keeps codes as text', () => {
		expect(cellNumber('1,200')).toBe(1200);
		expect(cellNumber('-3.5')).toBe(-3.5);
		expect(cellNumber('007')).toBeUndefined();
		expect(cellNumber('12,34')).toBeUndefined();
		expect(cellNumber('45%')).toBeUndefined();
	});

	it('gives Excel a sheet name it accepts', () => {
		expect(sheetName('Provisions: by method / kind [draft]')).toBe('Provisions by method kind draft');
		expect(sheetName('')).toBe('Table');
	});

	it('lays out the same cells as the .csv', () => {
		const { header, lines } = downloadCells(columns, rows, 'https://example.org');
		expect(header).toEqual(['Nation', 'Nation (link)', 'Provisions']);
		expect(lines[0].map((cell) => cell.text)).toEqual(['Pueblo of <Acoma> & friends', 'https://example.org/nations/acoma', '1,200']);
		expect(rowsToCsv(columns, rows, 'https://example.org').split('\r\n')[0]).toBe('Nation,Nation (link),Provisions');
	});

	it('writes a workbook with escaped text, numbers and working links', () => {
		const files = unzipSync(rowsToSpreadsheet(columns, rows, 'https://example.org', 'Provisions'));
		expect(Object.keys(files)).toEqual(expect.arrayContaining(['[Content_Types].xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml', 'xl/styles.xml', 'xl/worksheets/_rels/sheet1.xml.rels']));
		const sheet = strFromU8(files['xl/worksheets/sheet1.xml']);
		expect(sheet).toContain('Pueblo of &lt;Acoma&gt; &amp; friends');
		expect(sheet).toContain('<c r="C2"><v>1200</v></c>');
		expect(sheet).toContain('<t xml:space="preserve">007</t>');
		expect(sheet).toContain('<hyperlink ref="A2" r:id="rId1"/>');
		expect(sheet).toContain('<autoFilter ref="A1:C3"/>');
		expect(strFromU8(files['xl/worksheets/_rels/sheet1.xml.rels'])).toContain('Target="https://example.org/nations/acoma"');
		expect(strFromU8(files['xl/workbook.xml'])).toContain('<sheet name="Provisions"');
	});
});
