import { describe, expect, it } from 'vitest';
import { sources } from '#lib/server/content.ts';
import { courtPage, courtsWithPages } from '#lib/server/supreme-court-pages.ts';
import { associatesOf, courtPath, courts } from '#lib/server/supreme-courts.ts';
import { pictureCredit, pictureOf, pictureView, servablePortraits } from '#lib/server/supreme-court-pictures.ts';

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
		const sentences = (change?: { events: { text: string }[][] }) => change?.events.map((parts) => parts.map((part) => part.text).join(''));
		expect(sentences(page.changes.find((change) => change.date === '1807-05-04'))).toEqual(['Thomas Todd took a new seat (2 Stat. 420).']);
		expect(sentences(page.changes.at(-1))).toEqual(['Chief Justice John Marshall died.']);
		// Trevor, Nov. 24, 2026: the changes link the people they mention.
		expect(page.changes.find((change) => change.date === '1804-05-07')?.events).toEqual([
			[{ text: 'William Johnson', link: '/supreme-court/justices/william-johnson' }, { text: ' took the seat of ' }, { text: 'Alfred Moore', link: '/supreme-court/justices/alfred-moore' }, { text: '.' }]
		]);
		expect(page.changes.at(-1)?.events[0].find((part) => part.link)?.link).toBe('/supreme-court/justices/john-marshall');
		expect(page.cases.map((item) => item.key)).toEqual(['fletcher-v-peck', 'new-jersey-v-wilson', 'meigs-v-mclungs-lessee', 'preston-v-browder', 'danforths-lessee-v-thomas', 'johnson-v-mintosh', 'danforth-v-wear', 'patterson-v-jenks', 'sundry-goods-wares-and-merchandises-v-united-states', 'cherokee-nation-v-georgia', 'worcester-v-georgia', 'mitchel-v-united-states', 'united-states-v-fernandez']);
		expect(page.sources.map((source) => source.key)).toContain('supreme-court-historical-society-marshall-court');
	});

	it('ends a sentence after "Jr." with one period', () => {
		const page = courtPage('rehnquist-court')!;
		const kennedy = page.changes.find((change) => change.date === '1988-02-18')!;
		expect(kennedy.events[0].map((part) => part.text).join('')).toBe('Anthony M. Kennedy took the seat of Lewis F. Powell, Jr.');
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
		// The Marshall Court cases on the site, oldest first, including those written by script from the Supreme Court Database (2026-11-24).
		expect(page.cases.map((item) => item.key)).toEqual(['fletcher-v-peck', 'new-jersey-v-wilson', 'meigs-v-mclungs-lessee', 'preston-v-browder', 'danforths-lessee-v-thomas', 'johnson-v-mintosh', 'danforth-v-wear', 'patterson-v-jenks', 'sundry-goods-wares-and-merchandises-v-united-states', 'cherokee-nation-v-georgia', 'worcester-v-georgia', 'mitchel-v-united-states']);
		const wrote = ['johnson-v-mintosh', 'cherokee-nation-v-georgia', 'worcester-v-georgia'];
		expect(page.cases.filter((item) => wrote.includes(item.key)).every((item) => item.parts[0].part === 'Opinion of the Court')).toBe(true);
		const facts = page.glance.flatMap((group) => group.items.map((item) => ({ ...item, label: group.label })));
		expect(facts.find((item) => item.label === "Appointed by")).toMatchObject({ text: 'John Adams', link: '/presidents/john-adams' });
		expect(facts.find((item) => item.label === "Followed by")).toMatchObject({ text: 'Roger Brooke Taney' });
	});

	it('lists the Justices a President appointed and their cases', async () => {
		const { presidentPage } = await import('#lib/server/justice-pages.ts');
		const page = presidentPage('john-adams')!;
		expect(page.appointees.map((justice) => justice.name)).toEqual(['Bushrod Washington', 'Alfred Moore', 'John Marshall']);
		expect(page.cases.map((item) => item.key)).toEqual(['fletcher-v-peck', 'new-jersey-v-wilson', 'meigs-v-mclungs-lessee', 'preston-v-browder', 'danforths-lessee-v-thomas', 'johnson-v-mintosh', 'danforth-v-wear', 'patterson-v-jenks', 'sundry-goods-wares-and-merchandises-v-united-states', 'cherokee-nation-v-georgia', 'worcester-v-georgia', 'mitchel-v-united-states']);
	});

	// Trevor, Nov. 27, 2026: "did Andrew Johnson really have no supreme court cases that involved native Americans?"
	it('gives every President a page, with the cases decided in the term, not only those their appointees heard', async () => {
		const { presidentPage, presidentKeys } = await import('#lib/server/justice-pages.ts');
		const { presidentTerms } = await import('#lib/president-terms.ts');
		expect(new Set(presidentKeys())).toEqual(new Set(presidentTerms.map((term) => term.key)));
		const johnson = presidentPage('andrew-johnson')!;
		expect(johnson.appointees).toEqual([]);
		expect(johnson.nominees).toEqual(['He nominated Henry Stanbery on Apr. 16, 1866; the Senate took no action.']);
		expect(johnson.decided.map((item) => item.key)).toEqual(['united-states-v-holliday', 'the-kansas-indians', 'the-new-york-indians', 'united-states-v-mayrand', 'wilson-v-wall', 'kendall-v-united-states']);
		expect(johnson.glance.find((group) => group.field === 'in-office')?.items.map((item) => item.text)).toEqual(['Apr. 15, 1865 – Mar. 4, 1869']);
		expect(johnson.glance.find((group) => group.field === 'before')?.items[0]).toMatchObject({ text: 'Abraham Lincoln', link: '/presidents/abraham-lincoln' });
		expect(johnson.family).toEqual({ title: 'Andrew Johnson', link: '/presidents/andrew-johnson', pages: [{ label: 'President Page', link: '/presidents/andrew-johnson' }] });
		expect(johnson.outline.items.map((item) => item.link)).toEqual(['#orders-heading', '#treaties-heading', '#acts-heading', '#justices-heading', '#decided-heading', '#sources-heading']);
	});

	it("lists the orders a President signed and the treaties they proclaimed, by the proclamation's date", async () => {
		const { presidentPage } = await import('#lib/server/justice-pages.ts');
		const johnson = presidentPage('andrew-johnson')!;
		expect(johnson.orders.map((order) => order.key)).toContain('executive-order-1866-02-26-niobrara-reserve');
		expect(johnson.ordersLink).toBe('/laws/executive-orders?president=andrew-johnson');
		// Signed Oct. 28, 1867, under Johnson, and proclaimed Aug. 19, 1868; the Fort Laramie Treaty was proclaimed Feb. 24, 1869.
		expect(johnson.treaties.find((treaty) => treaty.key === 'treaty-with-the-cheyenne-and-arapaho-1867')).toMatchObject({ date: '1868-08-19', signed: '1867-10-28', citation: '15 Stat. 593' });
		expect(johnson.treaties.map((treaty) => treaty.key)).toContain('treaty-with-the-sioux-and-arapaho-1868');
		// Signed Apr. 29, 1868, under Johnson; never on Grant's page.
		expect(presidentPage('ulysses-grant')!.treaties.map((treaty) => treaty.key)).not.toContain('treaty-with-the-sioux-and-arapaho-1868');
		const lincoln = presidentPage('abraham-lincoln')!;
		expect(lincoln.outline.items.map((item) => item.label)).toContain('Cases heard by Justices he appointed');
	});
});

describe('pictures on the Supreme Court pages', () => {
	it('writes each credit from the checked record: maker, date, source and number, license', () => {
		expect(pictureCredit(pictureOf('salmon-portland-chase')!)).toBe(
			"Brady's National Photographic Portrait Galleries, c. 1860–1865. Library of Congress, cwpb.05620. Public domain."
		);
		expect(pictureView('salmon-portland-chase')?.original).toBe('https://www.loc.gov/item/2018666381/');
	});

	it('never carries Wikimedia Commons template text into a credit', () => {
		for (const { person } of servablePortraits()) {
			const credit = pictureCredit(pictureOf(person)!);
			expect(credit, person).not.toMatch(/Commons|copyright tag|This tag|This image is available|Unknown (author|source)/i);
		}
	});

	it("shows a Court's group photograph where it has one, and otherwise its Chief Justice", () => {
		expect(courtPage('taft-court')?.picture?.src).toBe('/supreme-court/portraits/taft-court');
		expect(courtPage('marshall-court')?.picture?.src).toBe('/supreme-court/portraits/john-marshall');
	});
});
