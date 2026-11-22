import { describe, expect, it } from 'vitest';
import { parseEssay, serializeEssay } from '#lib/essays/document.ts';
import { renderEssay, type EssayLibrary } from '#lib/essays/render.ts';
import { missingEllipses, referencesIn } from '#lib/essays/syntax.ts';

const library: EssayLibrary = {
	citation: (key) =>
		({
			'worcester-v-georgia': '<i>Worcester v. Georgia</i>, 31 U.S. (6 Pet.) 515 (1832).',
			'usc-25-1301': 'Indian Civil Rights Act of 1968, 25 U.S.C. §§ 1301–1304.'
		})[key],
	term: () => undefined
};

const body = `:::: case worcester-v-georgia
::: background
Georgia arrested missionaries living in the Cherokee Nation.
:::

::: question
Whether Georgia's laws had force in the Cherokee Nation.
:::

::: holding
They did not.
:::

::: quotes
> The Cherokee nation, then, is a distinct community.

[@worcester-v-georgia, at 561] (Marshall, C.J.)
:::

::: treatment
Distinguished later.
:::
::::

:::: law usc-25-1301
::: summary
Applies most of the Bill of Rights to tribal governments.
:::

::: quotes
> No Indian tribe in exercising powers of self-government shall ...

[@usc-25-1301, § 1302]
:::
::::
`;

describe('case and law boxes', () => {
	it('round-trips the Question, Holding and What it does parts and the law box', () => {
		const document = parseEssay(body);
		const kinds: string[] = [];
		document.descendants((node) => {
			if (node.type.name === 'case_part') kinds.push(node.attrs.kind);
			if (node.type.name === 'law_block') kinds.push(`law:${node.attrs.source}`);
		});
		expect(kinds).toEqual(['background', 'question', 'holding', 'quotes', 'treatment', 'law:usc-25-1301', 'summary', 'quotes']);
		expect(serializeEssay(parseEssay(serializeEssay(document)))).toBe(serializeEssay(document));
		expect(serializeEssay(document)).toContain(':::: law usc-25-1301\n::: summary\n');
	});

	it('renders each part with its label and gives each box an anchor', () => {
		const rendered = renderEssay(body, library);
		expect(rendered.problems).toEqual([]);
		expect(rendered.html).toContain('<section class="essay-case" id="case-worcester-v-georgia">');
		expect(rendered.html).toContain('<section class="essay-case essay-law" id="law-usc-25-1301">');
		for (const text of ['Case', 'Background', 'Question', 'Holding', 'Quotes', 'Treatment', 'Law', 'What it does']) {
			expect(rendered.html).toContain(`<p class="essay-block-label">${text}</p>`);
		}
		expect(rendered.html).toContain('Indian Civil Rights Act of 1968');
	});

	it('marks a citation-only paragraph, or the older dash form, as the attribution', () => {
		const html = renderEssay(body, library).html;
		expect(html).toContain('<p class="essay-attribution">');
		expect(html.match(/essay-attribution/g)).toHaveLength(2);
		const older = renderEssay('> It is so.\n\n— [@worcester-v-georgia]\n', library).html;
		expect(older).toContain('essay-attribution');
		const prose = renderEssay('> It is so.\n\nThe Court then said more [@worcester-v-georgia].\n', library).html;
		expect(prose).not.toContain('essay-attribution');
	});

	it('shows the fact lines under a box heading', () => {
		const withFacts: EssayLibrary = {
			...library,
			facts: (box, key) => (box === 'case' && key === 'worcester-v-georgia' ? [['Decided', 'March 3, 1832'], ['Majority', '<strong>Marshall</strong> (opinion of the Court)']] : [])
		};
		const html = renderEssay(body, withFacts).html;
		expect(html).toContain('<dl class="essay-case-facts">');
		expect(html).toContain('<div><dt>Decided</dt><dd>March 3, 1832</dd></div>');
		expect(html.match(/essay-case-facts/g)).toHaveLength(1);
	});

	it('counts a law box as a use of its source', () => {
		expect([...referencesIn(body).sourceKeys].sort()).toEqual(['usc-25-1301', 'worcester-v-georgia']);
	});
});

describe('ellipses in quotations', () => {
	it('follows the print rule', () => {
		expect(missingEllipses('The Cherokee nation, then, is a distinct community.')).toEqual({ start: false, end: false });
		expect(missingEllipses('the Cherokee nation is a distinct community.')).toEqual({ start: true, end: false });
		expect(missingEllipses('[w]e hold that')).toEqual({ start: true, end: true });
		expect(missingEllipses('... we hold that ...')).toEqual({ start: false, end: false });
		expect(missingEllipses('He said, "It is so."')).toEqual({ start: false, end: false });
		expect(missingEllipses('It is so. [@worcester-v-georgia, at 561]')).toEqual({ start: false, end: false });
	});

	it('warns about quotations cut without one, but does not refuse them', () => {
		const rendered = renderEssay('> the court held that tribes\n\n[@worcester-v-georgia]\n', library);
		expect(rendered.problems).toEqual([]);
		expect(rendered.warnings).toHaveLength(2);
		expect(renderEssay(body, library).warnings).toEqual([]);
	});
});
