import { beforeEach, describe, expect, it } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { emptyAnswers, type ProfileAnswers } from '#lib/contributors.ts';
import {
	confirmProfile,
	confirmedCredits,
	decideProfile,
	deleteExpiredDeclinedProfiles,
	deleteProfile,
	giveWorkspaceAccess,
	listProfiles,
	profileBySubject,
	profileVersions,
	saveAnswers,
	setCreditSection,
	type SignedInAccount
} from '#lib/server/contributor-profiles.ts';
import { activePersonBySubject, matchSignIn, type SignedInPerson } from '#lib/server/people.ts';
import { testDatabase } from './database.ts';

let database: D1Database;
let lead: SignedInPerson;
const account: SignedInAccount = { subject: 'google|helper', email: 'helper@example.org', name: 'Helper' };
const ready: ProfileAnswers = {
	...emptyAnswers,
	givenName: 'Ada',
	familyName: 'Lovelace',
	adultConfirmed: true,
	interests: ['write', 'review'],
	creditForm: 'name-and-nation',
	nationAnswer: 'listed',
	nations: [{ nationIdentifier: 'sample-nation', nationName: 'Sample Nation', connection: 'citizen', showInCredit: true }],
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
});

async function confirmed() {
	await saveAnswers(database, account, ready);
	const profile = (await profileBySubject(database, account.subject))!;
	await confirmProfile(database, profile);
	return (await profileBySubject(database, account.subject))!;
}

describe('contributor profiles', () => {
	it('saves a draft that stays private until the person confirms it', async () => {
		await saveAnswers(database, account, { ...emptyAnswers, givenName: 'Ada' });
		const draft = await profileBySubject(database, account.subject);
		expect(draft).toMatchObject({ status: 'draft', email: 'helper@example.org', hasUnconfirmedChanges: true });
		expect(await listProfiles(database)).toEqual([]);
	});

	it('sends the registration at the first confirmation and keeps a copy of each version', async () => {
		const profile = await confirmed();
		expect(profile).toMatchObject({ status: 'submitted', confirmedVersion: 1, hasUnconfirmedChanges: false });
		expect(profile.answers.nations[0].nationName).toBe('Sample Nation');
		expect(profile.answers.interests).toEqual(['review', 'write']);
		const [listing] = await listProfiles(database);
		expect(listing).toMatchObject({ name: 'Ada Lovelace', nations: ['Sample Nation'], confirmedCreditLine: 'Ada Lovelace (Sample Nation)' });
		const [version] = await profileVersions(database, profile.identifier);
		expect(version).toMatchObject({ version: 1, creditLine: 'Ada Lovelace (Sample Nation)' });
		expect(version.answers.email).toBe('helper@example.org');
	});

	it('prints credits only from the confirmed version, never from unconfirmed edits', async () => {
		const profile = await confirmed();
		await decideProfile(database, profile, 'welcomed', null, lead);
		await setCreditSection(database, profile, 'contributors', lead);
		await saveAnswers(database, account, { ...ready, creditForm: 'pseudonym', creditPseudonym: 'Changed Mind' });

		const [credit] = await confirmedCredits(database);
		expect(credit).toMatchObject({ section: 'contributors', line: 'Ada Lovelace (Sample Nation)', biography: 'Writes about mediation.' });

		await confirmProfile(database, (await profileBySubject(database, account.subject))!);
		expect((await confirmedCredits(database))[0].line).toBe('Changed Mind');
		expect(await profileVersions(database, profile.identifier)).toHaveLength(2);
	});

	it('gives workspace access to the same account at once', async () => {
		const profile = await confirmed();
		expect(await activePersonBySubject(database, account.subject)).toBeUndefined();
		expect(
			await giveWorkspaceAccess(database, profile, { role: 'co-author', nationIdentifier: null, displayName: 'Ada Lovelace' }, lead)
		).toBe('given');
		const person = await activePersonBySubject(database, account.subject);
		expect(person).toMatchObject({ role: 'co-author', email: 'helper@example.org' });
		expect((await profileBySubject(database, account.subject))?.personIdentifier).toBe(person?.identifier);
	});

	it('keeps the profile when someone who registered is later invited by email', async () => {
		await confirmed();
		await database
			.prepare(`INSERT INTO people (identifier, email, display_name, role, status, added_by, added_at) VALUES ('p1', ?, 'Ada', 'co-author', 'invited', ?, '2026-11-21T00:00:00Z')`)
			.bind(account.email, lead.identifier)
			.run();
		await matchSignIn(database, { subject: account.subject, email: account.email, emailVerified: true, name: 'Ada' }, 'lead@example.org');
		expect((await profileBySubject(database, account.subject))?.personIdentifier).toBe('p1');
	});

	it('deletes the profile and every version at the person’s request', async () => {
		const profile = await confirmed();
		await deleteProfile(database, profile);
		expect(await profileBySubject(database, account.subject)).toBeUndefined();
		expect(await profileVersions(database, profile.identifier)).toEqual([]);
	});

	it('deletes declined registrations 12 months after the decision, and nothing else', async () => {
		const profile = await confirmed();
		await decideProfile(database, profile, 'declined', 'Not a fit right now.', lead);
		expect(await deleteExpiredDeclinedProfiles(database, new Date(Date.now() + 300 * 86_400_000))).toBe(0);
		expect(await profileBySubject(database, account.subject)).toBeDefined();
		expect(await deleteExpiredDeclinedProfiles(database, new Date(Date.now() + 370 * 86_400_000))).toBe(1);
		expect(await profileBySubject(database, account.subject)).toBeUndefined();
	});

	it('keeps welcomed contributors however old the decision', async () => {
		const profile = await confirmed();
		await decideProfile(database, profile, 'welcomed', null, lead);
		expect(await deleteExpiredDeclinedProfiles(database, new Date(Date.now() + 900 * 86_400_000))).toBe(0);
	});
});
