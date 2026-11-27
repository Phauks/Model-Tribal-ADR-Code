import { describe, expect, it } from 'vitest';
import { citePage, citeRecord, isCitationStyle, type CitedPage, type CitedRecord } from '../src/lib/citation-styles.ts';

const visited = new Date(2026, 10, 27);
const casePage: CitedPage = {
	title: 'Worcester v. Georgia',
	titleIsCaseName: true,
	siteName: 'Tribal Law Project',
	contentVersion: '0.3.0',
	address: 'https://triballawproject.org/cases/worcester-v-georgia',
	visited
};
const nationPage: CitedPage = { ...casePage, title: 'Karuk Tribe', titleIsCaseName: false, address: 'https://triballawproject.org/nations/karuk-tribe' };

const worcester: CitedRecord = {
	kind: 'case',
	name: 'Worcester v. Georgia',
	citation: '31 U.S. 515 (1832)',
	reference: { authority: 'Supreme Court of the United States', 'container-title': 'U.S.', volume: '31', page: '515', issued: { 'date-parts': [[1832, 3, 3]] } }
};

describe('citePage', () => {
	it('keeps the Indigo Book form, with the version and the day last visited', () => {
		expect(citePage('indigo', nationPage).text).toBe(
			'Karuk Tribe, Tribal Law Project (draft content ver. 0.3.0), https://triballawproject.org/nations/karuk-tribe (last visited Nov. 27, 2026).'
		);
	});

	it('writes a Chicago bibliography entry with the site as author and the day accessed', () => {
		const citation = citePage('chicago', casePage);
		expect(citation.text).toBe('Tribal Law Project. “Worcester v. Georgia.” Accessed November 27, 2026. https://triballawproject.org/cases/worcester-v-georgia.');
		expect(citation.html).toContain('“<i>Worcester v. Georgia</i>.”');
	});

	it('writes an APA reference with n.d. and a retrieval date, the title in italics', () => {
		const citation = citePage('apa', nationPage);
		expect(citation.text).toBe('Tribal Law Project. (n.d.). Karuk Tribe. Retrieved November 27, 2026, from https://triballawproject.org/nations/karuk-tribe');
		expect(citation.html).toContain('<i>Karuk Tribe</i>.');
	});

	it('sets a case name inside an APA title in roman, the reverse of the title', () => {
		expect(citePage('apa', casePage).html).toBe(
			'Tribal Law Project. (n.d.). Worcester v. Georgia. Retrieved November 27, 2026, from https://triballawproject.org/cases/worcester-v-georgia'
		);
	});

	it('dates an essay by its publication, with no retrieval date in APA', () => {
		const essay = { ...nationPage, title: 'Peacemaking', address: 'https://triballawproject.org/essays/peacemaking', published: new Date(2026, 10, 20) };
		expect(citePage('apa', essay).text).toBe('Tribal Law Project. (2026, November 20). Peacemaking. https://triballawproject.org/essays/peacemaking');
		expect(citePage('chicago', essay).text).toContain('“Peacemaking.” Published November 20, 2026.');
		expect(citePage('mla', essay).text).toContain('Tribal Law Project, 20 Nov. 2026, triballawproject.org/essays/peacemaking.');
	});

	it('writes an MLA entry with the site in italics, the address without https, and the day accessed', () => {
		const citation = citePage('mla', casePage);
		expect(citation.text).toBe('“Worcester v. Georgia.” Tribal Law Project, triballawproject.org/cases/worcester-v-georgia. Accessed 27 Nov. 2026.');
		expect(citation.html).toBe('“<i>Worcester v. Georgia</i>.” <i>Tribal Law Project</i>, triballawproject.org/cases/worcester-v-georgia. Accessed 27 Nov. 2026.');
	});

	it('escapes the title in the HTML form', () => {
		expect(citePage('mla', { ...nationPage, title: 'A & B <c>' }).html).toContain('A &amp; B &lt;c&gt;');
	});
});

describe('citeRecord', () => {
	it('cites a case in the legal form in the Indigo Book, Chicago and APA', () => {
		for (const style of ['indigo', 'chicago', 'apa'] as const) {
			expect(citeRecord(style, worcester).html).toBe('<i>Worcester v. Georgia</i>, 31 U.S. 515 (1832).');
		}
	});

	it('cites a Supreme Court case in MLA with the court as author and the reporter as container', () => {
		expect(citeRecord('mla', worcester).text).toBe('United States, Supreme Court. Worcester v. Georgia. United States Reports, vol. 31, 3 Mar. 1832, p. 515.');
	});

	it('falls back to MLA’s short form for a reporter it does not know', () => {
		const tribal: CitedRecord = { kind: 'case', name: 'Means v. District Court', citation: '2 Am. Tribal Law 439 (1999)', reference: { authority: 'Navajo Nation Supreme Court', 'container-title': 'Am. Tribal Law', volume: '2', page: '439', issued: { 'date-parts': [[1999]] } } };
		expect(citeRecord('mla', tribal).text).toBe('Means v. District Court. 2 Am. Tribal Law 439. 1999.');
	});

	it('cites a treaty and a statute from the Statutes at Large in MLA, the names in roman', () => {
		const treaty: CitedRecord = { kind: 'law', name: 'Treaty with the Cheyenne and Arapaho (1867)', citation: 'Treaty with the Cheyenne and Arapaho, Oct. 28, 1867, 15 Stat. 593', lawKind: 'intergovernmental-agreement' };
		expect(citeRecord('mla', treaty).html).toBe('Treaty with the Cheyenne and Arapaho. <i>United States Statutes at Large</i>, vol. 15, 1867, p. 593.');
		expect(citeRecord('indigo', treaty).text).toBe('Treaty with the Cheyenne and Arapaho, Oct. 28, 1867, 15 Stat. 593.');
		const statute: CitedRecord = { kind: 'law', name: 'Indian Reorganization Act', citation: 'Indian Reorganization Act, Pub. L. No. 73-383, 48 Stat. 984 (1934)', lawKind: 'federal-statute' };
		expect(citeRecord('mla', statute).text).toBe('United States, Congress. Indian Reorganization Act. United States Statutes at Large, vol. 48, 1934, p. 984.');
	});

	it('gives a law with no Statutes at Large citation in MLA’s short form', () => {
		const order: CitedRecord = { kind: 'law', name: 'Executive Order 13175', citation: 'Exec. Order No. 13,175, 65 Fed. Reg. 67,249 (Nov. 6, 2000)', lawKind: 'executive-order' };
		expect(citeRecord('mla', order).text).toBe('Executive Order 13175. Exec. Order No. 13,175, 65 Fed. Reg. 67,249 (Nov. 6, 2000).');
	});
});

describe('isCitationStyle', () => {
	it('accepts only the four styles, so a stale stored choice falls back to the default', () => {
		expect(isCitationStyle('mla')).toBe(true);
		expect(isCitationStyle('harvard')).toBe(false);
		expect(isCitationStyle(null)).toBe(false);
	});
});
