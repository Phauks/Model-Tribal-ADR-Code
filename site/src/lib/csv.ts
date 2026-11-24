/**
 * Reads comma-separated values as RFC 4180 writes them: fields in double
 * quotes may hold commas, line breaks and doubled quotes. The first row names
 * the columns. Used for research/capture-index.csv, which Python's csv module
 * writes (scripts/captures/mirror_captures.py).
 */
export function parseCsv(text: string): Record<string, string>[] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let quoted = false;
	for (let index = 0; index < text.length; index += 1) {
		const character = text[index];
		if (quoted) {
			if (character === '"' && text[index + 1] === '"') {
				field += '"';
				index += 1;
			} else if (character === '"') {
				quoted = false;
			} else {
				field += character;
			}
		} else if (character === '"') {
			quoted = true;
		} else if (character === ',') {
			row.push(field);
			field = '';
		} else if (character === '\n' || character === '\r') {
			if (character === '\r' && text[index + 1] === '\n') index += 1;
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
		} else {
			field += character;
		}
	}
	if (field !== '' || row.length > 0) {
		row.push(field);
		rows.push(row);
	}
	const [header = [], ...body] = rows.filter((cells) => cells.length > 1 || cells[0] !== '');
	return body.map((cells) => Object.fromEntries(header.map((name, column) => [name, cells[column] ?? ''])));
}

/** How a CSV file is written. Each download keeps the rules it was first published with, so files stay byte for byte the same. */
export interface CsvOptions {
	/** Quote a field holding a carriage return as well as one holding a line feed, as RFC 4180 does. The copies list and a documents zip's documents.csv quote only line feeds. Default true. */
	quoteCarriageReturns?: boolean;
	/** Put an apostrophe before a field that a spreadsheet would read as a formula (one starting with =, +, -, @, a tab or a carriage return), for files of people's own entries. Default false. */
	guardFormulas?: boolean;
	/** What ends each line, including the last. Default "\r\n", as RFC 4180 writes. */
	lineEnding?: '\r\n' | '\n';
}

/** One CSV field (RFC 4180, section 2): quoted, with its quotes doubled, when it holds a comma, a quote or a line break. A missing value is an empty field. */
export function csvField(value: string | number | null, options: CsvOptions = {}): string {
	let text = value === null ? '' : String(value);
	if (options.guardFormulas && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
	const needsQuotes = options.quoteCarriageReturns === false ? /[",\n]/ : /[",\r\n]/;
	return needsQuotes.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** One CSV line, without its line ending: each field written by csvField and joined with commas. */
export function csvLine(values: readonly (string | number | null)[], options: CsvOptions = {}): string {
	return values.map((value) => csvField(value, options)).join(',');
}

/** A whole CSV file: each row written by csvLine, and every line, the last too, closed by the line ending. */
export function csvDocument(rows: readonly (readonly (string | number | null)[])[], options: CsvOptions = {}): string {
	const lineEnding = options.lineEnding ?? '\r\n';
	return rows.map((row) => `${csvLine(row, options)}${lineEnding}`).join('');
}

/** A CSV file as a response. With a file name, browsers save it under that name; a private file, of people's own details, is never cached. */
export function csvResponse(body: string, options: { fileName?: string; private?: boolean } = {}): Response {
	const headers: Record<string, string> = { 'content-type': 'text/csv; charset=utf-8' };
	if (options.fileName !== undefined) headers['content-disposition'] = `attachment; filename="${options.fileName}"`;
	if (options.private) headers['cache-control'] = 'no-store';
	return new Response(body, { headers });
}
