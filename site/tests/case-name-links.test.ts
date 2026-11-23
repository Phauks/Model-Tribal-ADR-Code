import { describe, expect, it } from 'vitest';
import { renderEssay, type EssayLibrary } from '#lib/essays/render.ts';

const library: EssayLibrary = {
	citation: (key) => ({ 'worcester-v-georgia': '<i>Worcester v. Georgia</i>, 31 U.S. (6 Pet.) 515 (1832).' })[key],
	term: () => undefined,
	caseNames: () => ({
		'worcester-v-georgia': 'Worcester v. Georgia',
		'cherokee-nation-v-georgia': 'Cherokee Nation v. Georgia',
		'ex-parte-crow-dog': 'Ex parte Crow Dog',
		'united-states-v-kagama': 'United States v. Kagama',
		'united-states-v-wheeler': 'United States v. Wheeler',
		'california-v-cabazon-band-of-mission-indians': 'California v. Cabazon Band of Mission Indians'
	}),
	boxPage: (anchor) => (anchor === 'case-united-states-v-kagama' ? '/essays/other' : undefined),
	caseLink: (key) =>
		({ 'ex-parte-crow-dog': '/copies/tile.loc.gov/crow-dog.pdf', 'california-v-cabazon-band-of-mission-indians': '/copies/cabazon.pdf' })[key]
};

describe('case names in the text', () => {
	it('links the first mention in each section to the box, another page or the opinion', () => {
		const html = renderEssay(
			[
				'## One',
				'',
				'*Worcester v. Georgia* held it, as *Worcester* says again. *Ex parte Crow Dog* and *Kagama* followed.',
				'',
				'## Two',
				'',
				'*Worcester* again, and *Georgia* alone is no case.',
				'',
				':::: case worcester-v-georgia',
				'::: holding',
				'*Worcester v. Georgia* in its own box, citing *Cherokee Nation v. Georgia*.',
				':::',
				'::::'
			].join('\n'),
			library
		).html;
		expect(html.match(/data-case="worcester-v-georgia"/g)).toHaveLength(2);
		expect(html).toContain('<a href="#case-worcester-v-georgia" class="case-link" data-case="worcester-v-georgia"><em>Worcester v. Georgia</em></a> held it, as <em>Worcester</em> says');
		expect(html).toContain('<a href="/copies/tile.loc.gov/crow-dog.pdf" class="case-link" data-case="ex-parte-crow-dog" target="_blank" rel="noopener"><em>Ex parte Crow Dog</em><span class="visually-hidden"> (opens in a new tab)</span></a>');
		expect(html).toContain('<a href="/essays/other#case-united-states-v-kagama" class="case-link" data-case="united-states-v-kagama"><em>Kagama</em></a>');
		expect(html).toContain('<em>Georgia</em> alone');
		// No box and no copy: Cherokee Nation is left as text; the box does not link to itself.
		expect(html).toContain('<em>Worcester v. Georgia</em> in its own box, citing <em>Cherokee Nation v. Georgia</em>');
	});

	it('knows a case by the start of its full name', () => {
		expect(renderEssay('*California v. Cabazon Band* and *California v. Cabazon*.\n', library).html).toContain(
			'<a href="/copies/cabazon.pdf" class="case-link" data-case="california-v-cabazon-band-of-mission-indians" target="_blank" rel="noopener"><em>California v. Cabazon Band</em><span class="visually-hidden"> (opens in a new tab)</span></a> and <em>California v. Cabazon</em>.'
		);
	});

	it('leaves headings and existing links alone', () => {
		const html = renderEssay('## *Worcester v. Georgia*\n\n[*Worcester*](https://example.org)\n', library).html;
		expect(html).not.toContain('case-link');
	});
});
