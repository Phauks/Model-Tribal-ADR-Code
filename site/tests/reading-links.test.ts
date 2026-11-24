import { describe, expect, it } from 'vitest';
import { readingLinksAfter, readingLinksHtml } from '#lib/reading-links.ts';

const links = {
	checked: '2026-11-23',
	links: [
		{ site: 'courtlistener', label: 'CourtListener', access: 'free' as const, link: 'https://www.courtlistener.com/opinion/109857/santa-clara-pueblo-v-martinez/' },
		{ site: 'westlaw', label: 'Westlaw', access: 'subscription' as const, link: 'https://1.next.westlaw.com/Link/Document/FullText?findType=Y&cite=436%20U.S.%2049' },
		{ site: 'library-of-congress', label: 'Library of Congress', access: 'official' as const, link: 'https://www.loc.gov/item/usrep436049/' },
		{ site: 'wikipedia', label: 'Wikipedia', access: 'background' as const, link: 'https://en.wikipedia.org/wiki/Santa_Clara_Pueblo_v._Martinez' },
		{ site: 'lexis', label: 'Lexis', access: 'subscription' as const, link: 'https://advance.lexis.com/api/search?q=436%20U.S.%2049' }
	]
};

function list(html: string): string {
	const shown = /<span class="reading-list">([\s\S]*)<\/span><\/span>$/.exec(html)?.[1] ?? '';
	return shown.replace(/<span class="visually-hidden">[^<]*<\/span>/g, '').replace(/<[^>]+>/g, '');
}

describe('where to read a cited case', () => {
	it('gives the saved copy, the other sites and further reading a line each, with no mark for a subscription on the page', () => {
		const saved = '<span class="source-saved"><a href="/copies/x">Saved copy</a> (official report, PDF, Nov. 23, 2026; <a class="source-verify" href="/downloads">SHA-256</a>)</span>';
		const html = readingLinksHtml(links, saved);
		const lines = [...html.matchAll(/<span class="reading-line[^"]*">([\s\S]*?)<\/span>(?=<span class="reading-line|<\/span><\/span>$)/g)].map((line) => list(`<span class="reading-list">${line[1]}</span></span>`));
		expect(lines).toEqual([
			'Saved copy (official report, PDF, Nov. 23, 2026; SHA-256)',
			'CourtListener · Library of Congress · Westlaw · Lexis',
			'Further reading: Wikipedia'
		]);
		expect(html).not.toContain('$');
		expect(html).toContain('aria-label="Where to read it, 6 places"');
		expect(html).toContain('aria-expanded="false"');
		expect(html).toContain('<span class="visually-hidden"> (subscription)</span>');
		expect(html).toContain('href="https://1.next.westlaw.com/Link/Document/FullText?findType=Y&amp;cite=436%20U.S.%2049"');
	});

	it('counts one place in the singular', () => {
		expect(readingLinksHtml(undefined, '<span class="source-saved">x</span>')).toContain('aria-label="Where to read it, 1 place"');
	});

	it('is empty when there is nowhere to list', () => {
		expect(readingLinksHtml(undefined)).toBe('');
	});

	it('moves the icon after the markers at the head of a case box', () => {
		const citation = `<cite>A v. B</cite>.${readingLinksHtml(links)}`;
		expect(readingLinksAfter(citation, '<sup>[1]</sup>')).toMatch(/^<cite>A v\. B<\/cite>\.<sup>\[1\]<\/sup> <span class="reading-links">/);
		expect(readingLinksAfter('<cite>A</cite>', '<sup>[1]</sup>')).toBe('<cite>A</cite><sup>[1]</sup>');
	});
});
