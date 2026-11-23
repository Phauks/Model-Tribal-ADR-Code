import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { pageOpenDocument, pageWord } from '#lib/office-documents.ts';
import { pageFileName, tidyRuns, type PageDocument } from '#lib/page-document.ts';
import { markdownRuns, pageMarkdown } from '#lib/page-markdown.ts';

// Reading the page needs a page, so it is checked in a browser against the built site; this file
// checks the writers, from blocks made by hand.
const document: PageDocument = {
	title: 'Navajo Nation',
	address: 'https://example.org/nations/navajo-nation',
	siteName: 'Model Tribal ADR Code',
	contentVersion: '0.0.1',
	made: new Date('2026-11-23T05:00:00Z'),
	blocks: [
		{ type: 'heading', level: 1, runs: [{ text: 'Navajo Nation' }] },
		{ type: 'paragraph', runs: [{ text: 'Federally recognized' }, { text: '[1]' }, { text: ' under ' }, { text: 'Pub. L. No. 103-454', link: 'https://example.org/a b' }] },
		{ type: 'list', ordered: true, items: [{ number: 3, blocks: [{ type: 'paragraph', runs: [{ text: 'Third source' }] }] }] },
		{ type: 'table', rows: [[[{ text: 'What' }], [{ text: 'Why' }]], [[{ text: 'Pages' }], [{ text: 'A|B', italic: true }]]] }
	]
};

describe('the page in other formats', () => {
	it('names the file after the page', () => {
		expect(pageFileName('/nations/navajo-nation', 'md')).toBe('navajo-nation.md');
		expect(pageFileName('/glossary/', 'docx')).toBe('glossary.docx');
		expect(pageFileName('/', 'odt')).toBe('home.odt');
		expect(pageFileName('/essays/a%20b', 'md')).toBe('a-b.md');
	});

	it('tidies spaces as a browser shows them', () => {
		expect(tidyRuns([{ text: '  a  ' }, { text: ' b', bold: true }, { text: '', lineBreak: true }, { text: ' c ' }])).toEqual([
			{ text: 'a ' },
			{ text: 'b', bold: true },
			{ text: '', lineBreak: true },
			{ text: 'c' }
		]);
	});

	it('writes Markdown with a header, escaped markers, links, numbers and tables', () => {
		const text = pageMarkdown(document);
		expect(text.startsWith('---\ntitle: "Navajo Nation"\nsource: https://example.org/nations/navajo-nation\n')).toBe(true);
		expect(text).toContain('Federally recognized\\[1\\] under [Pub. L. No. 103-454](https://example.org/a%20b)');
		expect(text).toContain('3. Third source');
		expect(text).toContain('| Pages | *A\\|B* |');
		expect(markdownRuns([{ text: 'bold ', bold: true }])).toBe('**bold** ');
	});

	it('writes a Word document with its parts, links and list numbers', () => {
		const files = unzipSync(pageWord(document));
		expect(Object.keys(files)).toEqual(expect.arrayContaining(['[Content_Types].xml', 'word/document.xml', 'word/styles.xml', 'word/numbering.xml', 'word/_rels/document.xml.rels']));
		const body = strFromU8(files['word/document.xml']);
		expect(body).toContain('<w:pStyle w:val="Heading1"/>');
		expect(body).toContain('Pub. L. No. 103-454');
		expect(strFromU8(files['word/_rels/document.xml.rels'])).toContain('Target="https://example.org/a b" TargetMode="External"');
		expect(strFromU8(files['word/numbering.xml'])).toContain('<w:startOverride w:val="3"/>');
	});

	it('writes an OpenDocument text with its type stored first', () => {
		const bytes = pageOpenDocument(document);
		// The first entry's name sits at byte 30 of the file, and it is stored (method 0).
		expect(strFromU8(bytes.subarray(30, 38))).toBe('mimetype');
		expect(bytes[8]).toBe(0);
		const files = unzipSync(bytes);
		expect(strFromU8(files.mimetype)).toBe('application/vnd.oasis.opendocument.text');
		const content = strFromU8(files['content.xml']);
		expect(content).toContain('<text:h text:style-name="Heading_20_1" text:outline-level="1">Navajo Nation</text:h>');
		expect(content).toContain('text:start-value="3"');
		expect(content).toContain('<table:table-header-rows>');
	});
});
