import { describe, expect, it } from 'vitest';
import { citationParts, shortCitation } from '../src/lib/legal-citations.ts';

describe('citationParts', () => {
	it('links a part of the Code of Federal Regulations to the eCFR', () => {
		expect(citationParts('25 C.F.R. Part 83')).toEqual([
			{ text: '25 C.F.R. Part 83', link: 'https://www.ecfr.gov/current/title-25/part-83' }
		]);
	});

	it('links every citation in a longer legal basis and keeps the words between', () => {
		const parts = citationParts('25 C.F.R. Part 83; final determination 50 FR 39047 (1985)');
		expect(parts.map((part) => part.text).join('')).toBe('25 C.F.R. Part 83; final determination 50 FR 39047 (1985)');
		expect(parts.filter((part) => part.link).map((part) => part.link)).toEqual([
			'https://www.ecfr.gov/current/title-25/part-83',
			'https://www.govinfo.gov/link/fr/50/39047?link-type=pdf'
		]);
	});

	it('links United States Code sections and Statutes at Large pages', () => {
		const parts = citationParts('Pub. L. No. 103-454, § 104, 108 Stat. 4791 (25 U.S.C. § 5131)');
		expect(parts.filter((part) => part.link).map((part) => part.text)).toEqual(['108 Stat. 4791', '25 U.S.C. § 5131']);
	});

	it('does not link a Statutes at Large volume older than GovInfo holds', () => {
		expect(citationParts('48 Stat. 984')).toEqual([{ text: '48 Stat. 984' }]);
	});

	it("does not treat a territory's own public law as federal law", () => {
		const parts = citationParts('enacted by Guam P.L. 112-26');
		expect(parts.every((part) => !part.link)).toBe(true);
	});

	it('links the whole legal basis to the fallback when nothing in it can be linked', () => {
		expect(citationParts('Massachusetts Executive Order No. 637 (2024)', 'https://example.org/order')).toEqual([
			{ text: 'Massachusetts Executive Order No. 637 (2024)', link: 'https://example.org/order' }
		]);
	});
});

describe('shortCitation', () => {
	it('gives the first linkable citation', () => {
		expect(shortCitation('25 C.F.R. Part 83; final determination 70 FR 60099')?.text).toBe('25 C.F.R. Part 83');
	});

	it('names an older Public Law and links it to its Statutes at Large page', () => {
		expect(shortCitation('Federally Recognized Indian Tribe List Act of 1994, Pub. L. No. 103-454, § 104, 108 Stat. 4791')).toEqual({
			text: 'Pub. L. No. 103-454',
			link: 'https://www.govinfo.gov/link/statute/108/4791?link-type=pdf'
		});
	});

	it('uses short opening words, and leaves out long ones', () => {
		expect(shortCitation('Massachusetts Executive Order No. 637 (2024)', 'x')).toEqual({ text: 'Massachusetts Executive Order No. 637', link: 'x' });
		expect(shortCitation('Listed by the Secretary of the Commonwealth among the 11 Virginia Indian tribes the Commonwealth recognizes')).toBeUndefined();
	});
});
