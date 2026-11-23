import { describe, expect, it } from 'vitest';
import { caseItem, courtAbbreviation } from '#lib/server/case-citations.ts';
import { caseFacts, courtDays, lawFacts } from '#lib/server/case-facts.ts';
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

	it('gives each court date its own line, in the order they happened', () => {
		const merrion = caseFacts(sources().get('merrion-v-jicarilla-apache-tribe') as never, nations).slice(0, 3);
		expect(merrion).toEqual([
			['Argued', 'March 30, 1981'],
			['Reargued', 'November 4, 1981'],
			['Decided', 'January 25, 1982']
		]);
		const wabol = caseFacts(sources().get('wabol-v-villacrusis-1990') as never, nations).slice(0, 3);
		expect(wabol.map(([label]) => label)).toEqual(['Argued and submitted', 'Decided', 'Amended']);
		expect(caseFacts(sources().get('johnson-v-mintosh') as never, nations)[0]).toEqual(['Argued', 'February 17–19, 1823']);
	});

	it('writes several days as one date', () => {
		expect(courtDays(['1901-01-11', '1901-01-08', '1901-01-09', '1901-01-10'])).toBe('January 8–11, 1901');
		expect(courtDays(['1823-02-15', '1823-02-17'])).toBe('February 15 and 17, 1823');
		expect(courtDays(['1831-12-30', '1832-01-02'])).toBe('December 30, 1831, and January 2, 1832');
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
