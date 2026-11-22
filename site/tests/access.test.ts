import { beforeEach, describe, expect, it } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { everyDocument } from '#lib/permissions.ts';
import { accessTo, endGrant, grantByIdentifier, grantsOf, listGrants, onAccessChanged, setGrant } from '#lib/server/access.ts';
import { checkSeals, sealNewEntries } from '#lib/server/activity-seals.ts';
import { activityPage } from '#lib/server/events.ts';
import { invitePerson, matchSignIn, type SignedInPerson } from '#lib/server/people.ts';
import { testDatabase } from './database.ts';

let database: D1Database;
let lead: SignedInPerson;
let writer: SignedInPerson;
const essay = { kind: 'essay', identifier: 'i-key-cases-digest' } as const;

async function signIn(subject: string, email: string): Promise<SignedInPerson> {
	const result = await matchSignIn(database, { subject, email, emailVerified: true, name: email }, 'lead@example.org');
	if (result.outcome !== 'signed-in') throw new Error(result.outcome);
	return result.person;
}

beforeEach(async () => {
	database = testDatabase();
	lead = await signIn('account-lead', 'lead@example.org');
	await invitePerson(
		database,
		{ email: 'writer@example.org', displayName: 'Essay Writer', role: 'contributor', nationIdentifier: null },
		lead
	);
	writer = await signIn('google|writer', 'writer@example.org');
});

describe('grants', () => {
	it('gives a contributor nothing until the lead author grants it', async () => {
		expect((await accessTo(database, writer, essay)).level).toBe('no-access');
		await setGrant(
			database,
			{ personIdentifier: writer.identifier, subjectKind: 'essay', subjectIdentifier: essay.identifier, level: 'contribute', expiresAt: null, note: 'Assigned draft' },
			lead
		);
		expect(await accessTo(database, writer, essay)).toEqual({ level: 'contribute', source: 'document-grant' });
	});

	it('replaces a grant for the same document and keeps the old one in history', async () => {
		const input = { personIdentifier: writer.identifier, subjectKind: 'essay', subjectIdentifier: essay.identifier, expiresAt: null, note: null } as const;
		await setGrant(database, { ...input, level: 'full' }, lead);
		await setGrant(database, { ...input, level: 'comment' }, lead);
		expect(await grantsOf(database, writer.identifier)).toHaveLength(1);
		expect((await accessTo(database, writer, essay)).level).toBe('comment');
		const all = await database.prepare('SELECT COUNT(*) AS count FROM access_grants').first<{ count: number }>();
		expect(all?.count).toBe(2);
	});

	it('falls back to the role default when a grant ends, and tells listeners', async () => {
		const heard: string[] = [];
		const stop = onAccessChanged((person, subject) => heard.push(`${person}:${subject.kind}/${subject.identifier}`));
		await setGrant(
			database,
			{ personIdentifier: writer.identifier, subjectKind: 'essay', subjectIdentifier: everyDocument, level: 'comment', expiresAt: null, note: null },
			lead
		);
		const [grant] = await listGrants(database, writer.identifier);
		await endGrant(database, (await grantByIdentifier(database, grant.identifier))!, lead);
		stop();
		expect((await accessTo(database, writer, essay)).level).toBe('no-access');
		expect(heard).toEqual([`${writer.identifier}:essay/*`, `${writer.identifier}:essay/*`]);
	});

	it('records every change in the activity log, by whom', async () => {
		await setGrant(
			database,
			{ personIdentifier: writer.identifier, subjectKind: 'essay', subjectIdentifier: essay.identifier, level: 'full', expiresAt: '2027-01-31T23:59:59.999Z', note: null },
			lead
		);
		const [latest] = await activityPage(database, { personIdentifier: writer.identifier });
		expect(latest.action).toBe('Access to essay i-key-cases-digest set to full');
		expect(latest.note).toBe('Until 2027-01-31');
		expect(latest.actorName).toBe('lead@example.org');
	});
});

describe('the activity log', () => {
	it('cannot be changed or deleted from', async () => {
		await expect(database.prepare("UPDATE events SET action = 'nothing happened'").run()).rejects.toThrow(
			/cannot be changed/
		);
		await expect(database.prepare('DELETE FROM events').run()).rejects.toThrow(/cannot be deleted/);
	});

	it('seals entries in a chain that checks out', async () => {
		expect(await sealNewEntries(database)).toBeGreaterThan(0);
		expect(await sealNewEntries(database)).toBe(0);
		const check = await checkSeals(database);
		expect(check.intact).toBe(true);
		if (check.intact) {
			expect(check.checked).toBe(check.latestSequence);
			expect(check.latestSeal).toMatch(/^[0-9a-f]{64}$/);
		}
	});

	it('finds an entry changed behind the website’s back', async () => {
		await sealNewEntries(database);
		// Someone with direct access to the database removes the rule and rewrites an entry.
		await database.prepare('DROP TRIGGER events_cannot_change').run();
		await database.prepare("UPDATE events SET action = 'Invited as editor' WHERE sequence = 2").run();
		expect(await checkSeals(database)).toMatchObject({ intact: false, brokenAt: 2, problem: 'changed', checked: 1 });
	});

	it('finds a deleted entry', async () => {
		await sealNewEntries(database);
		await database.prepare('DROP TRIGGER events_cannot_be_deleted').run();
		await database.prepare('DROP TRIGGER event_seals_cannot_be_deleted').run();
		await database.prepare('DELETE FROM event_seals WHERE sequence = 2').run();
		await database.prepare('DELETE FROM events WHERE sequence = 2').run();
		expect(await checkSeals(database)).toMatchObject({ intact: false, brokenAt: 2 });
	});
});
