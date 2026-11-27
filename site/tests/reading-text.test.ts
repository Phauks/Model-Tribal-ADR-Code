import { describe, expect, it } from 'vitest';
import { cleanPageHtml, readingFromPlainText, readingHtmlDocument, readingMarkdown, readingText } from '#lib/reading-text.ts';

describe('readingFromPlainText', () => {
	const text = 'Text as transcribed by Oklahoma State University\n\nBy the President of the United States\n\nSee the above diagram.\n\nIt is hereby ordered that the lands described in the order of the Department of the Interior be with-\ndrawn from sale and settlement.\n\nU. S. Grant\n\fPage two words.';
	const reading = readingFromPlainText(text, '/requests?kind=contribute');

	it('takes the source note out of the text', () => {
		expect(reading.note).toBe('Text as transcribed by Oklahoma State University');
		expect(reading.html).not.toContain('transcribed by');
	});

	it('keeps printed lines, joining a word broken over a line', () => {
		expect(reading.printedLines).toBe(true);
		expect(reading.html).toContain('be with<span class="printed-hyphen">-</span><br class="printed">drawn');
	});

	it('marks a signature after the text it signs', () => {
		expect(reading.html).toContain('<p class="signature"><span class="signer">U. S. Grant</span></p>');
	});

	it('notes a drawing the copy does not have, after the paragraph that names it', () => {
		expect(reading.html).toMatch(/<p>See the above diagram\.<\/p>\n<div class="figure-missing" role="note">.*Suggest a copy of the diagram<\/a>/);
	});

	it('turns a form feed into a page rule', () => {
		expect(reading.pages).toEqual(['2']);
		expect(reading.html).toContain('<div class="page-rule" id="page-2" data-page="2"><a href="#page-2">Page 2</a></div>');
	});

	it('does not take a capitalized heading for a signature', () => {
		expect(readingFromPlainText('A long paragraph of the order that runs on past eighty letters of text before the heading.\n\nGENERAL PROVISIONS').html).not.toContain('signature');
	});
});

describe('cleanPageHtml', () => {
	it('drops a page’s menus, scripts and script links, and keeps its in-page links apart from the card’s', () => {
		const { html } = cleanPageHtml('<nav><a href="/">Home</a></nav><p>One <script>alert(1)</script><a href="javascript:alert(1)">bad</a> <a href="#n1">1</a><p>Two<footer>x</footer>', { base: 'https://example.org/a' });
		expect(html).toBe('<p>One bad <a href="#text-n1">1</a></p><p>Two</p>');
	});

	it('opens outside links in a new tab', () => {
		const { html } = cleanPageHtml('<p>See <a href="other.html">the treaty</a>.</p>', { base: 'https://example.org/dir/a.html' });
		expect(html).toContain('href="https://example.org/dir/other.html"');
		expect(html).toContain('class="external"');
		expect(html).toContain('target="_blank"');
	});

	it('splits a paragraph where a printed page of the reports turns', () => {
		const { html, pages } = cleanPageHtml('<p>Before <a id="p132" href="#p132" data-label="132" class="page-label">*132</a>after</p>', { caselaw: true });
		expect(pages).toEqual(['132']);
		expect(html).toBe('<p>Before </p><div class="page-rule" id="page-132" data-page="132"><a href="#page-132">Page 132</a></div><p data-continued>after</p>');
	});

	it('keeps the language a passage is written in', () => {
		expect(cleanPageHtml('<p lang="chr">ᏣᎳᎩ</p>').html).toBe('<p lang="chr">ᏣᎳᎩ</p>');
	});
});

describe('readingText', () => {
	it('reads a text or a web page, and nothing else', () => {
		expect(readingText('Words.', 'text/plain')?.html).toBe('<p>Words.</p>');
		expect(readingText('<html><body><p>Words.</p></body></html>', 'text/html')?.html).toContain('<p>Words.</p>');
		expect(readingText('%PDF-1.4', 'application/pdf')).toBeUndefined();
	});
});

describe('downloads', () => {
	const reading = readingFromPlainText('First paragraph.\n\fSecond page.');
	const details = { title: 'Executive Order of May 20, 1873', citation: '1 Kappler 870', original: 'https://treaties.okstate.edu/x', copy: '/copies/a/b.txt', sha256: 'ab12' };

	it('writes Markdown with the citation, page marks and where the copy came from', () => {
		const markdown = readingMarkdown(reading, details, 'https://triballawproject.org');
		expect(markdown).toContain('# Executive Order of May 20, 1873');
		expect(markdown).toContain('1 Kappler 870');
		expect(markdown).toContain('Page 2');
		expect(markdown).toContain('https://treaties.okstate.edu/x');
		expect(markdown).toContain('ab12');
	});

	it('writes a web page with no scripts', () => {
		const page = readingHtmlDocument(reading, details, 'https://triballawproject.org');
		expect(page).toMatch(/^<!doctype html>/i);
		expect(page).not.toMatch(/<script/i);
		expect(page).toContain('First paragraph.');
	});
});
