import { describe, expect, it } from 'vitest';
import { biographies, biographyPage, checked, peopleInCase, peopleOfNation, signersOfTreaty, treatySigning, type BiographyRecord } from '#lib/server/biographies.ts';
import { courtPage } from '#lib/server/supreme-court-pages.ts';

describe('Biographies of Native people', () => {
	it('gives Crow Dog his other name, his nation and his case, each with its source', () => {
		const page = biographyPage('crow-dog')!;
		expect(page.names[0]).toMatchObject({
			name: 'Kan-gi-shun-ca',
			note: 'as the Supreme Court Reporter prints it'
		});
		expect(page.names[0].citations).toHaveLength(1);
		expect(page.glance.find((group) => group.field === 'nation')?.items[0]).toMatchObject({
			text: 'Rosebud Sioux Tribe of the Rosebud Indian Reservation',
			link: '/nations/rosebud-sioux-tribe-of-the-rosebud-indian-reservation'
		});
		expect(page.cases).toEqual([
			expect.objectContaining({
				key: 'ex-parte-crow-dog',
				role: 'Petitioner',
				link: '/cases/ex-parte-crow-dog'
			})
		]);
		expect(page.picture?.src).toBe('/biographies/portraits/crow-dog.jpg');
		expect(page.sources.map((source) => source.key)).toEqual(['ex-parte-crow-dog']);
		// The first call reads every record (about 27,000), which takes 15 to 30 seconds on a CI runner.
	}, 60_000);

	it('lists the people with a page on their case and their nation', () => {
		expect(peopleInCase('ex-parte-crow-dog').map((person) => person.name)).toEqual(['Crow Dog', 'Spotted Tail']);
		expect(peopleOfNation('kiowa-tribe').map((person) => person.name)).toContain('Lone Wolf');
	});

	it('cites every life event, and builds every page', () => {
		for (const person of biographies()) {
			const page = biographyPage(person.key)!;
			for (const event of page.events) expect(event.citations.length, `${person.key}: ${event.when}`).toBeGreaterThan(0);
			for (const item of page.cases) expect(item.citations.length, `${person.key}: ${item.key}`).toBeGreaterThan(0);
		}
	});

	it("links each treaty Little Robe signed to its page and the copy of its text", () => {
		const page = biographyPage('little-robe')!;
		expect(page.treaties.map((item) => item.link)).toEqual([
			'/laws/treaty-with-the-apache-cheyenne-and-arapaho-1865',
			'/laws/treaty-with-the-cheyenne-and-arapaho-1865',
			'/laws/treaty-with-the-cheyenne-and-arapaho-1867'
		]);
		expect(page.treaties[0]).toMatchObject({ signed: 'Oct. 17, 1865', signedFor: 'Cheyennes', listedAs: 'chief', citation: '14 Stat. 713' });
		expect(page.treaties[2].listedAs).toBeUndefined();
		expect(page.treaties[2].document).toEqual({ href: '/copies/view/treaties/treaty-with-the-cheyenne-and-arapaho-1867.pdf', format: 'PDF' });
		expect(page.glance.find((group) => group.field === 'treaties')?.items).toHaveLength(3);
		expect(page.events[2].link).toEqual({ text: 'Treaty with the Cheyenne and Arapaho, 1867', href: '/laws/treaty-with-the-cheyenne-and-arapaho-1867' });
		expect(page.events[2].text).toContain(page.events[2].link!.text);
		// The life event repeats the treaty's row, so both markers point at one entry in References.
		expect(page.events[2].citations[0].number).toBe(page.treaties[2].citations[0].number);
		expect(signersOfTreaty('treaty-with-the-cheyenne-and-arapaho-1867').map((person) => person.name)).toContain('Little Robe');
	});

	it('reads every treaty signing and links every signed treaty', () => {
		expect(treatySigning('Signed the Treaty with the Seneca, 1831, for the Senecas, listed as Capt..')).toEqual({ treaty: 'Treaty with the Seneca, 1831', signedFor: 'Senecas', listedAs: 'Capt.' });
		let signings = 0;
		for (const person of biographies()) {
			const page = biographyPage(person.key)!;
			for (const event of page.events.filter((item) => item.text.startsWith('Signed the Treaty'))) {
				signings += 1;
				expect(event.link, `${person.key}: ${event.text}`).toBeDefined();
				expect(event.text).toContain(event.link!.text);
			}
			for (const item of page.treaties) expect(item.signedFor, `${person.key}: ${item.key}`).toBeTruthy();
		}
		expect(signings).toBeGreaterThan(1400);
	});

	it('keeps a living person to the public role', () => {
		const living: BiographyRecord = {
			key: 'someone',
			name: 'Someone',
			lead: 'A party.',
			living: true,
			events: [{ when: '2000', text: 'Born.', source: 'x' }],
			checked: '2026-11-24'
		};
		expect(() => checked('someone.yaml', living)).toThrow(/public role only/);
		expect(biographyPage('julia-martinez')!.events).toEqual([]);
		expect(biographyPage('julia-martinez')!.picture).toBeUndefined();
	});

	it("shows the Chief Justice's portrait on a Court's page", () => {
		const page = courtPage('waite-court')!;
		expect(page.picture?.src).toBe('/supreme-court/portraits/morrison-remick-waite');
		expect(page.glance[0]).toMatchObject({
			label: 'Chief Justice',
			items: [
				expect.objectContaining({
					link: '/supreme-court/justices/morrison-remick-waite'
				})
			]
		});
	});

	it('gives the people who signed treaties for the United States a page, and links a President to his own', () => {
		const cass = biographyPage('lewis-cass')!;
		expect(cass.treaties.length).toBeGreaterThan(10);
		expect(cass.treaties.every((item) => item.signedFor === 'United States')).toBe(true);
		expect(signersOfTreaty(cass.treaties[0].key).map((person) => person.name)).toContain('Lewis Cass');
		const jackson = biographyPage('andrew-jackson-united-states')!;
		expect(jackson.glance.find((group) => group.field === 'office')?.items[0].link).toBe('/presidents/andrew-jackson');
		// The Makah sub-chief the 1855 treaty prints as Andrew Jackson keeps his own page, with no President link.
		expect(biographyPage('andrew-jackson')!.glance.find((group) => group.field === 'office')).toBeUndefined();
	});

	it('gives a treaty signer the offices the treaty names and the terms in Congress', () => {
		const parris = biographyPage('albion-k-parris')!;
		expect(parris.lead).toBe('U.S. Representative from Massachusetts and U.S. Senator from Maine. Signed the Treaty with the Winnebago, 1846, for the United States.');
		const directory = parris.sources.find((source) => source.key === 'biographical-directory-of-the-united-states-congress');
		expect(directory?.html).toContain('Biographical Directory of the United States Congress');
		expect(biographyPage('william-clark')!.lead).toContain('Governor of the Missouri Territory');
	});

	it('marks a page that holds only treaty signings as a stub, and no other', () => {
		expect(biographyPage('little-robe')!.stub).toEqual({ kind: 'person', record: 'biographies/little-robe' });
		expect(biographyPage('william-clark')!.stub?.kind).toBe('person');
		// Terms in Congress are more than a signing, so Lewis Cass's page is not a stub.
		expect(biographyPage('lewis-cass')!.stub).toBeUndefined();
		expect(biographyPage('crow-dog')!.stub).toBeUndefined();
	});
});
