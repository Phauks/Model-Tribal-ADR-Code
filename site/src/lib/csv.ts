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
