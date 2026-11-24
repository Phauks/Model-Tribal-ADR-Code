import { describe, expect, it } from 'vitest';
import {
	allWordsOf,
	carryForward,
	compressOverlay,
	expandOverlay,
	freshBlame,
	overlayOf,
	sectionHistories,
	writersAndEditors,
	type Blame
} from '../src/lib/essays/word-blame.ts';

const headings = [
	{ slug: 'treaties', title: 'Treaties', level: 2 as const },
	{ slug: 'the-cherokee-cases', title: 'The Cherokee Cases', level: 3 as const },
	{ slug: 'allotment', title: 'Allotment', level: 2 as const }
];

const first = [
	'---',
	'title: Legal history',
	'---',
	'',
	'## Treaties',
	'',
	'Treaties came first.',
	'',
	'### The Cherokee Cases',
	'',
	'The Court decided two cases about Georgia.',
	'',
	':::: case worcester-v-georgia',
	'::: holding',
	"Georgia's laws had no force.",
	':::',
	'::::',
	'',
	'## Allotment',
	'',
	'Land was divided.',
	''
].join('\n');

function chain(texts: { text: string; person: string | null; overlay?: (string | null)[] }[]): { text: string; blame: Blame } {
	let current: { text: string; blame: Blame } | null = null;
	texts.forEach((step, index) => {
		const blame: Blame = current ? carryForward(current, step.text, { person: step.person, version: index + 1 }, step.overlay) : freshBlame(step.text, { person: step.person, version: 1 }, step.overlay);
		current = { text: step.text, blame };
	});
	return current!;
}

function part(text: string, blame: Blame, slug: string, person: string) {
	return sectionHistories(text, blame, headings)
		.find((history) => history.slug === slug)!
		.parts.find((candidate) => candidate.person === person);
}

describe('word blame', () => {
	it('counts only words, leaving out front matter and box fences', () => {
		expect(allWordsOf(first)).toEqual(['Treaties', 'Treaties', 'came', 'first', 'The', 'Cherokee', 'Cases', 'The', 'Court', 'decided', 'two', 'cases', 'about', 'Georgia', "Georgia's", 'laws', 'had', 'no', 'force', 'Allotment', 'Land', 'was', 'divided']);
		expect(allWordsOf('See [the act](https://example.org/a-b) at 25 U.S.C. § 2701.')).toEqual(['See', 'the', 'act', 'at', '25', 'U', 'S', 'C', '2701']);
	});

	it('keeps each word with the person who first wrote it, and credits new words to who saved them', () => {
		const second = first.replace('The Court decided two cases about Georgia.', 'The Supreme Court decided two cases about Georgia in 1831 and 1832.');
		const { text, blame } = chain([
			{ text: first, person: 'trevor' },
			{ text: second, person: 'ann' }
		]);
		const cases = sectionHistories(text, blame, headings).find((history) => history.slug === 'the-cherokee-cases')!;
		expect(cases.total).toBe(20);
		expect(cases.parts.map((candidate) => [candidate.person, candidate.words, candidate.paragraphs])).toEqual([
			['trevor', 15, 3],
			['ann', 5, 1]
		]);
		const { wrote, edited } = writersAndEditors(cases);
		expect(wrote.map((candidate) => candidate.person)).toEqual(['trevor']);
		expect(edited.map((candidate) => [candidate.person, candidate.changedFrom])).toEqual([['ann', 2]]);
	});

	it('counts taking words out as editing, though no new words are left', () => {
		const second = first.replace('Land was divided.', 'Land divided.');
		const { text, blame } = chain([
			{ text: first, person: 'trevor' },
			{ text: second, person: 'ben' }
		]);
		const ben = part(text, blame, 'allotment', 'ben')!;
		expect([ben.words, ben.paragraphs]).toEqual([0, 1]);
		expect(writersAndEditors(sectionHistories(text, blame, headings)[2]).edited.map((candidate) => candidate.person)).toEqual(['ben']);
	});

	it('keeps credit for words through moves and later versions', () => {
		const moved = first.replace('## Allotment\n\nLand was divided.\n', '').replace('## Treaties', '## Allotment\n\nLand was divided.\n\n## Treaties');
		const reordered = [
			{ slug: 'allotment', title: 'Allotment', level: 2 as const },
			{ slug: 'treaties', title: 'Treaties', level: 2 as const },
			{ slug: 'the-cherokee-cases', title: 'The Cherokee Cases', level: 3 as const }
		];
		const { text, blame } = chain([
			{ text: first, person: 'trevor' },
			{ text: moved, person: 'ann' }
		]);
		const allotment = sectionHistories(text, blame, reordered).find((history) => history.slug === 'allotment')!;
		expect(allotment.parts.map((candidate) => [candidate.person, candidate.words])).toEqual([['trevor', 4]]);
	});

	it('takes the words of a live save from who typed them', () => {
		const typed = first.replace('Treaties came first.', 'Treaties came first, and then removal.');
		const both = typed.replace('Land was divided.', 'Land was divided into parcels.');
		const overlay = overlayOf(first, [
			{ person: 'ann', text: typed },
			{ person: 'ben', text: both }
		], both);
		expect(expandOverlay(compressOverlay(overlay))).toEqual(overlay);
		const { text, blame } = chain([
			{ text: first, person: 'trevor' },
			{ text: both, person: 'ann', overlay }
		]);
		expect(part(text, blame, 'treaties', 'ann')!.words).toBe(3);
		expect(part(text, blame, 'allotment', 'ben')!.words).toBe(2);
		expect(part(text, blame, 'allotment', 'ann')).toBeUndefined();
	});

	it('leaves out text no one is known to have written, but counts it in the total', () => {
		const second = first.replace('Land was divided.', 'Land was divided into parcels.');
		const { text, blame } = chain([
			{ text: first, person: null },
			{ text: second, person: 'ann' }
		]);
		const allotment = sectionHistories(text, blame, headings)[2];
		expect(allotment.total).toBe(6);
		expect(allotment.parts.map((candidate) => [candidate.person, candidate.words])).toEqual([['ann', 2]]);
	});

	it('answers nothing when the headings do not match the text', () => {
		const { text, blame } = chain([{ text: first, person: 'trevor' }]);
		expect(sectionHistories(text, blame, headings.slice(0, 2))).toEqual([]);
	});
});
