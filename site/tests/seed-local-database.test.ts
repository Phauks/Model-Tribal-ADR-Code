import { describe, expect, it } from 'vitest';
import { checkPassword, sessionAccount } from '#lib/server/accounts.ts';
import { activePersonBySubject } from '#lib/server/people.ts';
import { matchingStep, openSecret } from '#lib/server/two-step.ts';
import {
	currentCode,
	fixtureAccounts,
	fixturePassword,
	fixtureSessions,
	fixtureStatements
} from '../tools/seed-local-database.mjs';
import { testDatabase } from './database.ts';

/** The local fixtures (tools/seed-local-database.mjs), loaded into the in-memory database with the real migrations. */
async function seeded() {
	const database = testDatabase();
	const { statements } = await fixtureStatements();
	for (const statement of statements) await database.prepare(statement).run();
	return database;
}

describe('local database fixtures', () => {
	it('fit the migrations, and loading them twice changes nothing', async () => {
		const database = await seeded();
		const { statements } = await fixtureStatements();
		for (const statement of statements) await database.prepare(statement).run();
		const people = await database.prepare('SELECT COUNT(*) AS count FROM people').first<{ count: number }>();
		expect(people?.count).toBe(Object.values(fixtureAccounts).filter((account) => account.role).length);
	});

	it('use only example.org addresses', () => {
		for (const account of Object.values(fixtureAccounts)) expect(account.email).toMatch(/@example\.org$/);
	});

	it('sign in with the shared password and two-step code', async () => {
		const database = await seeded();
		const account = await checkPassword(database, fixtureAccounts.leadAuthor.email, fixturePassword);
		expect(account?.hasTwoStep).toBe(true);
		const stored = await database
			.prepare('SELECT authenticator_secret AS secret FROM accounts WHERE email = ?')
			.bind(fixtureAccounts.leadAuthor.email)
			.first<{ secret: string }>();
		const secret = await openSecret(stored!.secret, undefined);
		expect(await matchingStep(secret!, await currentCode(), null)).toBeDefined();
	});

	it('start sessions that reach the workspace', async () => {
		const database = await seeded();
		const { statements, tokens } = fixtureSessions(['leadAuthor', 'reader']);
		for (const statement of statements) await database.prepare(statement).run();
		const lead = await sessionAccount(database, tokens.leadAuthor);
		expect(lead?.secondStep).toBe('done');
		expect((await activePersonBySubject(database, lead!.account.identifier))?.role).toBe('lead-author');
		const reader = await sessionAccount(database, tokens.reader);
		expect(await activePersonBySubject(database, reader!.account.identifier)).toBeUndefined();
	});
});
