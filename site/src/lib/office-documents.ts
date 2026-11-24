/**
 * The page as a Word document (.docx) or an OpenDocument text (.odt), for the Download menu
 * (site/DESIGN.md, section 6, "Download"). Trevor asked for both on Nov. 23, 2026, so that a reader
 * can edit what they download, as a nation's staff would edit a model code. Both are written from
 * the blocks src/lib/page-document.ts reads, the same blocks the Markdown file is written from.
 *
 * Each format is a ZIP of XML files: Office Open XML (ECMA-376) and OpenDocument 1.3 (OASIS,
 * ISO/IEC 26300). Only the parts a word processor needs are written: styles for headings, quotes
 * and code, numbered and bulleted lists, tables with borders and links.
 */
import { strToU8, zipSync, type Zippable } from 'fflate';
import tokens from '../../design-tokens.json';
import { themeColors, type TokenGroup } from './design-tokens.ts';
import { provenance, type Block, type PageDocument, type Run } from './page-document.ts';
import { escapeHtml } from './escape-html.ts';

/** The light theme's colors from site/design-tokens.json, the ones a printed page uses. */
const colors = themeColors(tokens as TokenGroup, 'light');
/** OpenDocument writes a color with its leading mark; Word writes the six digits alone. */
const palette = { heading: colors.band, muted: colors['ink-muted'], link: colors.link, border: colors['control-border'] };
const wordPalette = Object.fromEntries(
	Object.entries(palette).map(([name, value]) => [name, value.replace(/^#/, '').toUpperCase()])
) as typeof palette;

/** Groups runs that share a link, so each link is written once around its runs. */
function linkGroups(runs: Run[]): { link?: string; runs: Run[] }[] {
	const groups: { link?: string; runs: Run[] }[] = [];
	for (const run of runs) {
		const last = groups.at(-1);
		if (last && last.link === run.link) last.runs.push(run);
		else groups.push({ link: run.link, runs: [run] });
	}
	return groups;
}

// ---------------------------------------------------------------- Word

const wordNamespaces =
	'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

class WordWriter {
	private readonly links: string[] = [];
	/** Each ordered list gets its own numbering, so it starts at its own number. */
	private readonly orderedLists: number[] = [];

	linkIdentifier(target: string): string {
		let index = this.links.indexOf(target);
		if (index < 0) {
			this.links.push(target);
			index = this.links.length - 1;
		}
		return `rIdLink${index + 1}`;
	}

	runs(runs: Run[], extra = ''): string {
		return linkGroups(runs)
			.map((group) => {
				const body = group.runs
					.map((run) => {
						if (run.lineBreak) return '<w:r><w:br/></w:r>';
						const properties = [
							group.link ? '<w:rStyle w:val="Hyperlink"/>' : '',
							run.code ? '<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/>' : '',
							run.bold ? '<w:b/>' : '',
							run.italic ? '<w:i/>' : '',
							extra
						].join('');
						return `<w:r>${properties ? `<w:rPr>${properties}</w:rPr>` : ''}<w:t xml:space="preserve">${escapeHtml(run.text)}</w:t></w:r>`;
					})
					.join('');
				return group.link ? `<w:hyperlink r:id="${this.linkIdentifier(group.link)}" w:history="1">${body}</w:hyperlink>` : body;
			})
			.join('');
	}

	paragraph(runs: Run[], style?: string, more = ''): string {
		const properties = `${style ? `<w:pStyle w:val="${style}"/>` : ''}${more}`;
		return `<w:p>${properties ? `<w:pPr>${properties}</w:pPr>` : ''}${this.runs(runs)}</w:p>`;
	}

	blocks(blocks: Block[], context: { depth: number; quote: boolean } = { depth: 0, quote: false }): string {
		const indent = context.depth > 0 ? `<w:ind w:left="${360 * (context.depth + 1)}"/>` : '';
		return blocks
			.map((block) => {
				switch (block.type) {
					case 'heading':
						return this.paragraph(block.runs, `Heading${block.level}`);
					case 'paragraph':
						return this.paragraph(block.runs, context.quote ? 'Quote' : undefined, indent);
					case 'rule':
						return '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="auto"/></w:pBdr></w:pPr></w:p>';
					case 'code':
						return block.text
							.split('\n')
							.map((line) => this.paragraph([{ text: line, code: true }], 'Code'))
							.join('');
					case 'quote':
						return this.blocks(block.blocks, { ...context, quote: true });
					case 'list':
						return this.list(block, context);
					case 'table':
						return this.table(block.rows, block.caption);
				}
			})
			.join('');
	}

	private list(block: Extract<Block, { type: 'list' }>, context: { depth: number; quote: boolean }): string {
		let numbering = 1;
		if (block.ordered) {
			this.orderedLists.push(block.items[0]?.number ?? 1);
			numbering = this.orderedLists.length + 1;
		}
		const level = Math.min(context.depth, 8);
		return block.items
			.map((item) =>
				item.blocks
					.map((inner, index) => {
						if (index === 0 && (inner.type === 'paragraph' || inner.type === 'heading')) {
							return this.paragraph(
								inner.runs,
								'ListParagraph',
								`<w:numPr><w:ilvl w:val="${level}"/><w:numId w:val="${numbering}"/></w:numPr>`
							);
						}
						return this.blocks([inner], { ...context, depth: context.depth + 1 });
					})
					.join('')
			)
			.join('');
	}

	private table(rows: Run[][][], caption?: Run[]): string {
		const width = rows[0]?.length ?? 0;
		const grid = `<w:tblGrid>${'<w:gridCol/>'.repeat(width)}</w:tblGrid>`;
		const body = rows
			.map(
				(row, rowIndex) =>
					`<w:tr>${rowIndex === 0 ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}${row
						.map(
							(cell) =>
								`<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/></w:tcPr><w:p>${this.runs(cell, rowIndex === 0 ? '<w:b/>' : '')}</w:p></w:tc>`
						)
						.join('')}</w:tr>`
			)
			.join('');
		const table = `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="5000" w:type="pct"/></w:tblPr>${grid}${body}</w:tbl>`;
		return caption ? `${table}${this.paragraph(caption, 'Caption')}` : `${table}<w:p/>`;
	}

	relationships(): string {
		const links = this.links
			.map(
				(target, index) =>
					`<Relationship Id="rIdLink${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escapeHtml(target)}" TargetMode="External"/>`
			)
			.join('');
		return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdNumbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>${links}</Relationships>`;
	}

	numbering(): string {
		const levels = (format: 'bullet' | 'decimal') =>
			Array.from({ length: 9 }, (_, level) => {
				const text = format === 'bullet' ? ['•', '◦', '▪'][level % 3] : `%${level + 1}.`;
				return `<w:lvl w:ilvl="${level}"><w:start w:val="1"/><w:numFmt w:val="${format}"/><w:lvlText w:val="${text}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${360 * (level + 1)}" w:hanging="360"/></w:pPr></w:lvl>`;
			}).join('');
		const ordered = this.orderedLists
			.map(
				(start, index) =>
					`<w:num w:numId="${index + 2}"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="${start}"/></w:lvlOverride></w:num>`
			)
			.join('');
		return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering ${wordNamespaces}><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>${levels('bullet')}</w:abstractNum><w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>${levels('decimal')}</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>${ordered}</w:numbering>`;
	}
}

function wordStyles(): string {
	const heading = (level: number, size: number) =>
		`<w:style w:type="paragraph" w:styleId="Heading${level}"><w:name w:val="heading ${level}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="${level === 1 ? 360 : 240}" w:after="120"/><w:outlineLvl w:val="${level - 1}"/></w:pPr><w:rPr><w:b/><w:color w:val="${wordPalette.heading}"/><w:sz w:val="${size}"/></w:rPr></w:style>`;
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${wordNamespaces}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:eastAsia="Arial"/><w:sz w:val="22"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>${[
		[1, 36],
		[2, 30],
		[3, 26],
		[4, 24],
		[5, 22],
		[6, 22]
	]
		.map(([level, size]) => heading(level, size))
		.join(
			''
		)}<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:ind w:left="720" w:right="720"/></w:pPr><w:rPr><w:i/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0"/></w:pPr><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/><w:sz w:val="20"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="80"/><w:contextualSpacing/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="caption"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:i/><w:sz w:val="18"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Provenance"><w:name w:val="Provenance"/><w:basedOn w:val="Normal"/><w:rPr><w:color w:val="${wordPalette.muted}"/><w:sz w:val="18"/></w:rPr></w:style><w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="${wordPalette.link}"/><w:u w:val="single"/></w:rPr></w:style><w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="${wordPalette.border}"/><w:left w:val="single" w:sz="4" w:space="0" w:color="${wordPalette.border}"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="${wordPalette.border}"/><w:right w:val="single" w:sz="4" w:space="0" w:color="${wordPalette.border}"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="${wordPalette.border}"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="${wordPalette.border}"/></w:tblBorders><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>`;
}

function coreProperties(document: PageDocument): string {
	const made = document.made.toISOString().replace(/\.\d{3}Z$/, 'Z');
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escapeHtml(document.title)}</dc:title><dc:creator>${escapeHtml(document.siteName)}</dc:creator><dc:identifier>${escapeHtml(document.address)}</dc:identifier><dcterms:created xsi:type="dcterms:W3CDTF">${made}</dcterms:created></cp:coreProperties>`;
}

/** The page as a Word document. */
export function pageWord(document: PageDocument): Uint8Array {
	const writer = new WordWriter();
	const top = provenance(document)
		.map((line, index) => writer.paragraph(index === 0 ? [{ text: line.split(': ')[0] + ': ' }, { text: document.address, link: document.address }] : [{ text: line }], 'Provenance'))
		.join('');
	const body = writer.blocks(document.blocks);
	const files: Zippable = {
		'[Content_Types].xml': strToU8(
			'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>'
		),
		'_rels/.rels': strToU8(
			'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>'
		),
		'docProps/core.xml': strToU8(coreProperties(document)),
		'word/document.xml': strToU8(
			`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${wordNamespaces}><w:body>${top}${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`
		),
		'word/styles.xml': strToU8(wordStyles()),
		'word/numbering.xml': strToU8(writer.numbering()),
		'word/_rels/document.xml.rels': strToU8(writer.relationships())
	};
	return zipSync(files, { level: 6 });
}

// ---------------------------------------------------------------- OpenDocument

const openDocumentNamespaces = [
	'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"',
	'xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"',
	'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"',
	'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"',
	'xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"',
	'xmlns:xlink="http://www.w3.org/1999/xlink"',
	'xmlns:dc="http://purl.org/dc/elements/1.1/"',
	'xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0"',
	'xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0"'
].join(' ');

function textStyle(run: Run): string | undefined {
	const name = `${run.bold ? 'B' : ''}${run.italic ? 'I' : ''}${run.code ? 'C' : ''}`;
	return name ? `T${name}` : undefined;
}

function openRuns(runs: Run[], bold = false): string {
	return linkGroups(runs)
		.map((group) => {
			const body = group.runs
				.map((run) => {
					if (run.lineBreak) return '<text:line-break/>';
					const style = textStyle({ ...run, bold: run.bold || bold });
					return style ? `<text:span text:style-name="${style}">${escapeHtml(run.text)}</text:span>` : escapeHtml(run.text);
				})
				.join('');
			return group.link ? `<text:a xlink:type="simple" xlink:href="${escapeHtml(group.link)}">${body}</text:a>` : body;
		})
		.join('');
}

function openBlocks(blocks: Block[], quote = false): string {
	return blocks
		.map((block) => {
			switch (block.type) {
				case 'heading':
					return `<text:h text:style-name="Heading_20_${block.level}" text:outline-level="${block.level}">${openRuns(block.runs)}</text:h>`;
				case 'paragraph':
					return `<text:p text:style-name="${quote ? 'Quotations' : 'Text_20_body'}">${openRuns(block.runs)}</text:p>`;
				case 'rule':
					return '<text:p text:style-name="Rule"/>';
				case 'code':
					return block.text
						.split('\n')
						.map((line) => `<text:p text:style-name="Preformatted_20_Text">${escapeHtml(line)}</text:p>`)
						.join('');
				case 'quote':
					return openBlocks(block.blocks, true);
				case 'list':
					return `<text:list text:style-name="${block.ordered ? 'LNumbered' : 'LBullets'}">${block.items
						.map((item, index) => {
							const start = block.ordered && index === 0 && item.number !== undefined ? ` text:start-value="${item.number}"` : '';
							const inner = item.blocks
								.map((inner) =>
									inner.type === 'paragraph' || inner.type === 'heading'
										? `<text:p text:style-name="List_20_Contents">${openRuns(inner.runs)}</text:p>`
										: openBlocks([inner], quote)
								)
								.join('');
							return `<text:list-item${start}>${inner}</text:list-item>`;
						})
						.join('')}</text:list>`;
				case 'table': {
					const width = block.rows[0]?.length ?? 0;
					const [head, ...body] = block.rows.map(
						(row, rowIndex) =>
							`<table:table-row>${row
								.map(
									(cell) =>
										`<table:table-cell table:style-name="Cell" office:value-type="string"><text:p text:style-name="Table_20_Contents">${openRuns(cell, rowIndex === 0)}</text:p></table:table-cell>`
								)
								.join('')}</table:table-row>`
					);
					const table = `<table:table table:style-name="Table"><table:table-column table:number-columns-repeated="${width}"/>${head ? `<table:table-header-rows>${head}</table:table-header-rows>` : ''}${body.join('')}</table:table>`;
					return block.caption ? `${table}<text:p text:style-name="Caption">${openRuns(block.caption)}</text:p>` : table;
				}
			}
		})
		.join('');
}

function listStyle(name: string, ordered: boolean): string {
	const levels = Array.from({ length: 10 }, (_, index) => {
		const level = index + 1;
		const position = `<style:list-level-properties text:list-level-position-and-space-mode="label-alignment"><style:list-level-label-alignment text:label-followed-by="listtab" text:list-tab-stop-position="${(0.3 * level).toFixed(2)}in" fo:text-indent="-0.25in" fo:margin-left="${(0.3 * level).toFixed(2)}in"/></style:list-level-properties>`;
		return ordered
			? `<text:list-level-style-number text:level="${level}" style:num-suffix="." style:num-format="1">${position}</text:list-level-style-number>`
			: `<text:list-level-style-bullet text:level="${level}" text:bullet-char="${['•', '◦', '▪'][index % 3]}">${position}</text:list-level-style-bullet>`;
	}).join('');
	return `<text:list-style style:name="${name}">${levels}</text:list-style>`;
}

function openStyles(): string {
	const heading = (level: number, size: string) =>
		`<style:style style:name="Heading_20_${level}" style:display-name="Heading ${level}" style:family="paragraph" style:parent-style-name="Standard" style:next-style-name="Text_20_body" style:default-outline-level="${level}"><style:paragraph-properties fo:margin-top="${level === 1 ? '0.25in' : '0.17in'}" fo:margin-bottom="0.08in" fo:keep-with-next="always"/><style:text-properties fo:font-size="${size}" fo:font-weight="bold" fo:color="${palette.heading}"/></style:style>`;
	return `<?xml version="1.0" encoding="UTF-8"?><office:document-styles ${openDocumentNamespaces} office:version="1.3"><office:styles><style:default-style style:family="paragraph"><style:text-properties style:font-name="Arial" fo:font-family="Arial, Liberation Sans, sans-serif" fo:font-size="11pt" fo:language="en" fo:country="US"/></style:default-style><style:style style:name="Standard" style:family="paragraph"/><style:style style:name="Text_20_body" style:display-name="Text body" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:margin-bottom="0.1in" fo:line-height="115%"/></style:style>${[
		[1, '18pt'],
		[2, '15pt'],
		[3, '13pt'],
		[4, '12pt'],
		[5, '11pt'],
		[6, '11pt']
	]
		.map(([level, size]) => heading(level as number, size as string))
		.join(
			''
		)}<style:style style:name="Quotations" style:family="paragraph" style:parent-style-name="Text_20_body"><style:paragraph-properties fo:margin-left="0.4in" fo:margin-right="0.4in"/><style:text-properties fo:font-style="italic"/></style:style><style:style style:name="Preformatted_20_Text" style:display-name="Preformatted Text" style:family="paragraph" style:parent-style-name="Standard"><style:text-properties fo:font-family="'Courier New', monospace" fo:font-size="10pt"/></style:style><style:style style:name="List_20_Contents" style:display-name="List Contents" style:family="paragraph" style:parent-style-name="Text_20_body"><style:paragraph-properties fo:margin-bottom="0.04in"/></style:style><style:style style:name="Table_20_Contents" style:display-name="Table Contents" style:family="paragraph" style:parent-style-name="Standard"/><style:style style:name="Caption" style:family="paragraph" style:parent-style-name="Text_20_body"><style:text-properties fo:font-size="9pt" fo:font-style="italic"/></style:style><style:style style:name="Provenance" style:family="paragraph" style:parent-style-name="Text_20_body"><style:text-properties fo:font-size="9pt" fo:color="${palette.muted}"/></style:style></office:styles></office:document-styles>`;
}

function openContent(document: PageDocument): string {
	const automatic = [
		'<style:style style:name="TB" style:family="text"><style:text-properties fo:font-weight="bold"/></style:style>',
		'<style:style style:name="TI" style:family="text"><style:text-properties fo:font-style="italic"/></style:style>',
		'<style:style style:name="TBI" style:family="text"><style:text-properties fo:font-weight="bold" fo:font-style="italic"/></style:style>',
		...['C', 'BC', 'IC', 'BIC'].map(
			(name) =>
				`<style:style style:name="T${name}" style:family="text"><style:text-properties fo:font-family="'Courier New', monospace"${name.includes('B') ? ' fo:font-weight="bold"' : ''}${name.includes('I') ? ' fo:font-style="italic"' : ''}/></style:style>`
		),
		`<style:style style:name="Rule" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:border-bottom="0.5pt solid ${palette.border}" fo:padding-bottom="0.04in"/></style:style>`,
		'<style:style style:name="Table" style:family="table"><style:table-properties style:width="6.5in" table:align="margins"/></style:style>',
		`<style:style style:name="Cell" style:family="table-cell"><style:table-cell-properties fo:border="0.5pt solid ${palette.border}" fo:padding="0.04in"/></style:style>`,
		listStyle('LBullets', false),
		listStyle('LNumbered', true)
	].join('');
	const top = provenance(document)
		.map((line, index) =>
			index === 0
				? `<text:p text:style-name="Provenance">${escapeHtml(line.split(': ')[0])}: <text:a xlink:type="simple" xlink:href="${escapeHtml(document.address)}">${escapeHtml(document.address)}</text:a></text:p>`
				: `<text:p text:style-name="Provenance">${escapeHtml(line)}</text:p>`
		)
		.join('');
	return `<?xml version="1.0" encoding="UTF-8"?><office:document-content ${openDocumentNamespaces} office:version="1.3"><office:automatic-styles>${automatic}</office:automatic-styles><office:body><office:text>${top}${openBlocks(document.blocks)}</office:text></office:body></office:document-content>`;
}

/** The page as an OpenDocument text. */
export function pageOpenDocument(document: PageDocument): Uint8Array {
	const made = document.made.toISOString().replace(/\.\d{3}Z$/, '');
	const files: Zippable = {
		// The type comes first and is stored, not compressed, so a program can read it at a fixed place.
		mimetype: [strToU8('application/vnd.oasis.opendocument.text'), { level: 0 }],
		'META-INF/manifest.xml': strToU8(
			'<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3"><manifest:file-entry manifest:full-path="/" manifest:version="1.3" manifest:media-type="application/vnd.oasis.opendocument.text"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/></manifest:manifest>'
		),
		'meta.xml': strToU8(
			`<?xml version="1.0" encoding="UTF-8"?><office:document-meta ${openDocumentNamespaces} office:version="1.3"><office:meta><dc:title>${escapeHtml(document.title)}</dc:title><meta:initial-creator>${escapeHtml(document.siteName)}</meta:initial-creator><meta:creation-date>${made}</meta:creation-date><dc:description>${escapeHtml(`From ${document.address}`)}</dc:description></office:meta></office:document-meta>`
		),
		'styles.xml': strToU8(openStyles()),
		'content.xml': strToU8(openContent(document))
	};
	return zipSync(files);
}
