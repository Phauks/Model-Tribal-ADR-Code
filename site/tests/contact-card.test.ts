import { describe, expect, it } from 'vitest';
import {
	addressLines,
	contactOffices,
	displayWebAddress,
	officeAndNote
} from '#lib/contact-card.ts';

const office = 'Tribal government office';

describe('contact card', () => {
	it('names the office once and orders the rows', () => {
		const offices = contactOffices([
			{ kind: 'fax', value: '(928) 871-4025', label: office },
			{ kind: 'phone', value: '(928) 871-7000', label: office },
			{
				kind: 'mailing-address',
				value: 'P.O. Box 7440, Window Rock, AZ 86515',
				label: office
			},
			{
				kind: 'physical-address',
				value: '100 Parkway, Window Rock, AZ 86515',
				label: office
			},
			{ kind: 'website', value: 'https://www.navajo-nsn.gov/', label: office }
		]);
		expect(offices).toHaveLength(1);
		expect(offices[0].name).toBe(office);
		expect(offices[0].rows.map((row) => row.label)).toEqual([
			'Website',
			'Physical address',
			'Mailing address',
			'Phone',
			'Fax'
		]);
		const [website, physical, mailing, phone, fax] = offices[0].rows;
		expect(website).toMatchObject({
			lines: ['navajo-nsn.gov'],
			external: true
		});
		expect(physical.lines).toEqual(['100 Parkway', 'Window Rock, AZ 86515']);
		expect(physical.mapLink).toContain('google.com/maps/search');
		expect(mailing.mapLink).toBeUndefined();
		expect(phone.link).toBe('tel:+1-928-871-7000');
		expect(fax.link).toBeUndefined();
	});

	it('says when the mailing address repeats the physical address', () => {
		const [card] = contactOffices([
			{
				kind: 'physical-address',
				value: '50 Tu Su Lane, Bishop, CA 93514',
				label: office
			},
			{
				kind: 'mailing-address',
				value: '50 Tu Su Lane, Bishop, CA 93514',
				label: office
			}
		]);
		expect(card.rows[1]).toMatchObject({
			lines: ['Same as physical address'],
			mapLink: undefined
		});
	});

	it('folds a directory address that leads to the official site into a note', () => {
		const [card] = contactOffices([
			{
				kind: 'website',
				value: 'https://www.bishoppaiutetribe.com/',
				label: office
			},
			{
				kind: 'website',
				value: 'https://bishoppaiute.net/',
				label:
					'Official website (the directory address https://www.bishoppaiutetribe.com/ redirects here)'
			}
		]);
		expect(card.rows).toHaveLength(1);
		expect(card.rows[0].lines).toEqual(['bishoppaiute.net']);
		expect(card.rows[0].note).toContain('bishoppaiutetribe.com');
	});

	it('gives named offices and agencies their own cards', () => {
		expect(officeAndNote('Arctic Village council office: Tribal office main phone')).toEqual({
			office: 'Arctic Village council office',
			note: undefined
		});
		expect(
			officeAndNote('Office of Native Hawaiian Relations (federal), Honolulu street address')
		).toEqual({
			office: 'Office of Native Hawaiian Relations (federal)',
			note: 'Honolulu'
		});
		expect(officeAndNote('Tribal office email listed by the State of Alaska')).toEqual({
			office,
			note: undefined
		});
		expect(officeAndNote('Tribal office alternate phone').note).toBe('Alternate number');
	});

	it('never links a lapsed website', () => {
		const [card] = contactOffices([
			{
				kind: 'website',
				value: 'https://old.example/',
				label: office,
				link_status: 'lapsed'
			}
		]);
		expect(card.rows[0].link).toBeUndefined();
		expect(card.rows[0].note).toContain('No longer');
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
