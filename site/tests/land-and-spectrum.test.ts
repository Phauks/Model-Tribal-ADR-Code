import { describe, expect, it } from 'vitest';
import { landLines, locationsByNation, roundYears } from '../src/lib/server/land-buy-back.ts';
import { licenseNote, licensesByNation, longDate } from '../src/lib/server/tribal-spectrum.ts';

// Land Buy-Back and 2.5 GHz spectrum facts in Key facts (Trevor, Nov. 27, 2026).
describe('Land Buy-Back Program locations', () => {
	it('has the 53 locations, Wind River on both of its nations’ pages', () => {
		const byNation = locationsByNation();
		const rows = new Set([...byNation.values()].flat());
		expect(rows.size).toBe(53);
		const windRiver = byNation.get('northern-arapaho-tribe-of-the-wind-river-reservation')!;
		expect(windRiver).toEqual(byNation.get('eastern-shoshone-tribe-of-the-wind-river-reservation'));
	});

	it('shows the Blackfeet figures as the final report gives them', () => {
		const [row] = locationsByNation().get('blackfeet-tribe-of-the-blackfeet-indian-reservation-of-montana')!;
		expect(landLines(row).map((line) => [line.label, line.text])).toEqual([
			[undefined, '490,808 equivalent acres restored to tribal trust'],
			['Fractional interests bought', '196,519'],
			['Paid to landowners', '$246,303,289']
		]);
		expect(landLines(row)[0].note).toBe('Offers made in 2017, 2020 and 2021; the Program ended in November 2022.');
	});

	it('keeps Colville’s own figures, not those the final report prints beside its name', () => {
		const [row] = locationsByNation().get('confederated-tribes-of-the-colville-reservation')!;
		// Interior offered Colville landowners about $25 million in all (Dec. 12, 2016).
		expect(Number(row.paid_dollars)).toBeLessThan(Number(row.offered_dollars));
		expect(row.paid_dollars).toBe('9839343');
	});

	it('never pays more than was offered', () => {
		for (const row of new Set([...locationsByNation().values()].flat())) {
			if (row.paid_dollars) expect(Number(row.paid_dollars)).toBeLessThanOrEqual(Number(row.offered_dollars));
		}
	});

	it('says the years of the rounds of offers', () => {
		expect(roundYears('2016-2017; 2021')).toBe('2016–2017 and 2021');
		expect(roundYears('2014; 2019; 2022')).toBe('2014, 2019 and 2022');
		expect(roundYears('')).toBe('');
	});
});

describe('2.5 GHz spectrum licenses', () => {
	it('shows only active licenses held by a nation or its own body', () => {
		const all = [...licensesByNation().values()].flat();
		expect(all.every((row) => row.status === 'active' && row.nation)).toBe(true);
		expect(all.some((row) => /T-Mobile|Hawaiian Home Lands/.test(row.licensee))).toBe(false);
	});

	it('names the holder when it is the nation’s company', () => {
		const [hopi] = licensesByNation().get('hopi-tribe-of-arizona')!;
		expect(licenseNote(hopi)).toMatch(/Held by Hopi Telecommunications, Inc\.$/);
	});

	it('writes dates in the site’s style', () => {
		expect(longDate('2021-05-24')).toBe('May 24, 2021');
		expect(longDate('2031-09-03')).toBe('Sept. 3, 2031');
	});
});
