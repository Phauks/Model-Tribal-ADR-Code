import { describe, expect, it } from 'vitest';
import { boxMarkdown, fillBoxes, laterCasesMarkdown, quoteAttribution, readingMarkdown, type RecordBox } from '#lib/essays/record-boxes.ts';
import { renderEssay, type EssayLibrary } from '#lib/essays/render.ts';
import { taggedCases } from '#lib/essays/case-topics.ts';

const worcester: RecordBox = {
	background: 'Georgia made it a crime for white persons to live within the Cherokee Nation without a state license [@worcester-v-georgia, pp. 536-538].',
	question: 'May Georgia apply its criminal laws to a missionary living in the Cherokee Nation under federal license?',
	holding: 'No.',
	quotes: [
		{ text: 'The Cherokee nation, then, is a distinct community ...', pinpoint: 'p. 561' },
		{ text: 'The treaties and laws of the United States contemplate ...', pinpoint: 'p. 595', parenthetical: 'McLean, J., concurring' }
	],
	treatment: 'First paragraph.\n\nSecond paragraph. [@williams-v-lee]',
	topics: ['Sovereignty', 'Civil jurisdiction']
};

const written = [
	':::: case worcester-v-georgia',
	'::: background',
	'Georgia made it a crime for white persons to live within the Cherokee Nation without a state license [@worcester-v-georgia, pp. 536-538].',
	':::',
	'',
	'::: question',
	'May Georgia apply its criminal laws to a missionary living in the Cherokee Nation under federal license?',
	':::',
	'',
	'::: holding',
	'No.',
	':::',
	'',
	'::: quotes',
	'> The Cherokee nation, then, is a distinct community ...',
	'',
	'[@worcester-v-georgia, p. 561]',
	'',
	'> The treaties and laws of the United States contemplate ...',
	'',
	'[@worcester-v-georgia, p. 595] (McLean, J., concurring)',
	':::',
	'',
	'::: treatment',
	'First paragraph.',
	'',
	'Second paragraph. [@williams-v-lee]',
	':::',
	'',
	'::: topics',
	'Sovereignty; Civil jurisdiction',
	':::',
	'::::'
].join('\n');

const library: EssayLibrary = {
	citation: (key) =>
		({
			'worcester-v-georgia': '<i>Worcester v. Georgia</i>, 31 U.S. 515 (1832).',
			'williams-v-lee': '<i>Williams v. Lee</i>, 358 U.S. 217 (1959).',
			'indian-removal-act-1830': 'Indian Removal Act, ch. 148, 4 Stat. 411 (1830).'
		})[key],
	term: () => undefined,
	box: (kind, key) =>
		boxMarkdown(kind, key, kind === 'case' && key === 'worcester-v-georgia' ? worcester : kind === 'law' && key === 'indian-removal-act-1830' ? { summary: 'Authorized removal [@indian-removal-act-1830, sec. 3].' } : undefined) || undefined
};

describe('a box kept on the record', () => {
	it('writes each quotation with its pinpoint and parenthetical', () => {
		expect(quoteAttribution('worcester-v-georgia', worcester.quotes![0])).toBe('[@worcester-v-georgia, p. 561]');
		expect(quoteAttribution('worcester-v-georgia', worcester.quotes![1])).toBe('[@worcester-v-georgia, p. 595] (McLean, J., concurring)');
		expect(quoteAttribution('a-case', { text: 'Words.' })).toBe('[@a-case]');
	});

	it('is written in the essay syntax, its parts in their order', () => {
		expect(`:::: case worcester-v-georgia\n${boxMarkdown('case', 'worcester-v-georgia', worcester)}\n::::`).toBe(written);
		expect(boxMarkdown('law', 'a-law', { summary: 'What it does.', topics: ['Ignored'] })).toBe('::: summary\nWhat it does.\n:::');
		expect(boxMarkdown('case', 'nothing', undefined)).toBe('');
	});

	it('fills an empty box in an essay and says which line each filled line came from', () => {
		const essay = 'Before.\n\n:::: case worcester-v-georgia\n::::\n\nAfter.';
		const { text, origin } = fillBoxes(essay, (kind, key) => library.box!(kind, key));
		expect(text).toBe(`Before.\n\n${written}\n\nAfter.`);
		expect(text.split('\n')).toHaveLength(origin.length);
		expect(origin.slice(0, 3)).toEqual([0, 1, 2]);
		expect(origin[3]).toBe(2);
		expect(origin.at(-1)).toBe(5);
	});

	it('places the record\'s reading right after the box, as the Analysis block the essay used to hold', () => {
		const reading: RecordBox = { ...worcester, reading: { title: '*Worcester v. Georgia* (1832)', text: 'The core statement of inherent Native sovereignty.' } };
		const analysis = '::: analysis *Worcester v. Georgia* (1832)\nThe core statement of inherent Native sovereignty.\n:::';
		expect(readingMarkdown(reading)).toBe(analysis);
		expect(readingMarkdown(worcester)).toBe('');
		expect(boxMarkdown('case', 'worcester-v-georgia', reading)).toBe(boxMarkdown('case', 'worcester-v-georgia', worcester));
		const withReading: EssayLibrary = {
			...library,
			box: (kind, key) => boxMarkdown(kind, key, key === 'worcester-v-georgia' ? reading : undefined) || undefined,
			boxReading: (kind, key) => readingMarkdown(key === 'worcester-v-georgia' ? reading : undefined) || undefined
		};
		const essay = 'Before.\n\n:::: case worcester-v-georgia\n::::\n\nAfter.';
		const { text, origin } = fillBoxes(essay, withReading.box!, withReading.boxReading);
		expect(text).toBe(`Before.\n\n${written}\n\n${analysis}\n\nAfter.`);
		expect(text.split('\n')).toHaveLength(origin.length);
		expect(origin.at(-3)).toBe(3);
		expect(origin.at(-1)).toBe(5);
		const fromRecord = renderEssay(essay, withReading);
		const fromEssay = renderEssay(`Before.\n\n${written}\n\n${analysis}\n\nAfter.`, { ...library, box: undefined });
		expect(fromRecord.html).toBe(fromEssay.html);
	});

	it('leaves a box written out in the essay, and a box with no record, as they are', () => {
		const essay = `${written}\n\n:::: case no-record\n::::\n`;
		expect(fillBoxes(essay, (kind, key) => library.box!(kind, key)).text).toBe(essay);
	});

	it('renders the same as the box written out in the essay', () => {
		const place = 'Text.\n\n:::: case worcester-v-georgia\n::::\n\n:::: law indian-removal-act-1830\n::::\n';
		const full = `Text.\n\n${written}\n\n:::: law indian-removal-act-1830\n::: summary\nAuthorized removal [@indian-removal-act-1830, sec. 3].\n:::\n::::\n`;
		const fromRecord = renderEssay(place, library);
		const fromEssay = renderEssay(full, { ...library, box: undefined });
		expect(fromRecord.html).toBe(fromEssay.html);
		expect(fromRecord.sources).toEqual(fromEssay.sources);
		expect(fromRecord.html).toContain('<p class="essay-block-label">Holding</p>');
		expect(fromRecord.html).toContain('What it does');
	});

	it('marks a changed box as a draft change when its place in the essay changed', () => {
		const place = 'Text.\n\n:::: case worcester-v-georgia\n::::\n';
		const rendered = renderEssay(place, library, { lines: ['same', 'same', 'added', 'added'] });
		expect(rendered.html).toMatch(/essay-draft-added[^>]*>\n<section class="essay-case"/);
		expect(rendered.html).not.toContain('essay-draft-changed');
	});

	it('gives the index of cases by topic the record\'s topics', () => {
		const filled = fillBoxes(':::: case worcester-v-georgia\n::::\n', (kind, key) => library.box!(kind, key)).text;
		expect(taggedCases(filled)).toEqual([{ key: 'worcester-v-georgia', topics: ['Sovereignty', 'Civil jurisdiction'] }]);
	});
});

describe('the later cases under Treatment', () => {
	const box: RecordBox = {
		treatment: 'Quoted throughout modern decisions.',
		later_cases: {
			checked: '2026-11-20',
			source: 'westlaw/example.pdf',
			list: [
				{ treatment: 'Distinguished', name: 'United States v. Texas', citation: '143 U.S. 621 (1892)', link: 'https://case.law/caselaw/?reporter=us&volume=143&case=0621-01' },
				{ treatment: 'Declined to extend', name: 'Unnamed Mother v. United States', citation: '2025 WL 2390227 (D.N.M. Aug. 18, 2025)' },
				{ treatment: 'Distinguished', name: 'Nevada v. Hicks', citation: '533 U.S. 353 (2001)', case: 'nevada-v-hicks' },
				{ treatment: 'Superseded by statute', name: 'United States v. Hebert', citation: '___ F.4th ___ (10th Cir. Oct. 14, 2026)' }
			]
		}
	};

	it('lists each kind of treatment, most serious first, with its count, after the words', () => {
		const markdown = laterCasesMarkdown(box);
		expect(markdown.indexOf('**Superseded by statute** (1)')).toBeLessThan(markdown.indexOf('**Declined to extend** (1)'));
		expect(markdown.indexOf('**Declined to extend** (1)')).toBeLessThan(markdown.indexOf('**Distinguished** (2)'));
		expect(markdown).toContain('- *Unnamed Mother v. United States*, 2025 WL 2390227 (D.N.M. Aug. 18, 2025)');
		expect(markdown).toContain('- [*Nevada v. Hicks*, 533 U.S. 353 (2001)](/cases/nevada-v-hicks)');
		expect(markdown).toContain('\\_\\_\\_ F.4th \\_\\_\\_');
		expect(boxMarkdown('case', 'x', box)).toMatch(/^::: treatment\nQuoted throughout modern decisions\.\n\n\*\*Superseded by statute\*\*/);
	});

	it('leaves the links out when asked, and is empty without a list', () => {
		expect(laterCasesMarkdown(box, { links: false })).not.toContain('](');
		expect(laterCasesMarkdown({ treatment: 'Words.' })).toBe('');
	});

	it('shows each count in a badge and marks a case.law link as leaving the site', () => {
		const html = renderEssay(laterCasesMarkdown(box), library).html;
		expect(html).toContain('<p class="later-cases-kind"><strong>Distinguished</strong> <span class="count-badge"><span class="visually-hidden">,</span>2</span></p>\n<ul class="later-cases">');
		expect(html).toContain('<a href="https://case.law/caselaw/?reporter=us&amp;volume=143&amp;case=0621-01" class="external" target="_blank" rel="noopener" title="Opens on case.law"><em>United States v. Texas</em>, 143 U.S. 621 (1892)</a>');
		expect(html).toContain('<a href="/cases/nevada-v-hicks"><em>Nevada v. Hicks</em>, 533 U.S. 353 (2001)</a>');
		expect(html).toContain('___ F.4th ___');
	});

	it('links a case by its matched citation only, never by a name another case shares', () => {
		const named: EssayLibrary = { ...library, caseNames: () => ({ 'state-v-mathews-1997': 'State v. Mathews' }), caseLink: (key) => `/cases/${key}` };
		const list: RecordBox = { later_cases: { checked: '2026-11-20', source: 'westlaw/example.pdf', list: [{ treatment: 'Abrogation recognized', name: 'State v. Mathews', citation: '986 P.2d 323 (Idaho 1999)' }] } };
		expect(renderEssay(laterCasesMarkdown(list), named).html).toContain('<li><em>State v. Mathews</em>, 986 P.2d 323 (Idaho 1999)</li>');
		expect(renderEssay('*State v. Mathews* held otherwise.', named).html).toContain('href="/cases/state-v-mathews-1997"');
	});
});
