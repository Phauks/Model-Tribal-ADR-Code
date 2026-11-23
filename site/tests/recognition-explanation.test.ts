import { describe, expect, it } from 'vitest';
import { citationParts } from '../src/lib/legal-citations.ts';
import { explainStatus, howRecognized, linkDocumentName } from '../src/lib/recognition-explanation.ts';

const list = {
	type: 'federal',
	source: 'bia-recognized-entities-2026',
	legal_basis: 'Indian Entities Recognized by and Eligible To Receive Services From the United States Bureau of Indian Affairs, 91 Fed. Reg. 4102, 4104 (Jan. 30, 2026)'
};
const act = {
	type: 'federal',
	source: 'public-law-93-197',
	since: '1973-12-22',
	legal_basis: 'Menominee Restoration Act, Pub. L. No. 93-197, § 3(a), 87 Stat. 770, 770 (1973)'
};
const parts = (fact: { legal_basis?: string }) => citationParts(fact.legal_basis ?? '');

describe('howRecognized', () => {
	it('names how a federal status came about only when the legal basis says so', () => {
		expect(howRecognized(list)).toBe('On the federal list of recognized tribes');
		expect(howRecognized(act)).toBe('Act of Congress');
		expect(howRecognized({ type: 'federal', legal_basis: 'Final determination, 52 Fed. Reg. 4193 (Feb. 10, 1987)' })).toBe('Federal acknowledgment process');
		expect(howRecognized({ type: 'federal', legal_basis: 'Something else' })).toBeUndefined();
	});

	it('names a state law, executive order or resolution', () => {
		expect(howRecognized({ type: 'state', legal_basis: 'Massachusetts Executive Order No. 126 (1976)' })).toBe('Executive order');
		expect(howRecognized({ type: 'state', legal_basis: 'Virginia General Assembly joint resolution, 1983' })).toBe('Legislative resolution');
		expect(howRecognized({ type: 'state', legal_basis: 'Code of Alabama 1975, Section 41-9-708' })).toBe('State law');
		expect(howRecognized({ type: 'state', legal_basis: 'A letter' })).toBeUndefined();
	});
});

describe('explainStatus', () => {
	it('gives the list and the Act, with the date the Act took effect', () => {
		const explained = explainStatus('Federally recognized', [list, act], parts);
		expect(explained.lines.map((line) => line.how)).toEqual(['On the federal list of recognized tribes', 'Act of Congress']);
		expect(explained.lines[1].since).toBe('Dec. 22, 1973');
		expect(explained.gap).toBeUndefined();
	});

	it('says so when the record has only the list', () => {
		expect(explainStatus('Federally recognized', [list], parts).gap).toMatch(/has not yet found the document/);
	});

	it('shows a legal basis two facts share once', () => {
		expect(explainStatus('Federally recognized', [list, act, { ...act, petition_number: '7' }], parts).lines).toHaveLength(2);
	});
});

describe('linkDocumentName', () => {
	it('links the name of the document to the same place as its citation', () => {
		const linked = linkDocumentName(citationParts(list.legal_basis));
		expect(linked[0]).toEqual({
			text: 'Indian Entities Recognized by and Eligible To Receive Services From the United States Bureau of Indian Affairs',
			link: 'https://www.govinfo.gov/link/fr/91/4102?link-type=pdf'
		});
		expect(linked.map((part) => part.text).join('')).toBe(list.legal_basis);
	});

	it('leaves a basis with no linked citation as it is', () => {
		const parts = citationParts('Virginia General Assembly joint resolution, 1983');
		expect(linkDocumentName(parts)).toEqual(parts);
	});
});
