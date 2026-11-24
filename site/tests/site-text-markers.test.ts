import { compile } from 'svelte/compiler';
import { describe, expect, it } from 'vitest';
import { markSiteText, siteTextKey } from '#lib/site-text-markers.ts';
import { siteTextPlace } from '#lib/site-text.ts';
import { readPublished } from '#lib/server/site-text-build.ts';

const file = 'src/routes/sponsor/+page.svelte';

describe('markSiteText', () => {
	it('wraps fixed text, leaves expressions, and names each piece', () => {
		const source = `<dl><dt>Native nations with their own page</dt><dd>{count}</dd></dl>\n<p>Gifts go to {receiver}.</p>`;
		const { code, entries } = markSiteText(source, file);
		expect(entries.map((entry) => entry.words)).toEqual(['Native nations with their own page', 'Gifts go to']);
		expect(code).toContain(`<dt><site-text data-text="${entries[0].key}">Native nations with their own page</site-text></dt>`);
		expect(code).toContain(`<site-text data-text="${entries[1].key}">Gifts go to</site-text> {receiver}.`);
		expect(() => compile(code, { filename: file })).not.toThrow();
	});

	it('names fixed labels and skips code, svg and punctuation', () => {
		const source = `<button aria-label="Search" title={dynamic}>?</button><code>let words</code><svg><text>Axis</text></svg><span> · </span>`;
		const { code, entries } = markSiteText(source, file);
		expect(entries).toHaveLength(1);
		expect(entries[0]).toMatchObject({ words: 'Search', attribute: 'aria-label' });
		expect(code).toContain(`<button data-text-attributes="aria-label:${entries[0].key}" aria-label="Search"`);
	});

	it('writes published words in, escaped for Svelte', () => {
		const source = `<h2>More you can fund</h2><input placeholder="Any amount" /><select><option>Yearly</option></select>`;
		const first = markSiteText(source, file).entries;
		const published = new Map([
			[first[0].key, 'Fund {more} <now> & "then"'],
			[first[1].key, 'Say "how much"'],
			[first[2].key, 'Each year']
		]);
		const { code } = markSiteText(source, file, published);
		expect(code).toContain('Fund &#123;more&#125; &lt;now&gt; &amp; "then"');
		expect(code).toContain('placeholder="Say &quot;how much&quot;"');
		expect(code).toContain(`<option data-text="${first[2].key}">Each year</option>`);
		const compiled = compile(code, { filename: file, generate: 'server' }).js.code;
		expect(compiled).toContain('Fund {more} &lt;now> &amp; "then"');
	});

	it('gives repeated words in one file their own names, the same from build to build', () => {
		const { entries } = markSiteText('<p>Source</p><p>Source</p>', file);
		expect(entries[0].key).not.toBe(entries[1].key);
		expect(entries[0].key).toBe(siteTextKey(file, 'Source', '', 1));
		expect(entries[0].key).toMatch(/^[0-9a-z]{10}$/);
	});

	it('changes nothing in a page title but its words', () => {
		const source = '<svelte:head><title>Sponsor</title></svelte:head>';
		const key = markSiteText(source, file).entries[0].key;
		expect(markSiteText(source, file, new Map([[key, 'Give']])).code).toBe('<svelte:head><title>Give</title></svelte:head>');
	});
});

describe('siteTextPlace', () => {
	it('names pages by address and components in words', () => {
		expect(siteTextPlace('src/routes/sponsor/+page.svelte')).toBe('Sponsor');
		expect(siteTextPlace('src/routes/+page.svelte')).toBe('Home page');
		expect(siteTextPlace('src/routes/workspace/+layout.svelte')).toBe('Every page under Workspace');
		expect(siteTextPlace('src/lib/components/SiteHeader.svelte')).toBe('Site header');
		expect(siteTextPlace('src/routes/essays/[slug]/+page.svelte')).toBe('Essays › Any slug');
		expect(siteTextPlace('src/routes/workspace/site-text/+page.svelte')).toBe('Workspace › Site text');
	});
});

describe('readPublished', () => {
	it('accepts the published shape and refuses others', () => {
		expect(readPublished({ publication: 2, texts: { abcdefghij: 'Words' } })).toEqual({ publication: 2, texts: { abcdefghij: 'Words' } });
		expect(() => readPublished({ publication: '2', texts: {} })).toThrow();
		expect(() => readPublished({ publication: 1, texts: { bad: 'x' } })).toThrow();
	});
});
