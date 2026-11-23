import { beforeEach, describe, expect, it } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { emptyAnswers, type ProfileAnswers } from '#lib/contributors.ts';
import { deleteAccount, formerContributorName } from '#lib/server/account-deletion.ts';
import { sessionAccount, startSession, verifiedAccount } from '#lib/server/accounts.ts';
import {
	confirmProfile,
	confirmedCredits,
	giveWorkspaceAccess,
	profileBySubject,
	saveAnswers,
	type SignedInAccount
} from '#lib/server/contributor-profiles.ts';
import { matchSignIn, personByIdentifier, type SignedInPerson } from '#lib/server/people.ts';
import { testDatabase } from './database.ts';

let database: D1Database;
let lead: SignedInPerson;
let account: SignedInAccount;

const ready: ProfileAnswers = {
	...emptyAnswers,
	givenName: 'Ada',
	familyName: 'Lovelace',
	phone: '+1 702 555 0100',
	thirteenOrOlder: true,
	interests: ['write'],
	creditForm: 'name',
	biography: 'Writes about mediation.',
	biographyInCredits: true
};

beforeEach(async () => {
	database = testDatabase();
	const result = await matchSignIn(
		database,
		{ subject: 'account-lead', email: 'lead@example.org', emailVerified: true, name: 'Lead Author' },
		'lead@example.org'
	);
	if (result.outcome !== 'signed-in') throw new Error(result.outcome);
	lead = result.person;
	const created = await verifiedAccount(database, 'helper@example.org');
	account = { subject: created.identifier, email: created.email, name: null };
});

async function signedUp() {
	await saveAnswers(database, account, ready);
	await confirmProfile(database, (await profileBySubject(database, account.subject))!);
	return (await profileBySubject(database, account.subject))!;
}

describe('deleting an account', () => {
	it('deletes the sign-in, sessions and profile, and keeps only the credit when the person keeps their name', async () => {
		await signedUp();
		const { token } = await startSession(database, account.subject, 'code');
		expect(await deleteAccount(database, account, true)).toEqual({ outcome: 'deleted' });

		expect(await sessionAccount(database, token)).toBeUndefined();
		expect(await profileBySubject(database, account.subject)).toBeUndefined();
		const left = await database.prepare('SELECT COUNT(*) AS count FROM accounts WHERE email = ?').bind('helper@example.org').first<{ count: number }>();
		expect(left?.count).toBe(0);
		const [credit] = await confirmedCredits(database);
		expect(credit).toMatchObject({ section: 'contributors', line: 'Ada Lovelace', biography: 'Writes about mediation.' });
		const kept = await database.prepare('SELECT * FROM retained_credits').first<Record<string, unknown>>();
		expect(JSON.stringify(kept)).not.toContain('555');
	});

	it('removes the credit and renames workspace work when the person removes their name', async () => {
		const profile = await signedUp();
		await giveWorkspaceAccess(database, profile, { role: 'co-author', nationIdentifier: null, displayName: 'Ada Lovelace' }, lead);
		const personIdentifier = (await profileBySubject(database, account.subject))!.personIdentifier!;

		await deleteAccount(database, account, false);

		expect(await confirmedCredits(database)).toEqual([]);
		const person = await personByIdentifier(database, personIdentifier);
		expect(person).toMatchObject({ status: 'removed', displayName: formerContributorName });
		expect(person?.email).not.toContain('helper@example.org');
	});

	it('refuses to delete the only lead author', async () => {
		const leadAccount: SignedInAccount = { subject: 'account-lead', email: 'lead@example.org', name: null };
		expect(await deleteAccount(database, leadAccount, true)).toEqual({ outcome: 'last-lead-author' });
		expect((await personByIdentifier(database, lead.identifier))?.status).not.toBe('removed');
	});
});
