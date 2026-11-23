import { describe, expect, it } from 'vitest';
import { citationWithoutAddress, citedKeys, sourceDocuments } from '#lib/essays/source-documents.ts';
import { parseEssay } from '#lib/essays/document.ts';

describe('source document links', () => {
	it('reads the original, archived and saved copies from a full citation', () => {
		const html =
			'<cite>Worcester v. Georgia</cite> (1832). <span class="source-links has-archive"><a class="source-original" href="https://www.law.cornell.edu/a?b=1&amp;c=2">www.law.cornell.edu</a>' +
			'<span class="source-archived"><span class="source-separator">; </span><a href="https://web.archive.org/web/2026/x">archived copy, Nov. 21, 2026</a></span></span>' +
			' <span class="source-saved">(<a href="/copies/govinfo/worcester.pdf">copy on this site, saved Nov. 21, 2026, PDF</a>)</span>';
		expect(sourceDocuments(html)).toEqual({
			copy: { href: '/copies/govinfo/worcester.pdf', label: 'copy on this site, saved Nov. 21, 2026, PDF' },
			original: { href: 'https://www.law.cornell.edu/a?b=1&c=2', label: 'www.law.cornell.edu' },
			archived: { href: 'https://web.archive.org/web/2026/x', label: 'archived copy, Nov. 21, 2026' }
		});
		expect(sourceDocuments('<cite>A book</cite> (1990)')).toEqual({});
		// The essays' citations link the address itself.
		expect(
			sourceDocuments('Melton, 79 Judicature (1995), <a href="https://www.tribal-institute.org/articles/melton1.htm">https://www.tribal-institute.org/articles/melton1.htm</a>.')
		).toEqual({ original: { href: 'https://www.tribal-institute.org/articles/melton1.htm', label: 'www.tribal-institute.org' } });
	});

	it('drops the web address from a plain citation', () => {
		expect(citationWithoutAddress('Melton, 79 Judicature (1995), https://www.tribal-institute.org/a.htm.')).toBe('Melton, 79 Judicature (1995)');
		expect(citationWithoutAddress('Worcester v. Georgia, 31 U.S. 515 (1832). www.law.cornell.edu')).toBe('Worcester v. Georgia, 31 U.S. 515 (1832)');
	});

	it('lists the sources an essay cites, boxes included, in first-cited order', () => {
		const doc = parseEssay('Text [@b-source, at 2; @a-source].\n\n:::: case c-case\n::: holding\nHeld [@b-source].\n:::\n::::\n');
		expect(citedKeys(doc)).toEqual(['b-source', 'a-source', 'c-case']);
	});
});
