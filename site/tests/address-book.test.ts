import { beforeEach, describe, expect, it } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { cleanEmail, cleanPhone, cleanTag, csvText, stalenessOf } from '#lib/address-book.ts';
import {
	addContact,
	addContactMethod,
	contactChanges,
	contactEntry,
	editContactMethod,
	listContacts,
	mailingList,
	refreshFromDirectories,
	splitEmails
} from '#lib/server/address-book.ts';
import { testDatabase } from './database.ts';

let database: D1Database;

beforeEach(() => {
	database = testDatabase();
});

async function added(
	result: Promise<{ ok: true; identifier: string } | { ok: false; problem: string }>
): Promise<string> {
	const value = await result;
	if (!value.ok) throw new Error(value.problem);
	return value.identifier;
}

describe('when an email or phone needs checking', () => {
	const base = {
		label: 'general-office' as const,
		verifiedOn: '2026-01-01',
		nextElectionOn: null,
		status: 'current' as const
	};

	it('allows a year for an office address and half a year for a leader', () => {
		expect(stalenessOf(base, '2026-12-31').stale).toBe(false);
		expect(stalenessOf(base, '2027-01-02').stale).toBe(true);
		expect(stalenessOf({ ...base, label: 'leader' }, '2026-07-01').stale).toBe(true);
		expect(stalenessOf({ ...base, label: 'leader' }, '2026-06-29').stale).toBe(false);
	});

	it('counts an election held since the last check', () => {
		const leader = {
			...base,
			label: 'leader' as const,
			nextElectionOn: '2026-03-01'
		};
		expect(stalenessOf(leader, '2026-02-28').stale).toBe(false);
		const after = stalenessOf(leader, '2026-03-01');
		expect(after.stale).toBe(true);
		expect(after.reasons[0]).toContain('election');
		expect(stalenessOf({ ...leader, verifiedOn: '2026-03-02' }, '2026-04-01').stale).toBe(false);
	});

	it('never flags one that is not in use', () => {
		expect(stalenessOf({ ...base, status: 'retired' }, '2030-01-01').stale).toBe(false);
	});
});

describe('cleaning what is typed', () => {
	it('keeps real emails and phones and refuses the rest', () => {
		expect(cleanEmail(' mailto:Office@Tribe.ORG ')).toBe('office@tribe.org');
		expect(cleanEmail('not an email')).toBeNull();
		expect(cleanPhone('(775) 555-0100 x12')).toBe('(775) 555-0100 x12');
		expect(cleanPhone('555-01')).toBeNull();
		expect(cleanTag(' Nation Government ')).toBe('nation-government');
		expect(splitEmails('a@b.org; C@D.org, a@b.org')).toEqual(['a@b.org', 'c@d.org']);
	});

	it('writes CSV fields a spreadsheet will not run', () => {
		expect(csvText('Smith, Jo')).toBe('"Smith, Jo"');
		expect(csvText('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
		expect(csvText(null)).toBe('');
	});
});

describe('the address book', () => {
	it('adds contacts with emails, tags and a history', async () => {
		const office = await added(
			addContact(
				database,
				{
					kind: 'organization',
					name: 'Sample Nation',
					nationIdentifier: 'sample-nation',
					tags: ['Nation Government']
				},
				null
			)
		);
		const chair = await added(
			addContact(
				database,
				{
					kind: 'person',
					name: 'Jo Smith',
					role: 'Chair',
					organizationIdentifier: office
				},
				null
			)
		);
		await added(
			addContactMethod(
				database,
				office,
				{
					method: 'email',
					value: 'Office@Sample.org',
					label: 'general-office',
					sourceKind: 'nation-website',
					sourceLabel: 'Contact page',
					verifiedOn: '2026-11-23',
					preferred: true
				},
				null
			)
		);
		const duplicate = await addContactMethod(
			database,
			office,
			{
				method: 'email',
				value: 'office@sample.org',
				label: 'other',
				sourceKind: 'other',
				sourceLabel: 'Again',
				verifiedOn: '2026-11-23'
			},
			null
		);
		expect(duplicate.ok).toBe(false);

		const entry = await contactEntry(database, office);
		expect(entry?.tags).toEqual(['nation-government']);
		expect(entry?.methods.map((method) => method.value)).toEqual(['office@sample.org']);
		expect((await contactChanges(database, office)).map((change) => change.change)).toEqual(['Added', 'Added']);

		const recipients = mailingList(await listContacts(database));
		expect(recipients).toHaveLength(1);
		expect(recipients[0]).toMatchObject({
			name: 'Sample Nation',
			email: 'office@sample.org'
		});
		expect((await contactEntry(database, chair))?.organizationIdentifier).toBe(office);
	});

	it('keeps one first choice per contact and records each change', async () => {
		const contact = await added(addContact(database, { kind: 'person', name: 'Ana' }, null));
		const first = await added(
			addContactMethod(
				database,
				contact,
				{
					method: 'email',
					value: 'a@one.org',
					label: 'work',
					sourceKind: 'told-us',
					sourceLabel: 'Ana',
					verifiedOn: '2026-11-01',
					preferred: true
				},
				null
			)
		);
		const second = await added(
			addContactMethod(
				database,
				contact,
				{
					method: 'email',
					value: 'a@two.org',
					label: 'work',
					sourceKind: 'told-us',
					sourceLabel: 'Ana',
					verifiedOn: '2026-11-01'
				},
				null
			)
		);
		await editContactMethod(database, second, { preferred: true }, 'Made first choice', null);
		const methods = (await contactEntry(database, contact))?.methods ?? [];
		expect(methods.filter((method) => method.preferred).map((method) => method.identifier)).toEqual([second]);

		await editContactMethod(database, second, { status: 'bounced', preferred: false }, 'Marked mail came back', null);
		expect(mailingList(await listContacts(database))[0].email).toBe('a@one.org');
		const changes = await contactChanges(database, contact);
		expect(changes[0].change).toBe('Marked mail came back');
		expect(JSON.parse(changes[0].before ?? '{}').status).toBe('current');
		expect(first).not.toBe(second);
	});
});

describe('checking against the directories', () => {
	function fakeFetch(federal: Record<string, string | null>[], alaska: Record<string, string | null>[]) {
		return async (link: string) =>
			new Response(
				JSON.stringify({
					features: (link.includes('alaska') ? alaska : federal).map((attributes) => ({ attributes }))
				}),
				{
					status: 200
				}
			);
	}

	it('verifies emails still listed, replaces ones that are not, and adds the new one', async () => {
		const leader = await added(
			addContact(
				database,
				{
					kind: 'person',
					name: 'Old Chair',
					nationIdentifier: 'sample-nation'
				},
				null
			)
		);
		const kept = await added(addContact(database, { kind: 'person', name: 'Kept Chair' }, null));
		const village = await added(addContact(database, { kind: 'organization', name: 'Sample Village' }, null));
		const directory = {
			sourceLabel: 'Tribal Leaders Directory',
			verifiedOn: '2026-01-01',
			preferred: true
		} as const;
		const oldEmail = await added(
			addContactMethod(
				database,
				leader,
				{
					method: 'email',
					value: 'old@sample.org',
					label: 'leader',
					sourceKind: 'federal-directory',
					directoryName: 'Sample Nation',
					...directory
				},
				null
			)
		);
		const keptEmail = await added(
			addContactMethod(
				database,
				kept,
				{
					method: 'email',
					value: 'chair@kept.org',
					label: 'leader',
					sourceKind: 'federal-directory',
					directoryName: 'Kept Nation',
					...directory
				},
				null
			)
		);
		await added(
			addContactMethod(
				database,
				village,
				{
					method: 'email',
					value: 'office@village.org',
					label: 'general-office',
					sourceKind: 'alaska-directory',
					directoryName: 'Sample Village',
					...directory
				},
				null
			)
		);

		const summary = await refreshFromDirectories(
			database,
			fakeFetch(
				[
					{
						tribefullname: 'Sample Nation',
						firstname: 'New',
						lastname: 'Chair',
						jobtitle: 'Chairwoman',
						email: 'new@sample.org',
						nextelection: '2027-05-01'
					},
					{
						tribefullname: 'Kept Nation',
						firstname: 'Kept',
						lastname: 'Chair',
						jobtitle: 'Chair',
						email: 'Chair@Kept.org; clerk@kept.org',
						nextelection: '2028-01-01'
					}
				],
				[]
			),
			null,
			'2026-11-23'
		);
		expect(summary).toEqual({
			checked: 3,
			verified: 1,
			replaced: 1,
			added: 1,
			notListed: 1
		});

		const leaderMethods = (await contactEntry(database, leader))?.methods ?? [];
		const old = leaderMethods.find((method) => method.identifier === oldEmail);
		const fresh = leaderMethods.find((method) => method.value === 'new@sample.org');
		expect(old?.status).toBe('replaced');
		expect(old?.preferred).toBe(false);
		expect(fresh).toMatchObject({
			status: 'current',
			preferred: true,
			verifiedOn: '2026-11-23',
			nextElectionOn: '2027-05-01'
		});
		expect(fresh?.note).toContain('Chairwoman: New Chair');

		const keptMethod = (await contactEntry(database, kept))?.methods.find((method) => method.identifier === keptEmail);
		expect(keptMethod).toMatchObject({
			verifiedOn: '2026-11-23',
			nextElectionOn: '2028-01-01',
			status: 'current'
		});
	});
});

describe('the mailing list', () => {
	it('sends an address once when an office and its leader share it', async () => {
		const office = await added(addContact(database, { kind: 'organization', name: 'Office' }, null));
		const leader = await added(
			addContact(database, { kind: 'person', name: 'Leader', organizationIdentifier: office }, null)
		);
		for (const contact of [office, leader]) {
			await added(
				addContactMethod(
					database,
					contact,
					{
						method: 'email',
						value: 'shared@nation.org',
						label: 'general-office',
						sourceKind: 'federal-directory',
						sourceLabel: 'Directory',
						verifiedOn: '2026-11-23'
					},
					null
				)
			);
		}
		expect(mailingList(await listContacts(database)).map((recipient) => recipient.email)).toEqual([
			'shared@nation.org'
		]);
	});
});
