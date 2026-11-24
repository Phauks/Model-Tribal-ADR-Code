import { describe, expect, it } from 'vitest';
import { bibtexEntry, bibtexValue, risEntry, type CitationItem } from '#lib/citation-formats.ts';
import { addressParts, foldLine, nationVcards, vcardText } from '#lib/vcard.ts';

const register: CitationItem = {
	id: 'bia-recognized-entities-2026',
	type: 'legislation',
	title: 'Indian Entities Recognized by and Eligible To Receive Services From the United States Bureau of Indian Affairs',
	author: [{ literal: 'U.S. Department of the Interior, Bureau of Indian Affairs' }],
	'container-title': 'Federal Register',
	'container-title-short': 'Fed. Reg.',
	volume: '91',
	page: '4102-4106',
	issued: { 'date-parts': [[2026, 1, 30]] },
	URL: 'https://www.govinfo.gov/content/pkg/FR-2026-01-30/pdf/2026-01899.pdf',
	accessed: { 'date-parts': [[2026, 11, 23]] }
};

describe('sources as RIS and BibTeX', () => {
	it('writes a RIS record with its type, pages, dates and end tag', () => {
		const ris = risEntry(register);
		expect(ris.startsWith('TY  - STAT\r\n')).toBe(true);
		expect(ris).toContain('AU  - U.S. Department of the Interior, Bureau of Indian Affairs\r\n');
		expect(ris).toContain('SP  - 4102\r\nEP  - 4106\r\n');
		expect(ris).toContain('PY  - 2026\r\nDA  - 2026/01/30/\r\n');
		expect(ris).toContain('Y2  - 2026/11/23/\r\n');
		expect(ris.endsWith('ER  - \r\n')).toBe(true);
	});

	it('writes a BibTeX entry that keeps an organization whole and escapes special characters', () => {
		const bib = bibtexEntry(register);
		expect(bib.startsWith('@misc{bia-recognized-entities-2026,\n')).toBe(true);
		expect(bib).toContain('author = {{U.S. Department of the Interior, Bureau of Indian Affairs}}');
		expect(bib).toContain('pages = {4102--4106}');
		expect(bib).toContain('month = jan');
		expect(bib).toContain('urldate = {2026-11-23}');
		expect(bib).toContain('url = {https://www.govinfo.gov/content/pkg/FR-2026-01-30/pdf/2026-01899.pdf}');
		expect(bibtexValue('A & B_1 {x} 50%')).toBe('A \\& B\\_1 \\{x\\} 50\\%');
	});
});

describe('office contacts as vCards', () => {
	it('splits an address and escapes text', () => {
		expect(addressParts('100 Parkway, Window Rock, AZ 86515')).toEqual({ street: '100 Parkway', town: 'Window Rock', region: 'AZ', code: '86515' });
		expect(addressParts('Somewhere odd')).toEqual({ street: 'Somewhere odd', town: '', region: '', code: '' });
		expect(vcardText('a,b;c\\d')).toBe('a\\,b\\;c\\\\d');
	});

	it('folds long lines and writes one card per office', () => {
		const long = `NOTE:${'x'.repeat(100)}`;
		expect(foldLine(long).split('\r\n ').map((part) => part.length)).toEqual([75, 30]);
		const text = nationVcards(
			'Navajo Nation',
			{
				websites: [{ kind: 'website', label: 'Website', lines: ['navajo-nsn.gov'], link: 'https://www.navajo-nsn.gov/' }],
				offices: [
					{
						name: 'Tribal Government Office',
						rows: [
							{ kind: 'mailing-address', label: 'Mailing address', lines: ['P.O. Box 7440', 'Window Rock, AZ 86515'] },
							{ kind: 'phone', label: 'Phone', lines: ['(928) 871-7000'] }
						]
					}
				]
			},
			'/nations/navajo-nation'
		);
		expect(text).toContain('BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Navajo Nation\\, Tribal Government Office\r\n');
		expect(text).toContain('ADR;TYPE=WORK,POSTAL:;;P.O. Box 7440;Window Rock;AZ;86515;USA\r\n');
		expect(text).toContain('TEL;TYPE=WORK,VOICE:(928) 871-7000\r\n');
		expect(text).toContain('URL:https://www.navajo-nsn.gov/\r\n');
		expect(text.match(/BEGIN:VCARD/g)).toHaveLength(1);
	});
});
