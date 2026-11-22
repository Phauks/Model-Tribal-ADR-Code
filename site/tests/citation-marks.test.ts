import { describe, expect, it } from 'vitest';
import { backlinkLetter, markHtml, marksHtml, type CitationMark } from '#lib/citation-marks.ts';
import { SourceUses } from '#lib/server/source-uses.ts';

describe('citation markers', () => {
	it('letters backlinks a to z, then aa, ab, as Wikipedia does', () => {
		expect([0, 1, 25, 26, 27, 51, 52].map(backlinkLetter)).toEqual(['a', 'b', 'z', 'aa', 'ab', 'az', 'ba']);
	});

	it('writes a marker that links to its source and carries its own id', () => {
		expect(markHtml({ number: 3, anchor: 'cite-3-2', where: 'p. 4 & 5' })).toBe(
			'<a id="cite-3-2" class="note-marker" href="#source-3" aria-label="Source 3" data-where="p. 4 &amp; 5">3</a>'
		);
		expect(marksHtml([])).toBe('');
		expect(marksHtml([{ number: 1, anchor: 'cite-1-1' }])).toMatch(/^<sup class="citation"><a /);
	});
});

describe('SourceUses markers', () => {
	it('numbers sources in order and gives each marker a backlink', () => {
		const uses = new SourceUses((key) => key);
		const first = uses.cite('alpha', { section: 'Contacts', text: 'Phone' });
		const second = uses.cite('beta', { section: 'Contacts', text: 'Email' });
		const again = uses.cite('alpha', { section: 'Courts', text: 'Tribal court', where: 'p. 2' });
		expect([first.anchor, second.anchor, again.anchor]).toEqual(['cite-1-1', 'cite-2-1', 'cite-1-2']);
		expect(again.where).toBe('p. 2');
		expect(uses.list.map((entry) => entry.backlinks)).toEqual([['cite-1-1', 'cite-1-2'], ['cite-2-1']]);
	});

	it('puts one marker per source beside a fact, however many of its facts the source supports', () => {
		const uses = new SourceUses((key) => key);
		const marks: CitationMark[] = [];
		uses.cite('alpha', { section: 'States', text: 'Arizona (reservation)' }, marks);
		uses.cite('alpha', { section: 'States', text: 'Arizona (trust land)' }, marks);
		uses.cite('beta', { section: 'States', text: 'Arizona (office)' }, marks);
		expect(marks.map((mark) => mark.anchor)).toEqual(['cite-1-1', 'cite-2-1']);
		expect(uses.list[0].backlinks).toEqual(['cite-1-1']);
		expect(uses.list[0].groups[0].facts).toEqual(['Arizona (reservation)', 'Arizona (trust land)']);
	});

	it('records a use without a marker when add() is used', () => {
		const uses = new SourceUses((key) => key);
		uses.add('census', { section: 'Map', text: 'outlines' });
		expect(uses.list[0].backlinks).toEqual([]);
	});
});

describe('Markdown citations', () => {
	it('turns each citation into a marker against the last word, numbered by source', async () => {
		const { renderMarkdown } = await import('#lib/server/markdown.ts');
		const uses = new SourceUses((key) => key);
		const collector = { cite: (key: string, locator?: string) => uses.cite(key, { section: 'Entry', text: 'definition', where: locator }) };
		const html = renderMarkdown('One claim [@alpha, p. 3]. Another [@beta; @alpha].', collector);
		expect(html).toContain(
			'One claim<sup class="citation"><a id="cite-1-1" class="note-marker" href="#source-1" aria-label="Source 1" data-where="p. 3">1</a></sup>.'
		);
		expect(html).toContain('Another<sup class="citation"><a id="cite-2-1"');
		expect(html).toContain('<a id="cite-1-2" class="note-marker" href="#source-1"');
		expect(uses.list[0].backlinks).toEqual(['cite-1-1', 'cite-1-2']);
	});
});
