import { describe, expect, it } from 'vitest';
import { citationKeys, citationsInText, linkCitations, linkSigners } from '#lib/text-links.ts';

describe('citationsInText', () => {
	const text = 'See 25 U.S.C. § 1911 and 25 C.F.R. § 83.1, Pub. L. 100-89, 48 Stat. 984, Exec. Order No. 13175, and Worcester v. Georgia, 31 U.S. 515 (1832); section 450f of this title';

	it('finds the Code, regulations, laws, orders and cases', () => {
		expect(citationsInText(text, { codeTitle: '25' }).map((found) => found.key)).toEqual(['usc:25:1911', 'cfr:25:83.1', 'pl:100-89', 'stat:48:984', 'eo:13175', 'case:31 us 515', 'usc:25:450f']);
	});

	it('reads "of this title" only in a title of the Code', () => {
		expect(citationsInText('section 450f of this title').map((found) => found.key)).toEqual([]);
	});

	it('gives an official address for a cite the site has no page for, but none for a case', () => {
		const found = citationsInText(text, { codeTitle: '25' });
		expect(found.find((entry) => entry.key === 'usc:25:1911')?.fallback).toMatch(/^https:\/\/uscode\.house\.gov\//);
		expect(found.find((entry) => entry.key === 'stat:48:984')?.fallback).toBe('https://www.govinfo.gov/link/statute/48/984');
		expect(found.find((entry) => entry.key.startsWith('case:'))?.fallback).toBeUndefined();
	});
});

describe('linkCitations', () => {
	it('links a cite to its page and leaves a link already there alone', () => {
		const html = '<p>See 25 U.S.C. § 1911 and <a href="/x">48 Stat. 984</a>.</p>';
		expect(citationKeys(html)).toEqual(['usc:25:1911']);
		expect(linkCitations(html, new Map([['usc:25:1911', '/laws/usc-25-1911']]))).toBe('<p>See <a href="/laws/usc-25-1911" data-cite-link>25 U.S.C. § 1911</a> and <a href="/x">48 Stat. 984</a>.</p>');
	});

	it('leaves a case the site does not have as plain words', () => {
		expect(linkCitations('<p>31 U.S. 515</p>', new Map())).toBe('<p>31 U.S. 515</p>');
	});
});

describe('linkSigners', () => {
	it('links a signature to the signer’s page', () => {
		expect(linkSigners('<p class="signature"><span class="signer">THEODORE ROOSEVELT</span></p>', [{ name: 'Theodore Roosevelt', link: '/people/roosevelt' }])).toBe('<p class="signature"><span class="signer"><a href="/people/roosevelt">THEODORE ROOSEVELT</a></span></p>');
	});
});
