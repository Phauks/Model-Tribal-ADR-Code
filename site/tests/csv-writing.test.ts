import { describe, expect, it } from 'vitest';
import { csvDocument, csvField, csvLine, csvResponse } from '#lib/csv.ts';

// The escapers each download had before they were merged into #lib/csv.ts, copied here so the shared one is checked against them byte for byte.
function oldTableField(value: string): string {
	return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}
function oldCopiesField(value: string | number): string {
	const text = String(value);
	return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
function oldAddressBookField(value: string | null): string {
	let text = value ?? '';
	if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
	return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const samples = [
	'',
	'plain',
	'Smith, Jo',
	'say "hello"',
	'"',
	'two\nlines',
	'carriage\rreturn',
	'windows\r\nline',
	'=HYPERLINK("x")',
	'+1 775',
	'-5',
	'@sum',
	'\tindented',
	'\rstarts with a return',
	'ends with a comma,',
	'Ł unicode — “quotes”',
	'a,"b"\r\nc'
];

describe('csvField', () => {
	it('writes every field as the table, nations and copies files did', () => {
		for (const sample of samples) {
			expect(csvField(sample)).toBe(oldTableField(sample));
			expect(csvField(sample, { quoteCarriageReturns: false })).toBe(oldCopiesField(sample));
			expect(csvField(sample, { guardFormulas: true })).toBe(oldAddressBookField(sample));
		}
		expect(csvField(12345, { quoteCarriageReturns: false })).toBe(oldCopiesField(12345));
		expect(csvField(null, { guardFormulas: true })).toBe(oldAddressBookField(null));
	});

	it('quotes commas, quotes and line breaks, and guards formulas only when asked', () => {
		expect(csvField('Smith, Jo')).toBe('"Smith, Jo"');
		expect(csvField('a\rb')).toBe('"a\rb"');
		expect(csvField('a\rb', { quoteCarriageReturns: false })).toBe('a\rb');
		expect(csvField('=1+1')).toBe('=1+1');
		expect(csvField('=1+1', { guardFormulas: true })).toBe("'=1+1");
		expect(csvField(null)).toBe('');
	});
});

describe('csvDocument', () => {
	const rows = [
		['name', 'note'],
		['Smith, Jo', 'two\nlines'],
		['=SUM(A1)', 'a\rb']
	];

	it('writes the same bytes as the table download did', () => {
		const old = `${rows.map((row) => row.map(oldTableField).join(',')).join('\r\n')}\r\n`;
		expect(csvDocument(rows)).toBe(old);
	});

	it('writes the same bytes as the copies list did, with line feeds alone', () => {
		const old = `${rows.map((row) => row.map(oldCopiesField).join(',')).join('\n')}\n`;
		expect(csvDocument(rows, { quoteCarriageReturns: false, lineEnding: '\n' })).toBe(old);
	});

	it('writes the same bytes as the workspace files did', () => {
		const old = rows.map((row) => row.map(oldAddressBookField)).map((line) => line.join(',')).join('\r\n') + '\r\n';
		expect(csvDocument(rows, { guardFormulas: true })).toBe(old);
	});

	it('joins a line with commas and leaves its ending to the document', () => {
		expect(csvLine(['a', 1, null])).toBe('a,1,');
		expect(csvDocument([['a'], ['b']])).toBe('a\r\nb\r\n');
	});
});

describe('csvResponse', () => {
	it('names the file and keeps private files out of caches', async () => {
		const response = csvResponse('a\r\n', { fileName: 'list.csv', private: true });
		expect(response.headers.get('content-type')).toBe('text/csv; charset=utf-8');
		expect(response.headers.get('content-disposition')).toBe('attachment; filename="list.csv"');
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(await response.text()).toBe('a\r\n');
	});

	it('sends neither header when not asked', () => {
		const response = csvResponse('');
		expect(response.headers.get('content-disposition')).toBeNull();
		expect(response.headers.get('cache-control')).toBeNull();
	});
});
