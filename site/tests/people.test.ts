import { beforeEach, describe, expect, it } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import {
	activePersonBySubject,
	countLeadAuthors,
	invitePerson,
	matchSignIn,
	setRemoved,
	type SignedInPerson
} from '#lib/server/people.ts';
import { testDatabase } from './database.ts';

let database: D1Database;
const leadAuthorEmail = 'lead@example.org';

async function signInLeadAuthor(): Promise<SignedInPerson> {
	const result = await matchSignIn(
		database,
		{ subject: 'account-lead', email: 'Lead@Example.org', emailVerified: true, name: 'Lead Author' },
		leadAuthorEmail
	);
	if (result.outcome !== 'signed-in') throw new Error(result.outcome);
	return result.person;
}

beforeEach(() => {
	database = testDatabase();
});

describe('matching a sign-in to a person', () => {
	it('refuses anyone who is not on the list', async () => {
		const result = await matchSignIn(
			database,
			{ subject: 'google|1', email: 'stranger@example.org', emailVerified: true, name: 'Stranger' },
			leadAuthorEmail
		);
		expect(result.outcome).toBe('not-on-list');
	});

	it('makes the person named in LEAD_AUTHOR_EMAIL the first lead author', async () => {
		const lead = await signInLeadAuthor();
		expect(lead.role).toBe('lead-author');
		expect(await countLeadAuthors(database)).toBe(1);
		expect((await activePersonBySubject(database, 'account-lead'))?.identifier).toBe(lead.identifier);
	});

	it('does not trust an unverified email address', async () => {
		const result = await matchSignIn(
			database,
			{ subject: 'account-fake', email: leadAuthorEmail, emailVerified: false, name: 'Impostor' },
			leadAuthorEmail
		);
		expect(result.outcome).toBe('email-not-verified');
	});

	it('links an invitation at the first sign-in, then matches by account identifier', async () => {
		const lead = await signInLeadAuthor();
		await invitePerson(
			database,
			{ email: 'reviewer@nation.example', displayName: 'Court Clerk', role: 'nation-reviewer', nationIdentifier: 'sample-nation' },
			lead
		);
		expect(await activePersonBySubject(database, 'google|clerk')).toBeUndefined();

		const first = await matchSignIn(
			database,
			{ subject: 'google|clerk', email: 'Reviewer@Nation.example', emailVerified: true, name: 'C' },
			leadAuthorEmail
		);
		expect(first.outcome === 'signed-in' && first.person.nationIdentifier).toBe('sample-nation');

		const again = await matchSignIn(
			database,
			{ subject: 'google|clerk', email: undefined, emailVerified: false, name: undefined },
			leadAuthorEmail
		);
		expect(again.outcome).toBe('signed-in');

		const otherAccount = await matchSignIn(
			database,
			{ subject: 'account-clerk-password', email: 'reviewer@nation.example', emailVerified: true, name: 'C' },
			leadAuthorEmail
		);
		expect(otherAccount.outcome).toBe('different-account');
	});

	it('ends access at once when a person is removed', async () => {
		const lead = await signInLeadAuthor();
		await invitePerson(database, { email: 'co@example.org', displayName: 'Co Author', role: 'co-author', nationIdentifier: null }, lead);
		const signedIn = await matchSignIn(
			database,
			{ subject: 'google|co', email: 'co@example.org', emailVerified: true, name: 'Co' },
			leadAuthorEmail
		);
		if (signedIn.outcome !== 'signed-in') throw new Error('not signed in');
		await setRemoved(database, signedIn.person.identifier, true, lead);
		expect(await activePersonBySubject(database, 'google|co')).toBeUndefined();
		const result = await matchSignIn(
			database,
			{ subject: 'google|co', email: 'co@example.org', emailVerified: true, name: 'Co' },
			leadAuthorEmail
		);
		expect(result.outcome).toBe('removed');
	});

	it('refuses a nation reviewer without a nation', async () => {
		const lead = await signInLeadAuthor();
		await expect(
			invitePerson(database, { email: 'x@example.org', displayName: 'X', role: 'nation-reviewer', nationIdentifier: null }, lead)
		).rejects.toThrow();
	});
});
