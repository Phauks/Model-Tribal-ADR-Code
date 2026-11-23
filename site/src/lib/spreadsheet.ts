/**
 * A table as an Excel workbook (.xlsx), beside its .csv (Trevor, Nov. 23, 2026: "download data for
 * button should have csv and excel"). The sheet holds what the .csv holds, laid out by
 * `downloadCells` in src/lib/tables/table-definition.ts: the header row, then each row's cells,
 * with a linked cell's address in a column of its own after it. In the workbook the linked cell is
 * also a working link, numbers are numbers, the header row is bold, stays in view and carries
 * filters, and each column is wide enough for its text.
 *
 * The file is a ZIP of the few Office Open XML parts (ECMA-376) a spreadsheet program needs: the
 * content types, the package and workbook relationships, the workbook, one sheet and its styles.
 * Text is written inline in each cell, so no shared string table is needed.
 */
import { strToU8, zipSync } from 'fflate';
import { downloadCells, type DownloadCell, type TableColumn, type TableRow } from './tables/table-definition.ts';

/** Excel allows this many links on one sheet; past it a linked cell keeps its address column only. */
const linkLimit = 65_000;
/** The widest a column is drawn, in characters. */
const widestColumn = 60;

/** Escapes text for XML, leaving out the control characters XML 1.0 does not allow. */
function xml(text: string): string {
	return text
		.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

/** The column's letters for a zero-based index: 0 is A, 25 is Z, 26 is AA. */
export function columnLetters(index: number): string {
	let letters = '';
	for (let rest = index + 1; rest > 0; rest = Math.floor((rest - 1) / 26)) {
		letters = String.fromCharCode(65 + ((rest - 1) % 26)) + letters;
	}
	return letters;
}

/**
 * The number a cell's text shows, when it is plainly one: digits with or without thousands commas,
 * a sign and a decimal part. Text with a leading zero, such as a code, stays text.
 */
export function cellNumber(text: string): number | undefined {
	const trimmed = text.trim();
	if (!/^-?(0|[1-9]\d{0,2}(,\d{3})+|[1-9]\d*)(\.\d+)?$/.test(trimmed)) return undefined;
	const value = Number(trimmed.replaceAll(',', ''));
	return Number.isFinite(value) && Math.abs(value) < 1e15 ? value : undefined;
}

/** A sheet name Excel accepts: at most 31 characters, none of : \ / ? * [ ]. */
export function sheetName(name: string): string {
	const cleaned = name.replace(/[:\\/?*[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31).trim();
	return cleaned || 'Table';
}

/** The rows of a table as an .xlsx workbook with one sheet, named for the table. */
export function rowsToSpreadsheet(columns: TableColumn[], rows: TableRow[], origin = '', name = 'Table'): Uint8Array {
	const { header, lines } = downloadCells(columns, rows, origin);
	const width = header.length;
	const widths = header.map((text) => text.length);
	const links: { ref: string; target: string }[] = [];

	const cellXml = (cell: DownloadCell, reference: string, style: number): string => {
		const number = style === 0 ? cellNumber(cell.text) : undefined;
		if (number !== undefined) return `<c r="${reference}"><v>${number}</v></c>`;
		if (!cell.text) return '';
		const linked = cell.link && links.length < linkLimit;
		if (linked) links.push({ ref: reference, target: cell.link! });
		return `<c r="${reference}" t="inlineStr"${linked ? ' s="2"' : style ? ` s="${style}"` : ''}><is><t xml:space="preserve">${xml(cell.text)}</t></is></c>`;
	};

	const sheetRows: string[] = [];
	sheetRows.push(`<row r="1">${header.map((text, index) => cellXml({ text }, `${columnLetters(index)}1`, 1)).join('')}</row>`);
	lines.forEach((fields, lineIndex) => {
		const rowNumber = lineIndex + 2;
		fields.forEach((field, index) => {
			widths[index] = Math.max(widths[index] ?? 0, field.text.length);
		});
		sheetRows.push(`<row r="${rowNumber}">${fields.map((field, index) => cellXml(field, `${columnLetters(index)}${rowNumber}`, 0)).join('')}</row>`);
	});

	const lastCell = `${columnLetters(Math.max(width - 1, 0))}${lines.length + 1}`;
	const cols = widths.map((characters, index) => `<col min="${index + 1}" max="${index + 1}" width="${Math.min(Math.max(characters, 6), widestColumn) + 2}" customWidth="1"/>`).join('');
	const hyperlinks = links.length
		? `<hyperlinks>${links.map((link, index) => `<hyperlink ref="${link.ref}" r:id="rId${index + 1}"/>`).join('')}</hyperlinks>`
		: '';

	const sheet =
		'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
		'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
		`<dimension ref="A1:${lastCell}"/>` +
		'<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
		(cols ? `<cols>${cols}</cols>` : '') +
		`<sheetData>${sheetRows.join('')}</sheetData>` +
		(width ? `<autoFilter ref="A1:${lastCell}"/>` : '') +
		hyperlinks +
		'</worksheet>';

	const sheetRelationships =
		'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
		'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
		links
			.map((link, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xml(link.target)}" TargetMode="External"/>`)
			.join('') +
		'</Relationships>';

	const title = sheetName(name);
	const files: Record<string, Uint8Array> = {
		'[Content_Types].xml': strToU8(
			'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
				'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
				'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
				'<Default Extension="xml" ContentType="application/xml"/>' +
				'<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
				'<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
				'<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
				'</Types>'
		),
		'_rels/.rels': strToU8(
			'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
				'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
				'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
				'</Relationships>'
		),
		'xl/workbook.xml': strToU8(
			'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
				'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
				`<sheets><sheet name="${xml(title)}" sheetId="1" r:id="rId1"/></sheets>` +
				(width ? `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${xml(title.replaceAll("'", "''"))}'!$A$1:$${columnLetters(width - 1)}$${lines.length + 1}</definedName></definedNames>` : '') +
				'</workbook>'
		),
		'xl/_rels/workbook.xml.rels': strToU8(
			'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
				'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
				'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
				'<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
				'</Relationships>'
		),
		// Three cell styles: 0 plain, 1 the bold header, 2 a link, underlined in the link color.
		'xl/styles.xml': strToU8(
			'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
				'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
				'<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><u/><sz val="11"/><color theme="10"/><name val="Calibri"/></font></fonts>' +
				'<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
				'<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
				'<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
				'<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
				'<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
				'</styleSheet>'
		),
		'xl/worksheets/sheet1.xml': strToU8(sheet)
	};
	if (links.length) files['xl/worksheets/_rels/sheet1.xml.rels'] = strToU8(sheetRelationships);
	return zipSync(files, { level: 6 });
}

/** The media type of an .xlsx file. */
export const spreadsheetType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
