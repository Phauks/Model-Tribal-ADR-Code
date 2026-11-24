import { describe, expect, it } from 'vitest';
import {
	addressLines,
	contactCards,
	defaultOfficeName,
	defaultOfficeFor,
	otherContactsName,
	displayWebAddress,
	officeAndNote,
	titleCase
} from '#lib/contact-card.ts';

const label = 'Tribal government office';

describe('contact card', () => {
	it('links the nation\'s own contact page in the office card, after the email', () => {
		const { websites, offices } = contactCards([
			{ kind: 'contact-page', value: 'https://bigpinepaiute.org/contact-us/', label },
			{ kind: 'email-general', value: 'info@bigpinepaiute.org', label },
			{ kind: 'website', value: 'https://bigpinepaiute.org/', label }
		]);
		expect(websites).toHaveLength(1);
		expect(offices[0].rows.map((row) => row.label)).toEqual(['Email', 'Contact page']);
		expect(offices[0].rows[1]).toMatchObject({
			kind: 'contact-page',
			lines: ['bigpinepaiute.org/contact-us'],
			link: 'https://bigpinepaiute.org/contact-us/',
			external: true,
			linkHint: 'opens in a new tab'
		});
	});

	it('keeps the website apart and names the office once', () => {
		const { websites, offices } = contactCards([
			{ kind: 'fax', value: '(928) 871-4025', label },
			{ kind: 'phone', value: '(928) 871-7000', label },
			{ kind: 'mailing-address', value: 'P.O. Box 7440, Window Rock, AZ 86515', label },
			{ kind: 'physical-address', value: '100 Parkway, Window Rock, AZ 86515', label },
			{ kind: 'website', value: 'https://www.navajo-nsn.gov/', label }
		]);
		expect(websites).toHaveLength(1);
		expect(websites[0]).toMatchObject({ lines: ['navajo-nsn.gov'], external: true });
		expect(offices).toHaveLength(1);
		expect(offices[0].name).toBe('Tribal Government Office');
		expect(offices[0].rows.map((row) => row.label)).toEqual([
			'Physical address',
			'Mailing address',
			'Phone',
			'Fax'
		]);
		const [physical, mailing, phone, fax] = offices[0].rows;
		expect(physical.lines).toEqual(['100 Parkway', 'Window Rock, AZ 86515']);
		expect(physical.link).toContain('google.com/maps/search');
		expect(physical).toMatchObject({
			external: true,
			linkHint: 'opens in Google Maps in a new tab'
		});
		expect(mailing.link).toBeUndefined();
		expect(phone.link).toBe('tel:+1-928-871-7000');
		expect(fax.link).toBeUndefined();
	});

	it('writes out a mailing address that repeats the physical address', () => {
		const { offices } = contactCards([
			{ kind: 'physical-address', value: '50 Tu Su Lane, Bishop, CA 93514', label },
			{ kind: 'mailing-address', value: '50 Tu Su Lane, Bishop, CA 93514', label }
		]);
		expect(offices[0].rows[1].lines).toEqual(['50 Tu Su Lane', 'Bishop, CA 93514']);
	});

	it('folds a directory address that leads to the official site into a note', () => {
		const { websites } = contactCards([
			{ kind: 'website', value: 'https://www.bishoppaiutetribe.com/', label },
			{
				kind: 'website',
				value: 'https://bishoppaiute.net/',
				label:
					'Official website (the directory address https://www.bishoppaiutetribe.com/ redirects here)'
			}
		]);
		expect(websites).toHaveLength(1);
		expect(websites[0].lines).toEqual(['bishoppaiute.net']);
		expect(websites[0].note).toContain('bishoppaiutetribe.com');
	});

	it('names the office of a website that is not the nation’s own', () => {
		const { websites, offices } = contactCards([
			{
				kind: 'website',
				value: 'https://www.oha.org/',
				label: 'Office of Hawaiian Affairs (state agency)'
			},
			{
				kind: 'phone',
				value: '(808) 594-1835',
				label: 'Office of Hawaiian Affairs (state agency), contact number'
			}
		]);
		expect(websites[0].note).toBe('Office of Hawaiian Affairs (state agency)');
		expect(offices.map((office) => office.name)).toEqual([
			'Office of Hawaiian Affairs (state agency)'
		]);
	});

	it('puts a contact page with no office in its label under the office whose website it is on', () => {
		const { offices } = contactCards(
			[
				{
					kind: 'website',
					value: 'https://dhhl.hawaii.gov',
					label: 'Department of Hawaiian Home Lands (state agency)'
				},
				{
					kind: 'phone',
					value: '(808) 620-9500',
					label: 'Department of Hawaiian Home Lands (state agency) main line'
				},
				{
					kind: 'contact-page',
					value: 'https://dhhl.hawaii.gov/contact/',
					label: "Contact page on the nation's website"
				}
			],
			undefined,
			defaultOfficeFor('native-hawaiian')
		);
		expect(offices.map((office) => office.name)).toEqual([
			'Department of Hawaiian Home Lands (state agency)'
		]);
		expect(offices[0].rows.map((row) => row.kind)).toEqual(['phone', 'contact-page']);
	});

	it('never calls the contacts of a record that is not a tribe’s a tribal office', () => {
		expect(defaultOfficeFor('native-nation')).toBe(defaultOfficeName);
		expect(defaultOfficeFor('native-hawaiian')).toBe(otherContactsName);
		const { offices } = contactCards(
			[{ kind: 'phone', value: '(670) 664-2664' }],
			undefined,
			defaultOfficeFor('territorial-indigenous-people')
		);
		expect(offices[0].name).toBe('Other Contacts');
	});

	it('gives named offices and agencies their own cards', () => {
		expect(officeAndNote('Arctic Village council office: Tribal office main phone')).toEqual({
			office: 'Arctic Village Council Office',
			note: undefined
		});
		expect(
			officeAndNote('Office of Native Hawaiian Relations (federal), Honolulu street address')
		).toEqual({
			office: 'Office of Native Hawaiian Relations (federal)',
			note: 'Honolulu'
		});
		expect(officeAndNote('Tribal office email listed by the State of Alaska')).toEqual({
			office: defaultOfficeName,
			note: undefined
		});
		expect(officeAndNote('Tribal office alternate phone').note).toBe('Alternate number');
		expect(titleCase('Village of Venetie council office')).toBe(
			'Village of Venetie Council Office'
		);
	});

	it('never links a lapsed website', () => {
		const { websites } = contactCards([
			{ kind: 'website', value: 'https://old.example/', label, link_status: 'lapsed' }
		]);
		expect(websites[0].link).toBeUndefined();
		expect(websites[0].note).toContain('No longer');
	});

	it('formats addresses and web addresses', () => {
		expect(addressLines('100 Main Street Suite 7C, Sand Point, AK 99661')).toEqual([
			'100 Main Street Suite 7C',
			'Sand Point, AK 99661'
		]);
		expect(addressLines('Window Rock, AZ 86515')).toEqual(['Window Rock, AZ 86515']);
		expect(displayWebAddress('https://www.navajo-nsn.gov/')).toBe('navajo-nsn.gov');
	});
});
