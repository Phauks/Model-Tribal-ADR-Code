import { describe, expect, it } from 'vitest';
import { renderEssay, type EssayLibrary } from '#lib/essays/render.ts';

const library: EssayLibrary = {
	citation: (key) =>
		({
			'worcester-v-georgia': '<i>Worcester v. Georgia</i>, 31 U.S. (6 Pet.) 515 (1832).',
			'narf-ipi-home': 'Native American Rights Fund, <i>Indigenous Peacemaking Initiative</i>.'
		})[key],
	term: (id) => ({ 'tribal-court': 'Tribal court' })[id]
};

const essay = `---
title: "A timeline"
part: i
---

# A timeline

Intro with a "quoted" word [@worcester-v-georgia, at 561] and a [[tribal-court|Tribal courts]] link.

Second paragraph.

## The treaty era

:::: case worcester-v-georgia
What the Court held.

::: quotes
> The Cherokee nation, then, is a distinct community.

— [@worcester-v-georgia, at 561]
:::

::: treatment
Distinguished later.
:::
::::

::: quote
Peacemaking is not alternative dispute resolution.

— [@narf-ipi-home]
:::

### A subsection

::: analysis Why it matters
Our reading.
:::

Cites [@missing-source] and [[missing-term]].
`;

describe('rendering an essay', () => {
	const rendered = renderEssay(essay, library);

	it('takes the title from the front matter and leaves the first heading out of the text', () => {
		expect(rendered.title).toBe('A timeline');
		expect(rendered.html).not.toContain('<h1');
	});

	it('numbers citations as markers and lists each source once', () => {
		expect(rendered.html).toContain('<sup class="citation"><a id="cite-1-1" class="note-marker" href="#source-1"');
		expect(rendered.html).toContain('data-where="at 561"');
		expect(rendered.sources.map((source) => [source.number, source.key, source.backlinks.length])).toEqual([
			[1, 'worcester-v-georgia', 3],
			[2, 'narf-ipi-home', 1],
			[3, 'missing-source', 1]
		]);
	});

	it('draws the case, quotation and analysis boxes', () => {
		expect(rendered.html).toContain('<section class="essay-case">');
		expect(rendered.html).toContain('<p class="essay-case-citation"><i>Worcester v. Georgia</i>, 31 U.S. (6 Pet.) 515 (1832).');
		expect(rendered.html).toContain('<p class="essay-block-label">Quotes</p>');
		expect(rendered.html).toContain('<p class="essay-block-label">Treatment</p>');
		expect(rendered.html).toContain('<figure class="essay-quote">');
		expect(rendered.html).toContain('<aside class="essay-analysis">\n<p class="essay-block-label">Analysis: Why it matters</p>');
		expect(rendered.html.match(/class="essay-attribution"/g)).toHaveLength(2);
	});

	it('links glossary terms, curls quotes, and gives headings ids for the outline', () => {
		expect(rendered.html).toContain('<a class="term-link" href="/glossary/tribal-court">Tribal courts</a>');
		expect(rendered.html).toContain('“quoted”');
		expect(rendered.headings).toEqual([
			{ label: 'The treaty era', link: '#the-treaty-era', children: [{ label: 'A subsection', link: '#a-subsection' }] }
		]);
	});

	it('reports citations and glossary links that point to nothing', () => {
		expect(rendered.problems).toEqual([
			'No published glossary entry has the id "missing-term".',
			'No source record has the key "missing-source".'
		]);
	});
});
