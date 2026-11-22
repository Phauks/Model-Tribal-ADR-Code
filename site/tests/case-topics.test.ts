import { describe, expect, it } from 'vitest';
import { casesByTopicMarkdown, taggedCases } from '#lib/essays/case-topics.ts';
import { renderEssay } from '#lib/essays/render.ts';

const essay = `# Timeline

:::: case worcester-v-georgia
::: holding
Georgia's laws had no force in the Cherokee Nation.
:::

::: topics
Sovereignty; Civil jurisdiction.
:::
::::

:::: case cherokee-nation-v-georgia
::: topics
sovereignty
:::
::::

:::: case no-topics
::::

::: topics
Outside a box
:::
`;

const names: Record<string, { title: string; date: number[] }> = {
	'worcester-v-georgia': { title: 'Worcester v. Georgia', date: [1832, 3, 3] },
	'cherokee-nation-v-georgia': { title: 'Cherokee Nation v. Georgia', date: [1831, 3, 18] }
};

describe('the index of cases by topic', () => {
	it('reads the Topics part of each case box', () => {
		expect(taggedCases(essay)).toEqual([
			{ key: 'worcester-v-georgia', topics: ['Sovereignty', 'Civil jurisdiction'] },
			{ key: 'cherokee-nation-v-georgia', topics: ['sovereignty'] }
		]);
	});

	it('lists each topic in alphabetical order with its cases from the oldest', () => {
		expect(casesByTopicMarkdown(taggedCases(essay), (key) => names[key])).toBe(
			[
				'**Civil jurisdiction.** [*Worcester v. Georgia* (1832)](#case-worcester-v-georgia).',
				'**Sovereignty.** [*Cherokee Nation v. Georgia* (1831)](#case-cherokee-nation-v-georgia); [*Worcester v. Georgia* (1832)](#case-worcester-v-georgia).'
			].join('\n\n')
		);
	});

	it('shows a box’s topics as tags', () => {
		const html = renderEssay(essay, { citation: (key) => key, term: () => undefined }).html;
		expect(html).toContain('<ul class="essay-topics"><li>Sovereignty</li><li>Civil jurisdiction</li></ul>');
	});
});
