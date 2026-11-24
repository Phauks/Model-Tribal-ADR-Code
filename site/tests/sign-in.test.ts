import type { Cookies } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	accountByEmail,
	adoptWaitingPassword,
	checkPassword,
	failuresBeforeOff,
	failuresBeforePause,
	issueCode,
	linkStillWorks,
	maximumWrongAttempts,
	provedRecently,
	removePassword,
	sessionAccount,
	sessionCookie,
	setPassword,
	startSession,
	tryPassword,
	usablePasswordKey,
	useCode,
	useLink,
	verifiedAccount,
	waitingPassword,
	waitingPasswordFor
} from '#lib/server/accounts.ts';
import { activePersonBySubject } from '#lib/server/people.ts';
import { emailDelivery, signInMessage } from '#lib/server/sign-in-email.ts';
import { newPasswordProblem, timesBreached } from '#lib/server/password-checks.ts';
import { passwordHash, randomCode, sha256 } from '#lib/server/sign-in-secrets.ts';
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

	/** A stand-in for the Pwned Passwords range service that knows one breached password. */
	function pwnedService(breached: string, status = 200) {
		return vi.fn(async (address: string | URL | Request, init?: RequestInit) => {
			expect(new Headers(init?.headers).get('add-padding')).toBe('true');
			const prefix = String(address).split('/').pop()!;
			const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(breached));
			const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
			// Only the first five characters of the hash are ever sent.
			expect(prefix).toHaveLength(5);
			const lines = ['0018A45C4D1DEF81644B54AB7F969B88D65:0', '00D4F6E8FA6EECAD2A3AA415EEC418D38EC:2'];
			if (hash.startsWith(prefix)) lines.push(`${hash.slice(5)}:3861`);
			return new Response(lines.join('\r\n'), { status });
		}) as unknown as typeof fetch;
	}

	it('asks for 15 characters, counting each character once', async () => {
		const service = pwnedService('nothing here');
		expect(await newPasswordProblem('fourteen chars', 'a@example.org', service)).toMatch(/at least 15 .*has 14/);
		expect(await newPasswordProblem('ñandú ñandú ñandú', 'a@example.org', service)).toBeUndefined();
		expect(await newPasswordProblem('kettle river paper moon', 'a@example.org', service)).toBeUndefined();
	});

	it('refuses the whole email address, its name part and the site name, but not words inside a password', async () => {
		const service = pwnedService('nothing here');
		expect(await newPasswordProblem('Long.Person@Example.org', 'long.person@example.org', service)).toMatch(/email address/);
		expect(await newPasswordProblem('longperson-name-here', 'longperson.name.here@example.org', service)).toMatch(/email address/);
		expect(await newPasswordProblem('Model Tribal ADR Code', 'a@example.org', service)).toMatch(/name of this site/);
		expect(await newPasswordProblem('my model tribal adr code notes', 'a@example.org', service)).toBeUndefined();
		expect(await newPasswordProblem('aaaaaaaaaaaaaaabbbb', 'a@example.org', service)).toMatch(/over and over/);
	});

	it('refuses a password seen in breaches, sending only the start of its hash', async () => {
		const service = pwnedService('ilovemyfamily2024');
		expect(await timesBreached('ilovemyfamily2024', service)).toBe(3861);
		expect(await timesBreached('a different long password', service)).toBe(0);
		expect(await newPasswordProblem('ilovemyfamily2024', 'a@example.org', service)).toMatch(/data breaches/);
	});

	it('allows the password when the breach service cannot be reached', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		expect(await timesBreached('kettle river paper moon', pwnedService('x', 503))).toBeUndefined();
		const broken = vi.fn(async () => {
			throw new TypeError('network down');
		}) as unknown as typeof fetch;
		expect(await newPasswordProblem('kettle river paper moon', 'a@example.org', broken)).toBeUndefined();
		warn.mockRestore();
	});

	it('says in the email when the code is for a new account', () => {
		const message = signInMessage('123456', 'https://site.example/sign-in/link?token=x', 'new-account');
		expect(message.subject).toMatch(/^Confirm your email address/);
		expect(message.subject).toContain('123456');
		expect(message.text).toContain('Your account is made when you use one.');
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
		const session = await sessionAccount(database, leadCookies.values.get(sessionCookie));
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
		expect(cookies.values.has(sessionCookie)).toBe(false);
	});
});

describe('password storage and wrong passwords', () => {
	let database: ReturnType<typeof testDatabase>;
	beforeEach(() => {
		database = testDatabase();
	});

	const key = 'a-test-password-key-of-at-least-32-characters';

	async function stored(email: string) {
		return database
			.prepare('SELECT password_hash AS hash, password_iterations AS iterations, password_keyed AS keyed FROM accounts WHERE email = ?')
			.bind(email)
			.first<{ hash: string; iterations: number; keyed: number }>();
	}

	it('makes a 100,000-round hash exactly as before, so older passwords still work', async () => {
		const enc = new TextEncoder();
		const raw = await crypto.subtle.importKey('raw', enc.encode('correct horse battery staple'), 'PBKDF2', false, ['deriveBits']);
		const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('salt'), iterations: 100_000 }, raw, 256);
		const before = Array.from(new Uint8Array(bits), (byte) => byte.toString(16).padStart(2, '0')).join('');
		expect(await passwordHash('correct horse battery staple', 'salt', 100_000)).toBe(before);
		expect(await passwordHash('correct horse battery staple', 'salt', 600_000)).not.toBe(before);
		expect(await passwordHash('correct horse battery staple', 'salt', 600_000, key)).not.toBe(
			await passwordHash('correct horse battery staple', 'salt', 600_000)
		);
	});

	it('upgrades an older password to 600,000 rounds and the key at the next sign-in', async () => {
		const account = await verifiedAccount(database, 'old@example.org');
		const oldHash = await passwordHash('an older password here', 'old-salt', 100_000);
		await database
			.prepare("UPDATE accounts SET password_hash = ?, password_salt = 'old-salt', password_iterations = 100000 WHERE identifier = ?")
			.bind(oldHash, account.identifier)
			.run();
		expect((await checkPassword(database, 'old@example.org', 'an older password here', key))?.identifier).toBe(account.identifier);
		expect(await stored('old@example.org')).toMatchObject({ iterations: 600_000, keyed: 1 });
		expect(await checkPassword(database, 'old@example.org', 'an older password here', key)).toBeDefined();
		// A keyed hash cannot be checked without the key.
		vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(await checkPassword(database, 'old@example.org', 'an older password here')).toBeUndefined();
	});

	it('ignores a password key that is too short to be safe', () => {
		expect(usablePasswordKey(undefined)).toBeUndefined();
		expect(usablePasswordKey('short')).toBeUndefined();
		expect(usablePasswordKey(` ${key} `)).toBe(key);
	});

	it('pauses password sign-in after 10 wrong passwords, for an address with or without an account', async () => {
		const account = await verifiedAccount(database, 'person@example.org');
		await setPassword(database, account.identifier, 'kettle river paper moon', undefined);
		for (const address of ['person@example.org', 'nobody@example.org']) {
			for (let count = 1; count < failuresBeforePause; count += 1) {
				expect((await tryPassword(database, address, 'wrong guess number')).outcome).toBe('wrong');
			}
			expect((await tryPassword(database, address, 'wrong guess number')).outcome).toBe('paused');
		}
		// While paused, even the right password is not checked.
		expect((await tryPassword(database, 'Person@example.org', 'kettle river paper moon')).outcome).toBe('paused');

		await database.prepare("UPDATE password_failures SET paused_until = '2000-01-01T00:00:00.000Z'").run();
		expect((await tryPassword(database, 'person@example.org', 'kettle river paper moon')).outcome).toBe('accepted');
		const left = await database.prepare('SELECT COUNT(*) AS count FROM password_failures WHERE email = ?').bind('person@example.org').first<{ count: number }>();
		expect(left?.count).toBe(0);
	});

	it('doubles each pause', async () => {
		await database
			.prepare("INSERT INTO password_failures (email, consecutive, last_failed_at) VALUES ('p@example.org', 19, '2026-01-01')")
			.run();
		const before = Date.now();
		const result = await tryPassword(database, 'p@example.org', 'wrong guess number');
		expect(result.outcome).toBe('paused');
		const minutes = (Date.parse((result as { until: string }).until) - before) / 60_000;
		expect(minutes).toBeGreaterThan(29);
		expect(minutes).toBeLessThan(31);
	});

	it('switches password sign-in off after 100 wrong passwords until a new one is chosen', async () => {
		const account = await verifiedAccount(database, 'person@example.org');
		await setPassword(database, account.identifier, 'kettle river paper moon', undefined);
		await database
			.prepare("INSERT INTO password_failures (email, consecutive, last_failed_at) VALUES ('person@example.org', ?, '2026-01-01')")
			.bind(failuresBeforeOff - 1)
			.run();
		expect((await tryPassword(database, 'person@example.org', 'wrong guess number')).outcome).toBe('off');
		expect((await tryPassword(database, 'person@example.org', 'kettle river paper moon')).outcome).toBe('off');
		await setPassword(database, account.identifier, 'a brand new long password', undefined);
		expect((await tryPassword(database, 'person@example.org', 'a brand new long password')).outcome).toBe('accepted');
	});

	it('lets a recent code or link sign-in replace a forgotten password', async () => {
		const account = await verifiedAccount(database, 'person@example.org');
		const byCode = await startSession(database, account.identifier, 'code');
		const byPassword = await startSession(database, account.identifier, 'password');
		const codeSession = await sessionAccount(database, byCode.token);
		expect(codeSession?.method).toBe('code');
		expect(provedRecently(codeSession)).toBe(true);
		expect(provedRecently(codeSession, Date.now() + 11 * 60 * 1000)).toBe(false);
		expect(provedRecently(await sessionAccount(database, byPassword.token))).toBe(false);
		expect(provedRecently(undefined)).toBe(false);
	});
});

describe('creating an account', () => {
	let database: ReturnType<typeof testDatabase>;
	beforeEach(() => {
		database = testDatabase();
	});

	it('makes the account, with the chosen password, only when the code is used', async () => {
		const chosen = await waitingPassword('kettle river paper moon', undefined);
		const issued = await issueCode(database, 'new@example.org', 'email', null, chosen);
		expect(await accountByEmail(database, 'new@example.org')).toBeUndefined();
		const row = await database.prepare('SELECT new_password_hash AS hash FROM sign_in_codes').first<{ hash: string }>();
		expect(row?.hash).toBe(chosen.hash);
		expect(row?.hash).not.toContain('kettle');

		const result = await useCode(database, 'new@example.org', issued.code!);
		expect(result).toEqual({ outcome: 'accepted', email: 'new@example.org', newPassword: chosen });
		const account = await verifiedAccount(database, 'new@example.org');
		expect(await adoptWaitingPassword(database, account.identifier, chosen)).toBe(true);
		expect((await checkPassword(database, 'new@example.org', 'kettle river paper moon'))?.identifier).toBe(account.identifier);
		// The waiting password went with the code.
		expect(await database.prepare('SELECT COUNT(*) AS count FROM sign_in_codes').first<{ count: number }>()).toEqual({ count: 0 });
	});

	it('gives the chosen password through the link in the email too', async () => {
		const chosen = await waitingPassword('kettle river paper moon', undefined);
		const issued = await issueCode(database, 'new@example.org', 'email', null, chosen);
		const result = await useLink(database, issued.linkToken);
		expect(result).toEqual({ outcome: 'accepted', email: 'new@example.org', origin: 'email', newPassword: chosen });
	});

	it('never replaces the password an account already has', async () => {
		const account = await verifiedAccount(database, 'person@example.org');
		await setPassword(database, account.identifier, 'the old password stays', undefined);
		const chosen = await waitingPassword('kettle river paper moon', undefined);
		expect(await adoptWaitingPassword(database, account.identifier, chosen)).toBe(false);
		expect(await checkPassword(database, 'person@example.org', 'the old password stays')).toBeDefined();
		expect(await checkPassword(database, 'person@example.org', 'kettle river paper moon')).toBeUndefined();
	});

	it('keeps the chosen password when a new code is sent from the confirm step', async () => {
		const chosen = await waitingPassword('kettle river paper moon', undefined);
		await issueCode(database, 'new@example.org', 'email', null, chosen);
		const kept = await waitingPasswordFor(database, 'New@example.org');
		expect(kept).toEqual(chosen);
		const again = await issueCode(database, 'new@example.org', 'email', null, kept);
		const result = await useCode(database, 'new@example.org', again.code!);
		expect(result).toEqual({ outcome: 'accepted', email: 'new@example.org', newPassword: chosen });
		expect(await waitingPasswordFor(database, 'other@example.org')).toBeUndefined();
	});

	it('drops a waiting password when a plain code is asked for after it', async () => {
		const chosen = await waitingPassword('kettle river paper moon', undefined);
		await issueCode(database, 'new@example.org', 'email', null, chosen);
		const plain = await issueCode(database, 'new@example.org', 'email');
		const result = await useCode(database, 'new@example.org', plain.code!);
		expect(result.outcome === 'accepted' && result.newPassword).toBeFalsy();
	});
});
