import { describe, expect, it } from 'vitest';
import { firstPage, opinionAt, quoteOpinionLabel, type OpinionEntry } from '#lib/case-opinions.ts';
import { renderEssay, type EssayLibrary } from '#lib/essays/render.ts';

// Worcester v. Georgia, 31 U.S. 515 (1832), as the official report prints it.
const worcester: OpinionEntry[] = [
	{ kind: 'concurrence', justice: 'John McLean', page: 563 },
	{ kind: 'majority', justice: 'John Marshall', page: 536 },
	{ kind: 'dissent', justice: 'Henry Baldwin', page: 596 }
];

const library: EssayLibrary = {
	citation: (key) => ({ 'worcester-v-georgia': '<i>Worcester v. Georgia</i>, 31 U.S. 515 (1832).' })[key],
	term: () => undefined,
	caseNames: () => ({ 'worcester-v-georgia': 'Worcester v. Georgia' }),
	caseLink: (key) => `/cases/${key}`,
	opinions: (key) => (key === 'worcester-v-georgia' ? worcester : undefined)
};

describe('which opinion a page of a case falls in', () => {
	it('is the last opinion that starts on or before the page', () => {
		expect(opinionAt(worcester, 559)?.justice).toBe('John Marshall');
		expect(opinionAt(worcester, 563)?.justice).toBe('John McLean');
		expect(opinionAt(worcester, 597)?.kind).toBe('dissent');
	});

	it('is none before the first opinion or without a page', () => {
		expect(opinionAt(worcester, 520)).toBeUndefined();
		expect(opinionAt(worcester, undefined)).toBeUndefined();
		expect(opinionAt(undefined, 559)).toBeUndefined();
	});

	it('reads the first page of a pinpoint', () => {
		expect(firstPage('p. 559')).toBe(559);
		expect(firstPage('pp. 536-538')).toBe(536);
		expect(firstPage(null)).toBeUndefined();
	});

	it('names the opinion and its writer', () => {
		expect(quoteOpinionLabel(worcester[1])).toBe('Opinion of the Court (Marshall)');
		expect(quoteOpinionLabel(worcester[0])).toBe('Concurring opinion (McLean)');
		expect(quoteOpinionLabel(worcester[2])).toBe('Dissenting opinion (Baldwin)');
	});
});

describe('a case in an essay', () => {
	const html = renderEssay(
		[
			'*Worcester v. Georgia* is the case.',
			'',
			':::: case worcester-v-georgia',
			'::: quotes',
			'> The Cherokee nation, then, is a distinct community ...',
			'',
			'[@worcester-v-georgia, p. 561]',
			':::',
			'::::'
		].join('\n'),
		library
	).html;

	it('links the case name in the text to the case page', () => {
		expect(html).toContain('<a href="/cases/worcester-v-georgia" class="case-link" data-case="worcester-v-georgia"><em>Worcester v. Georgia</em></a> is the case.');
	});

	it('links the name at the head of the case box to the case page', () => {
		expect(html).toContain('<a class="case-page-link" href="/cases/worcester-v-georgia"><i>Worcester v. Georgia</i></a>, 31 U.S. 515 (1832).');
	});

	it('names the opinion a quotation comes from', () => {
		expect(html).toMatch(/<p class="essay-attribution"[^>]*><span class="essay-quote-opinion">Opinion of the Court \(Marshall\)<\/span>/);
	});
});
