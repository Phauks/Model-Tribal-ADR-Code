import { describe, expect, it } from 'vitest';
import { isLawSubject, itemsFor, lawAddress, lawParts, lawSubjects, type NationLaw } from '../src/lib/find-the-law.ts';
import { nations } from '../src/lib/server/content.ts';
import { isFamilyOpinionName, lawNations, nationLaw } from '../src/lib/server/find-the-law.ts';
import { GET } from '../src/routes/nations/law/[id].json/+server.ts';

function lawOf(id: string): NationLaw {
	const record = nations().find((candidate) => candidate.id === id);
	if (!record) throw new Error(`No record ${id}`);
	return nationLaw(record);
}

describe('Find the law addresses', () => {
	it('puts the nation and the subject in the address, leaving out All subjects', () => {
		expect(lawAddress('navajo-nation', 'family')).toBe('/nations/law?nation=navajo-nation&subject=family');
		expect(lawAddress('navajo-nation', 'all')).toBe('/nations/law?nation=navajo-nation');
		expect(lawAddress('', 'all')).toBe('/nations/law');
	});

	it('knows the seven subjects and nothing else', () => {
		expect(lawSubjects.map((subject) => subject.key)).toEqual(['courts', 'family', 'criminal', 'land', 'gaming', 'business', 'government']);
		expect(isLawSubject('gaming')).toBe(true);
		expect(isLawSubject('all')).toBe(false);
		expect(isLawSubject(null)).toBe(false);
	});
});

describe('Find the law subjects', () => {
	const navajo = lawOf('navajo-nation');
	const keys = (part: (typeof lawParts)[number]['key'], subject: Parameters<typeof itemsFor>[2]) =>
		itemsFor(navajo, part, subject).map((item) => item.key);

	it('tags code sections by their subject area', () => {
		const family = itemsFor(navajo, 'tribal', 'family').filter((item) => item.kind === 'Code section');
		expect(family.length).toBeGreaterThan(0);
		expect(family.every((item) => item.subjects.includes('family'))).toBe(true);
		expect(family.some((item) => /§ 1716/.test(item.title))).toBe(true);
	});

	it('puts every court under Courts and procedure', () => {
		const courts = navajo.items.filter((item) => item.key.startsWith('court-'));
		expect(courts.length).toBeGreaterThan(0);
		expect(courts.every((item) => item.part === 'tribal' && item.subjects.includes('courts'))).toBe(true);
	});

	it('lists gaming compacts as agreements under Gaming, linked to their history on the nation page', () => {
		const compacts = itemsFor(navajo, 'agreements', 'gaming');
		expect(compacts.map((item) => item.title)).toEqual(expect.arrayContaining(['Gaming compact with Arizona', 'Gaming compact with New Mexico']));
		expect(compacts.every((item) => item.link?.startsWith('/nations/navajo-nation#document-'))).toBe(true);
	});

	it('takes cases from their case box topics', () => {
		expect(keys('decisions', 'family')).toContain('case-haaland-v-brackeen');
		expect(keys('decisions', 'criminal')).toContain('case-united-states-v-wheeler');
		expect(keys('decisions', 'gaming')).not.toContain('case-haaland-v-brackeen');
	});

	it('gives child welfare agreements and the Indian Child Welfare Act to Family and children', () => {
		expect(itemsFor(navajo, 'agreements', 'family').every((item) => item.kind === 'Child welfare agreement')).toBe(true);
		expect(keys('federal', 'family')).toContain('law-indian-child-welfare-act-1978');
		expect(keys('federal', 'gaming')).toContain('law-indian-gaming-regulatory-act-1988');
	});

	it('marks the federal laws that apply to every nation', () => {
		const icwa = navajo.items.find((item) => item.key === 'law-indian-child-welfare-act-1978');
		expect(icwa?.everyNation).toBe(true);
		expect(icwa?.link).toBeTruthy();
	});

	it('links the full code and never a repository', () => {
		expect(navajo.codes.map((code) => code.title)).toContain('Navajo Nation Code');
		expect(navajo.items.every((item) => !item.link || !/github\.com/.test(item.link))).toBe(true);
	});

	it('reads family matters from an opinion name', () => {
		expect(isFamilyOpinionName('In re the Adoption of Tsosie')).toBe(true);
		expect(isFamilyOpinionName('In re the Estate of Nez')).toBe(true);
		expect(isFamilyOpinionName('Navajo Nation v. Jones')).toBe(false);
	});

	it('shows every tagged item under All subjects', () => {
		for (const part of lawParts) {
			const all = itemsFor(navajo, part.key, 'all');
			for (const subject of lawSubjects) expect(all).toEqual(expect.arrayContaining(itemsFor(navajo, part.key, subject.key)));
		}
	});
});

describe('Find the law with little on record', () => {
	const sparse = lawOf('chickahominy-indian-tribe-eastern-division');

	it('leaves the parts with nothing empty, which the page shows as None Identified', () => {
		expect(itemsFor(sparse, 'tribal', 'family')).toEqual([]);
		expect(itemsFor(sparse, 'decisions', 'family')).toEqual([]);
		expect(itemsFor(sparse, 'agreements', 'family')).toEqual([]);
		expect(sparse.opinions).toBeUndefined();
	});

	it('still shows the federal law that applies to every nation', () => {
		expect(itemsFor(sparse, 'federal', 'family').map((item) => item.key)).toContain('law-indian-child-welfare-act-1978');
	});
});

describe('Each nation’s file', () => {
	it('is built for every listed nation', () => {
		const listed = lawNations();
		expect(listed.length).toBeGreaterThan(500);
		expect(listed.some((record) => record.review?.status === 'withdrawn-at-request')).toBe(false);
	});

	it('is the nation’s items as JSON', async () => {
		const response = await GET({ params: { id: 'navajo-nation' } } as Parameters<typeof GET>[0]);
		const body = (await response.json()) as NationLaw;
		expect(body.id).toBe('navajo-nation');
		expect(body.name).toBe('Navajo Nation');
		expect(body.items.length).toBeGreaterThan(0);
		expect(new Set(body.items.map((item) => item.key)).size).toBe(body.items.length);
	});

	it('is not found for an address that names no nation', async () => {
		let status: number | undefined;
		try {
			await GET({ params: { id: 'no-such-nation' } } as Parameters<typeof GET>[0]);
		} catch (problem) {
			status = (problem as { status?: number }).status;
		}
		expect(status).toBe(404);
	});
});
