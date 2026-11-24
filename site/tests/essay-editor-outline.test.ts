import { describe, expect, it } from 'vitest';
import { parseEssay } from '../src/lib/essays/document.ts';
import { draftMarks } from '../src/lib/essays/draft-marks.ts';
import { editorOutline, shortCitation } from '../src/lib/essays/editor-outline.ts';

const published = [
	'## Treaties and Removal',
	'',
	'Treaties came first.',
	'',
	'### The Cherokee Cases',
	'',
	'The Court decided two cases.',
	'',
	':::: case cherokee-nation-v-georgia',
	'::: holding',
	'No jurisdiction.',
	':::',
	'::::',
	'',
	'## Allotment',
	'',
	'Land was divided.',
	''
].join('\n');

const draft = [
	'## Treaties and Removal',
	'',
	'Treaties came first.',
	'',
	'### The Cherokee Cases',
	'',
	'The Court decided two cases.',
	'',
	':::: case cherokee-nation-v-georgia',
	'::: holding',
	'No jurisdiction.',
	':::',
	'::::',
	'',
	':::: case worcester-v-georgia',
	'::: holding',
	"Georgia's laws had no force.",
	':::',
	'::::',
	'',
	'::: analysis Why Worcester still matters',
	'It frames state power.',
	':::',
	'',
	'## Allotment',
	'',
	'Land was divided into parcels.',
	'',
	':::: law general-allotment-act',
	'::: summary',
	'Divided reservations.',
	':::',
	'::::',
	''
].join('\n');

const citations = new Map([
	['cherokee-nation-v-georgia', 'Cherokee Nation v. Georgia, 30 U.S. (5 Pet.) 1 (1831). Read it at Justia.'],
	['worcester-v-georgia', 'Worcester v. Georgia, 31 U.S. (6 Pet.) 515 (1832).'],
	['general-allotment-act', 'General Allotment Act, ch. 119, 24 Stat. 388 (1887).']
]);

describe('editorOutline', () => {
	it('lists sections, subsections and boxes, with dots for what changed, what is new and what is in review', () => {
		const doc = parseEssay(draft);
		const items = editorOutline(doc, { marks: draftMarks(doc, parseEssay(published)), inReview: new Set(['the-cherokee-cases']), citations });
		expect(items.map((item) => [item.label, item.mark])).toEqual([
			['Treaties and Removal', 'changed'],
			['Allotment', 'changed']
		]);
		const cases = items[0].children![0];
		expect([cases.label, cases.link, cases.mark]).toEqual(['The Cherokee Cases', '#the-cherokee-cases', 'review']);
		expect(cases.children!.map((item) => [item.kind, item.label, item.mark])).toEqual([
			['case', 'Cherokee Nation v. Georgia (1831)', 'review'],
			['case', 'Worcester v. Georgia (1832)', 'new'],
			['analysis', 'Analysis: Why Worcester still matters', 'new']
		]);
		expect(items[1].children!.map((item) => [item.kind, item.label, item.mark])).toEqual([['law', 'General Allotment Act (1887)', 'new']]);
		expect(cases.children![0].link).toMatch(/^#box-\d+$/);
	});

	it('shows the source key until the library loads, and no dots without a published version', () => {
		const doc = parseEssay(draft);
		const items = editorOutline(doc, { marks: new Map(), inReview: new Set(), citations: null });
		expect(items[0].mark).toBeUndefined();
		expect(items[0].children![0].children![1].label).toBe('worcester-v-georgia');
	});
});

describe('shortCitation', () => {
	it('keeps the name and the year', () => {
		expect(shortCitation('Lone Wolf v. Hitchcock, 187 U.S. 553 (1903).')).toBe('Lone Wolf v. Hitchcock (1903)');
		expect(shortCitation('Ex parte Crow Dog, 109 U.S. 556 (1883). www.law.cornell.edu')).toBe('Ex parte Crow Dog (1883)');
		expect(shortCitation('Indian Civil Rights Act of 1968, 25 U.S.C. §§ 1301–1304.')).toBe('Indian Civil Rights Act of 1968');
	});
});
