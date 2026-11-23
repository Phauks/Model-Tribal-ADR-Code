import { describe, expect, it } from 'vitest';
import { caseItem, courtAbbreviation } from '#lib/server/case-citations.ts';
import { caseFacts, lawFacts } from '#lib/server/case-facts.ts';
import { everyBoxFact, everyFullCitation } from '#lib/server/essay-library.ts';
import { nationNamesAndKinds, sources } from '#lib/server/content.ts';

describe('case citations', () => {
	it('abbreviates courts and numbers dockets as the Indigo Book does', () => {
		expect(courtAbbreviation('United States Court of Appeals for the Ninth Circuit')).toBe('9th Cir.');
		expect(courtAbbreviation('U.S. Court of Appeals for the Federal Circuit')).toBe('Fed. Cir.');
		expect(courtAbbreviation('United States District Court for the District of Nevada')).toBe('D. Nev.');
		expect(courtAbbreviation('Supreme Court of the United States', { 'container-title': 'U.S.' })).toBe('');
		expect(courtAbbreviation('Supreme Court of the United States', { 'container-title': 'S. Ct.' })).toBe('Supreme Court of the United States');
		expect(caseItem({ type: 'legal_case', number: '2017-1620', authority: 'United States Court of Appeals for the Federal Circuit' })).toEqual({
			type: 'legal_case',
			number: 'No. 2017-1620',
			authority: 'Fed. Cir.'
		});
	});

	it('prints a case heading with the court abbreviated', () => {
		const records = [...sources().values()].filter((record) => (record.citation as { type?: string }).type === 'legal_case');
		const citations = everyFullCitation(records);
		const circuit = records.find((record) => /Circuit$/.test((record.citation as { authority?: string }).authority ?? ''));
		if (circuit) expect(citations[circuit.key]).toMatch(/\d+(st|d|th) Cir\.|Fed\. Cir\.|D\.C\. Cir\./);
	});
});

describe('case box facts', () => {
	const nations = nationNamesAndKinds();
	const worcester = sources().get('worcester-v-georgia')!;

	it('lists the date, nations and the Supreme Court bench with opinion writers first, in bold', () => {
		const facts = Object.fromEntries(caseFacts(worcester as never, nations));
		expect(facts.Decided).toMatch(/^March \d+, 1832$/);
		expect(facts.Court).toBe('<a href="/supreme-court/marshall-court">Marshall Court</a>');
		expect(facts.Vote).toBe('5–1');
		expect(facts.Majority).toMatch(/^<strong>Marshall<\/strong> \(opinion of the Court\), <strong>McLean<\/strong> \(concurring opinion\), /);
		expect(facts.Dissent).toBe('<strong>Baldwin</strong> (dissenting opinion)');
		expect(facts['Vote not recorded']).toBe('Johnson');
		expect(Object.keys(facts)[0]).toBe('Decided');
	});

	it('names peoples that are not nations as peoples', () => {
		const people = [...nations].find(([, nation]) => nation.entityType !== 'native-nation');
		if (!people) return;
		const [label] = lawFacts({ tribes: [people[0]] }, nations)[0];
		expect(label).toBe('People');
	});

	it('bundles facts for cases and laws', () => {
		const { cases, laws } = everyBoxFact();
		expect(cases['worcester-v-georgia']?.length).toBeGreaterThan(3);
		expect(Object.keys(laws).length).toBeGreaterThan(0);
	});
});
