import { describe, expect, it, vi } from 'vitest';
import { accountsOf } from '#lib/server/impact-accounts.ts';
import { isLawRecord, recordName, recordPageLink } from '#lib/server/law-records.ts';
import { sources } from '#lib/server/content.ts';

vi.mock('virtual:source-citations', () => ({ sourceCitations: {} }));

describe('Accounts of a law’s impact', () => {
	it('lists D. W. C. Duncan’s testimony on the Curtis Act page, in his words that name it', () => {
		const accounts = accountsOf({ record: 'curtis-act-1898' });
		const duncan = accounts.find((account) => account.id === 'cherokee-duncan-allotment-testimony-1906');
		expect(duncan).toMatchObject({ type: 'Firsthand', link: '/stories/cherokee-duncan-allotment-testimony-1906' });
		expect(duncan?.excerpt?.text).toContain('the Curtis law');
		expect(duncan?.excerpt?.locator).toContain('186');
		// The first call reads every source record (about 31,000), which takes 15 to 30 seconds on a CI runner.
	}, 60_000);

	it('links one account to every law and event it names, many to many', () => {
		const duncan = accountsOf({ record: 'curtis-act-1898' }).find((account) => account.id === 'cherokee-duncan-allotment-testimony-1906')!;
		expect(duncan.also.map((other) => other.link)).toEqual(expect.arrayContaining(['/laws/treaty-with-the-cherokee-1866', '/stories/events/allotment']));
		expect(accountsOf({ record: 'treaty-with-the-cherokee-1866' }).map((account) => account.id)).toContain(duncan.id);
		expect(accountsOf({ event: 'allotment' }).map((account) => account.id)).toContain(duncan.id);
	});

	it('shows no accounts where none names the law, and guesses none', () => {
		expect(accountsOf({ record: 'indian-removal-act-1830' })).toEqual([]);
	});
});

describe('Which records get a law page', () => {
	it('gives federal laws and treaties a page under /laws, and court cases theirs under /cases', () => {
		expect(isLawRecord(sources().get('curtis-act-1898')!)).toBe(true);
		expect(isLawRecord(sources().get('treaty-with-the-cherokee-1835')!)).toBe(true);
		expect(isLawRecord(sources().get('worcester-v-georgia')!)).toBe(false);
		expect(recordPageLink('worcester-v-georgia')).toBe('/cases/worcester-v-georgia');
		expect(recordPageLink('curtis-act-1898')).toBe('/laws/curtis-act-1898');
	});

	it('names a law by its short name and a treaty with its year', () => {
		expect(recordName('curtis-act-1898').name).toBe('Curtis Act (1898)');
		expect(recordName('treaty-with-the-cherokee-1835').name).toBe('Treaty with the Cherokee (1835)');
	});
});
