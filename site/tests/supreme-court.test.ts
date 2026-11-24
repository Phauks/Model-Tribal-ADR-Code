import { describe, expect, it } from 'vitest';
import { sources } from '#lib/server/content.ts';
import { courtPage, courtsWithPages } from '#lib/server/supreme-court-pages.ts';
import { associatesOf, courtPath, courts } from '#lib/server/supreme-courts.ts';

describe('Supreme Court pages', () => {
	it('names each Court for its Chief Justice, oldest first', () => {
		const names = courts().map((court) => court.name);
		expect(names[0]).toBe('Jay Court');
		expect(names).toContain('Marshall Court');
		expect(names.at(-1)).toBe('Roberts Court');
	});

	it('gives every Court that decided a case on the site a page', () => {
		for (const record of sources().values()) {
			const court = (record as { supreme_court?: { court: string } }).supreme_court?.court;
			if (court) expect(courtPath(court), `${record.key}: ${court}`).toMatch(/^\/supreme-court\/[a-z-]+$/);
		}
	});

	it('lists who sat on the Marshall Court and how its membership changed', () => {
		const marshall = courts().find((court) => court.key === 'marshall-court')!;
		expect(associatesOf(marshall)).toHaveLength(15);
		const page = courtPage('marshall-court')!;
		expect(page.bench[0]).toMatchObject({ name: 'John Marshall', role: 'Chief Justice', appointedBy: 'John Adams' });
		expect(page.facts.find((fact) => fact.label === 'Seats')?.text).toBe('6; 7 from Feb. 24, 1807');
		expect(page.changes.find((change) => change.date === '1807-05-04')?.events).toEqual(['Thomas Todd took a new seat (2 Stat. 420).']);
		expect(page.changes.at(-1)?.events).toEqual(['Chief Justice John Marshall died.']);
		expect(page.cases.map((item) => item.key)).toEqual(['johnson-v-mintosh', 'cherokee-nation-v-georgia', 'worcester-v-georgia']);
		expect(page.sources.map((source) => source.key)).toContain('supreme-court-historical-society-marshall-court');
	});

	it('names who held a seat before and how service ended', () => {
		const page = courtPage('marshall-court')!;
		const johnson = page.bench.find((justice) => justice.name === 'William Johnson')!;
		expect(johnson.seat).toBe('Alfred Moore');
		expect(johnson.ending).toBe('died');
	});

	it('keeps the present Court open-ended', () => {
		const roberts = courtPage('roberts-court')!;
		expect(roberts.endText).toBeUndefined();
		expect(roberts.facts.find((fact) => fact.label === 'Served')?.text).toBe('Since Sept. 29, 2005');
		expect(courtsWithPages().map((court) => court.key)).toContain('roberts-court');
	});
});

describe('opinions in the cases tables', () => {
	it('lists every opinion with its author and kind, and counts only written ones', () => {
		const roberts = courtPage('roberts-court')!;
		const brackeen = roberts.cases.find((item) => item.key === 'haaland-v-brackeen')!;
		// The report: Barrett for the Court; Gorsuch and Kavanaugh concurring; Thomas and Alito dissenting.
		expect(brackeen.opinions.map((opinion) => [opinion.column, opinion.justice])).toEqual([
			['court', 'Barrett'],
			['concurring', 'Gorsuch'],
			['concurring', 'Kavanaugh'],
			['dissenting', 'Thomas'],
			['dissenting', 'Alito']
		]);
		const lewis = roberts.cases.find((item) => item.key === 'lewis-v-clarke')!;
		expect(lewis.opinions.filter((opinion) => opinion.qualifier === 'in the judgment').map((opinion) => opinion.justice)).toEqual(['Thomas', 'Ginsburg']);
		const fuller = courtPage('fuller-court')!;
		const winters = fuller.cases.find((item) => item.key === 'winters-v-united-states')!;
		expect(winters.opinions.find((opinion) => opinion.column === 'dissenting')).toMatchObject({ justice: 'Brewer', unwritten: true });
	});
});

describe('Justice and President pages', () => {
	it('puts the years of each career line first, oldest first', async () => {
		const { careerLine, justicePage } = await import('#lib/server/justice-pages.ts');
		expect(careerLine('State delegate, Virginia, 1782, 1784-1785, 1787-1788')).toEqual({ years: '1782, 1784–1785, 1787–1788', text: 'State delegate, Virginia' });
		expect(careerLine('Continental Army, Eleventh Virginia Regiment, 1776-1780; lieutenant, 1776-1777; captain, 1777-1780')).toEqual({
			years: '1776–1780',
			text: 'Continental Army, Eleventh Virginia Regiment; lieutenant, 1776–1777; captain, 1777–1780'
		});
		expect(careerLine('Private practice, Cortland, New York, 1817-')).toEqual({ years: '1817–', text: 'Private practice, Cortland, New York' });
		expect(careerLine('Legislative correspondent')).toEqual({ years: '', text: 'Legislative correspondent' });
		const career = justicePage('john-marshall')!.career;
		expect(career[0]).toEqual({ years: '1775–1776', text: 'Culpeper County [Virginia] Minutemen lieutenant' });
		expect(career.at(-1)?.text).toBe('Secretary of State');
	});

	it('matches every Justice a case names to one person', () => {
		const everyName = courtsWithPages().flatMap((court) => courtPage(court.key)!.cases.flatMap((item) => item.opinions));
		expect(everyName.every((opinion) => opinion.justice === 'Per curiam' || opinion.link?.startsWith('/supreme-court/justices/'))).toBe(true);
	});

	it("shows John Marshall's service, his cases and what he wrote", async () => {
		const { justicePage } = await import('#lib/server/justice-pages.ts');
		const page = justicePage('john-marshall')!;
		expect(page.summary).toBe('Chief Justice, 1801–1835');
		expect(page.cases.map((item) => item.key)).toEqual(['johnson-v-mintosh', 'cherokee-nation-v-georgia', 'worcester-v-georgia']);
		expect(page.cases.every((item) => item.parts[0].part === 'Opinion of the Court')).toBe(true);
		const facts = page.glance.flatMap((group) => group.items.map((item) => ({ ...item, label: group.label })));
		expect(facts.find((item) => item.label === "Appointed by")).toMatchObject({ text: 'John Adams', link: '/supreme-court/presidents/john-adams' });
		expect(facts.find((item) => item.label === "Followed by")).toMatchObject({ text: 'Roger Brooke Taney' });
	});

	it('lists the Justices a President appointed and their cases', async () => {
		const { presidentPage } = await import('#lib/server/justice-pages.ts');
		const page = presidentPage('john-adams')!;
		expect(page.appointees.map((justice) => justice.name)).toEqual(['Bushrod Washington', 'Alfred Moore', 'John Marshall']);
		expect(page.cases.map((item) => item.key)).toEqual(['johnson-v-mintosh', 'cherokee-nation-v-georgia', 'worcester-v-georgia']);
	});
});
