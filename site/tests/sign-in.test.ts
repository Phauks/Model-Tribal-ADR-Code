import type { Cookies } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	checkPassword,
	issueCode,
	linkStillWorks,
	maximumWrongAttempts,
	removePassword,
	sessionAccount,
	setPassword,
	startSession,
	useCode,
	useLink,
	verifiedAccount
} from '#lib/server/accounts.ts';
import { activePersonBySubject } from '#lib/server/people.ts';
import { emailDelivery, signInMessage } from '#lib/server/sign-in-email.ts';
import { passwordProblem, randomCode, sha256 } from '#lib/server/sign-in-secrets.ts';
import { finishSignIn, safeReturnPath } from '#lib/server/sign-in.ts';
import { testDatabase } from './database.ts';

describe('return path after sign-in', () => {
	it('keeps paths inside the site', () => {
		expect(safeReturnPath('/workspace/requests?show=all')).toBe('/workspace/requests?show=all');
	});

	it('refuses addresses that would leave the site', () => {
		for (const candidate of ['https://example.com', '//example.com/x', '/\\example.com', 'workspace', '', null]) {
			expect(safeReturnPath(candidate)).toBe('/workspace');
		}
	});
});

describe('codes and passwords', () => {
	it('makes six-digit codes', () => {
		for (let index = 0; index < 50; index += 1) expect(randomCode()).toMatch(/^\d{6}$/);
	});

	it('asks for long passwords and refuses the email address', () => {
		expect(passwordProblem('short', 'a@example.org')).toMatch(/at least 12/);
		expect(passwordProblem('a@example.org', 'A@example.org ')).toBeDefined();
		expect(passwordProblem('three unrelated words here', 'a@example.org')).toBeUndefined();
	});

	it('puts the code and link in the email', () => {
		const message = signInMessage('123456', 'https://site.example/sign-in/link?token=x');
		expect(message.subject).toContain('123456');
		expect(message.text).toContain('https://site.example/sign-in/link?token=x');
	});
});

describe('how codes are delivered', () => {
	const binding = { send: vi.fn(async () => ({ messageId: 'm' })) };

	it('shows the code on screen on this computer', () => {
		expect(emailDelivery({} as WorkerEnvironment, new URL('http://localhost:8787/sign-in')).kind).toBe('on-screen');
	});

	it('sends nothing until a sending address is set', () => {
		const environment = { signInEmail: binding, SIGN_IN_EMAIL_FROM: '' } as unknown as WorkerEnvironment;
		expect(emailDelivery(environment, new URL('https://site.example/sign-in')).kind).toBe('none');
	});

	it('sends from the configured address', async () => {
		const environment = { signInEmail: binding, SIGN_IN_EMAIL_FROM: 'sign-in@example.org' } as unknown as WorkerEnvironment;
		const delivery = emailDelivery(environment, new URL('https://site.example/sign-in'));
		expect(delivery.kind).toBe('email');
		if (delivery.kind === 'email') await delivery.send('person@example.org', '123456', 'https://site.example/l');
		expect(binding.send).toHaveBeenCalledWith(
			expect.objectContaining({ to: 'person@example.org', from: { email: 'sign-in@example.org', name: 'Model Tribal ADR Code' } })
		);
	});
});

describe('signing in with a code or a link', () => {
	let database: ReturnType<typeof testDatabase>;
	beforeEach(() => {
		database = testDatabase();
	});

	it('accepts the right code once, ignoring case in the address', async () => {
		const issued = await issueCode(database, 'Person@Example.org', 'email');
		expect(await useCode(database, 'person@example.org', issued.code!)).toEqual({
			outcome: 'accepted',
			email: 'person@example.org'
		});
		expect((await useCode(database, 'person@example.org', issued.code!)).outcome).toBe('expired');
	});

	it('stores only hashes of codes and links', async () => {
		const issued = await issueCode(database, 'person@example.org', 'email');
		const row = await database.prepare('SELECT code_hash, link_hash FROM sign_in_codes').first<{ code_hash: string; link_hash: string }>();
		expect(row?.code_hash).not.toContain(issued.code!);
		expect(row?.link_hash).toBe(await sha256(issued.linkToken));
	});

	it('stops a code after too many wrong tries', async () => {
		const issued = await issueCode(database, 'person@example.org', 'email');
		const wrong = issued.code === '000000' ? '111111' : '000000';
		for (let attempt = 1; attempt < maximumWrongAttempts; attempt += 1) {
			expect((await useCode(database, 'person@example.org', wrong)).outcome).toBe('wrong');
		}
		expect((await useCode(database, 'person@example.org', wrong)).outcome).toBe('too-many');
		expect((await useCode(database, 'person@example.org', issued.code!)).outcome).toBe('too-many');
	});

	it('lets only the newest code work', async () => {
		const first = await issueCode(database, 'person@example.org', 'email');
		const second = await issueCode(database, 'person@example.org', 'email');
		if (first.code !== second.code) {
			expect((await useCode(database, 'person@example.org', first.code!)).outcome).toBe('wrong');
		}
		expect((await useCode(database, 'person@example.org', second.code!)).outcome).toBe('accepted');
	});

	it('refuses an expired code', async () => {
		const issued = await issueCode(database, 'person@example.org', 'email');
		await database.prepare("UPDATE sign_in_codes SET expires_at = '2000-01-01T00:00:00.000Z'").run();
		expect((await useCode(database, 'person@example.org', issued.code!)).outcome).toBe('expired');
	});

	it('uses a link once', async () => {
		const issued = await issueCode(database, 'person@example.org', 'invitation');
		expect(issued.code).toBeUndefined();
		expect(await linkStillWorks(database, issued.linkToken)).toBe(true);
		expect(await useLink(database, issued.linkToken)).toEqual({
			outcome: 'accepted',
			email: 'person@example.org',
			origin: 'invitation'
		});
		expect(await linkStillWorks(database, issued.linkToken)).toBe(false);
		expect((await useLink(database, issued.linkToken)).outcome).toBe('expired');
		expect((await useLink(database, 'made-up')).outcome).toBe('expired');
	});

	it('makes one account per address', async () => {
		const first = await verifiedAccount(database, 'person@example.org');
		const second = await verifiedAccount(database, 'PERSON@example.org');
		expect(second.identifier).toBe(first.identifier);
		expect(first.hasPassword).toBe(false);
	});
});

describe('passwords and sessions', () => {
	let database: ReturnType<typeof testDatabase>;
	beforeEach(() => {
		database = testDatabase();
	});

	it('checks a password and signs out other browsers when it changes', async () => {
		const account = await verifiedAccount(database, 'person@example.org');
		expect(await checkPassword(database, 'person@example.org', 'anything at all here')).toBeUndefined();
		const kept = await startSession(database, account.identifier, 'code');
		const other = await startSession(database, account.identifier, 'code');
		const keptHash = (await sessionAccount(database, kept.token))!.tokenHash;

		await setPassword(database, account.identifier, 'correct horse battery staple', keptHash);
		expect((await checkPassword(database, 'Person@example.org', 'correct horse battery staple'))?.identifier).toBe(
			account.identifier
		);
		expect(await checkPassword(database, 'person@example.org', 'wrong horse battery staple')).toBeUndefined();
		expect(await sessionAccount(database, kept.token)).toBeDefined();
		expect(await sessionAccount(database, other.token)).toBeUndefined();

		await removePassword(database, account.identifier, keptHash);
		expect(await checkPassword(database, 'person@example.org', 'correct horse battery staple')).toBeUndefined();
	});

	it('ends a session after four hours without use or twelve hours in all', async () => {
		const account = await verifiedAccount(database, 'person@example.org');
		const idle = await startSession(database, account.identifier, 'code');
		await database
			.prepare('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?')
			.bind(new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), await sha256(idle.token))
			.run();
		expect(await sessionAccount(database, idle.token)).toBeUndefined();

		const old = await startSession(database, account.identifier, 'code');
		await database
			.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?')
			.bind(new Date(Date.now() - 1000).toISOString(), await sha256(old.token))
			.run();
		expect(await sessionAccount(database, old.token)).toBeUndefined();
		expect(await sessionAccount(database, 'made-up')).toBeUndefined();
	});
});

describe('finishing a sign-in', () => {
	function cookieJar(): Cookies & { values: Map<string, string> } {
		const values = new Map<string, string>();
		return {
			values,
			get: (name: string) => values.get(name),
			getAll: () => [...values].map(([name, value]) => ({ name, value })),
			set: (name: string, value: string) => void values.set(name, value),
			delete: (name: string) => void values.delete(name),
			serialize: () => ''
		} as unknown as Cookies & { values: Map<string, string> };
	}

	it('makes the lead author named in the settings, then a newcomer goes to their profile', async () => {
		const database = testDatabase();
		const lead = await verifiedAccount(database, 'lead@example.org');
		const leadCookies = cookieJar();
		expect(await finishSignIn(database, leadCookies, lead, 'code', '/workspace/people', 'Lead@Example.org')).toEqual({
			outcome: 'signed-in',
			destination: '/workspace/people'
		});
		const session = await sessionAccount(database, leadCookies.values.get('session'));
		expect(session?.account.identifier).toBe(lead.identifier);
		expect((await activePersonBySubject(database, lead.identifier))?.role).toBe('lead-author');

		const newcomer = await verifiedAccount(database, 'newcomer@example.org');
		expect(await finishSignIn(database, cookieJar(), newcomer, 'code', '/workspace', 'lead@example.org')).toEqual({
			outcome: 'signed-in',
			destination: '/profile'
		});
		expect(await activePersonBySubject(database, newcomer.identifier)).toBeUndefined();
		// A newcomer who signed in to follow a page goes back to it.
		expect(await finishSignIn(database, cookieJar(), newcomer, 'code', '/nations/navajo-nation', 'lead@example.org')).toEqual({
			outcome: 'signed-in',
			destination: '/nations/navajo-nation'
		});
	});

	it('does not sign in someone whose access was removed', async () => {
		const database = testDatabase();
		const account = await verifiedAccount(database, 'gone@example.org');
		await database
			.prepare(
				`INSERT INTO people (identifier, sign_in_subject, email, display_name, role, status, added_at)
				 VALUES ('p', ?, 'gone@example.org', 'Gone', 'co-author', 'removed', '2026-01-01')`
			)
			.bind(account.identifier)
			.run();
		const cookies = cookieJar();
		expect(await finishSignIn(database, cookies, account, 'password', '/workspace', undefined)).toEqual({
			outcome: 'refused',
			reason: 'removed'
		});
		expect(cookies.values.has('session')).toBe(false);
	});
});
