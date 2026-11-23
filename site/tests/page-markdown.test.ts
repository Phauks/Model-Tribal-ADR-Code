import { describe, expect, it } from 'vitest';
import { markdownFileName } from '#lib/page-markdown.ts';

// The conversion itself needs a page to read, so it is checked in a browser against the built site;
// this file checks the parts that need none.
describe('the page as Markdown', () => {
	it('names the file after the page', () => {
		expect(markdownFileName('/nations/navajo-nation')).toBe('navajo-nation.md');
		expect(markdownFileName('/glossary/')).toBe('glossary.md');
		expect(markdownFileName('/')).toBe('home.md');
		expect(markdownFileName('/essays/a%20b')).toBe('a-b.md');
	});
});
