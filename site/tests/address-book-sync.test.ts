import { beforeEach, describe, expect, it } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import {
	differences,
	directoryNameOf,
	matchKey,
	sourceKindOf,
	type PublicNationContacts
} from '#lib/address-book-sync.ts';
import {
	addContact,
	addContactMethod,
	bookOfficeMethods,
	bringInPageContacts,
	contactEntry,
	editContactMethod,
	listContacts
} from '#lib/server/address-book.ts';
import { testDatabase } from './database.ts';

let database: D1Database;

beforeEach(() => {
	database = testDatabase();
});

const page = (contacts: PublicNationContacts['contacts']): PublicNationContacts[] => [
	{ identifier: 'sample-nation', name: 'Sample Nation', contacts }
];
const fromSite = {
	source: 'sample-site',
	sourceTitle: 'Contact us',
	sourceLink: 'https://sample.org/contact',
	asOf: '2026-11-20',
	directoryName: null,
	sourceKind: 'nation-website' as const
};

describe('matching and sources', () => {
	it('matches phones by their last ten digits and emails by case', () => {
		expect(matchKey('phone', '+1 (775) 555-0100')).toBe(matchKey('phone', '775.555.0100 ext. 4'));
		expect(matchKey('email', 'Office@Sample.org')).toBe('office@sample.org');
	});

	it('names the kind of source a profile fact came from', () => {
		expect(sourceKindOf('bia-tribal-leaders-directory-2026', null, [])).toBe('federal-directory');
		expect(sourceKindOf('x', 'https://www.sample.org/contact', ['https://sample.org/'])).toBe('nation-website');
		expect(sourceKindOf('x', 'https://indianaffairs.nc.gov/tribes', ['https://sample.org/'])).toBe('state-directory');
		expect(sourceKindOf('x', 'https://example.com/', [])).toBe('other');
		expect(directoryNameOf('alaska-directory', 'record "Alatna Village" (community: Alatna, object 7)')).toBe(
			'Alatna Village'
		);
	});
});

describe('differences with the nation pages', () => {
	it('lists what only one side has and pages that show an address out of use', async () => {
		const government = await addContact(
			database,
			{ kind: 'organization', name: 'Sample Nation', nationIdentifier: 'sample-nation', tags: ['nation-government'] },
			null
		);
		if (!government.ok) throw new Error(government.problem);
		const leader = await addContact(
			database,
			{
				kind: 'person',
				name: 'Chair',
				nationIdentifier: 'sample-nation',
				organizationIdentifier: government.identifier
			},
			null
		);
		if (!leader.ok) throw new Error(leader.problem);
		const base = {
			label: 'general-office',
			sourceKind: 'federal-directory',
			sourceLabel: 'Directory',
			verifiedOn: '2026-11-23'
		} as const;
		const old = await addContactMethod(
			database,
			government.identifier,
			{ method: 'email', value: 'old@sample.org', ...base },
			null
		);
		await addContactMethod(
			database,
			government.identifier,
			{ method: 'email', value: 'new@sample.org', ...base },
			null
		);
		await addContactMethod(
			database,
			government.identifier,
			{ method: 'phone', value: '(775) 555-0100', ...base },
			null
		);
		await addContactMethod(
			database,
			leader.identifier,
			{ method: 'email', value: 'chair@sample.org', ...base, label: 'leader' },
			null
		);
		if (!old.ok) throw new Error(old.problem);
		await editContactMethod(database, old.identifier, { status: 'replaced' }, 'Replaced at source', null);

		const pages = page([
			{ method: 'email', value: 'old@sample.org', ...fromSite },
			{ method: 'email', value: 'info@sample.org', ...fromSite },
			{ method: 'phone', value: '775-555-0100', ...fromSite }
		]);
		const found = differences(pages, await bookOfficeMethods(database));
		expect(found.map((item) => [item.kind, item.value])).toEqual([
			['book-only', 'new@sample.org'],
			['page-only', 'info@sample.org'],
			['page-shows-old', 'old@sample.org']
		]);
	});

	it('brings what only the page has into the nation government contact, creating it when needed', async () => {
		const pages = page([
			{ method: 'email', value: 'info@sample.org', ...fromSite },
			{ method: 'phone', value: '(775) 555-0100', ...fromSite }
		]);
		expect(await bringInPageContacts(database, pages, null, '2026-11-23')).toBe(2);
		expect(await bringInPageContacts(database, pages, null, '2026-11-23')).toBe(0);
		const [government] = await listContacts(database);
		expect(government).toMatchObject({
			kind: 'organization',
			nationIdentifier: 'sample-nation',
			tags: ['nation-government']
		});
		const entry = await contactEntry(database, government.identifier);
		expect(entry?.methods.find((method) => method.method === 'email')).toMatchObject({
			value: 'info@sample.org',
			label: 'general-office',
			sourceKind: 'nation-website',
			sourceLink: 'https://sample.org/contact',
			verifiedOn: '2026-11-20'
		});
		expect(differences(pages, await bookOfficeMethods(database))).toEqual([]);
	});
});

describe('the weekly run', () => {
	it('has a cron trigger and an address for each scheduled run', async () => {
		const { entrySource, scheduledPaths } = await import('../tools/add-scheduled-run.mjs');
		const { readFileSync } = await import('node:fs');
		const { mailCron } = await import('../tools/add-mail-handlers.mjs');
		const config = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
		const crons: string[] = JSON.parse(/"crons":\s*(\[[^\]]*\])/.exec(config)?.[1] ?? '[]');
		// The mail handlers wrap this entry and answer their own cron before it reaches here.
		expect(crons).toContain(mailCron);
		expect(Object.keys(scheduledPaths).sort()).toEqual(crons.filter((cron) => cron !== mailCron).sort());
		expect(Object.values(scheduledPaths)).toContain('/address-book/scheduled');
		expect(entrySource()).toContain('/address-book/scheduled');
	});
});
