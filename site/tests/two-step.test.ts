import type { Cookies } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import { needsTwoStep, roles } from '#lib/permissions.ts';
import {
	lastingSessionDays,
	pastWorkspaceLimits,
	sessionAccount,
	sessionCookie,
	signedInRecently,
	startSession,
	verifiedAccount
} from '#lib/server/accounts.ts';
import { scanCode } from '#lib/server/scan-code.ts';
import { finishSignIn } from '#lib/server/sign-in.ts';
import {
	authenticatorCode,
	authenticatorLink,
	base32,
	cleanBackupCode,
	finishAuthenticatorSetUp,
	fromBase32,
	matchingStep,
	newBackupCodes,
	openSecret,
	sealSecret,
	startAuthenticatorSetUp,
	stepAt,
	trySecondStep,
	turnOffTwoStep,
	twoStepState,
	wrongSecondStepsAllowed
} from '#lib/server/two-step.ts';
import { testDatabase } from './database.ts';

const key = 'k'.repeat(40);

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

describe('authenticator codes', () => {
	// RFC 6238, appendix B: the SHA-1 secret "12345678901234567890" gives
	// these eight-digit codes; the last six digits are the six-digit codes.
	const rfcSecret = base32(new TextEncoder().encode('12345678901234567890'));
	const vectors: [number, string][] = [
		[59, '94287082'],
		[1111111109, '07081804'],
		[1111111111, '14050471'],
		[1234567890, '89005924'],
		[2000000000, '69279037']
	];

	it('matches the RFC 6238 test values', async () => {
		for (const [seconds, eightDigits] of vectors) {
			expect(await authenticatorCode(rfcSecret, stepAt(seconds * 1000))).toBe(eightDigits.slice(2));
		}
	});

	it('reads base32 back', () => {
		const bytes = crypto.getRandomValues(new Uint8Array(20));
		expect([...fromBase32(base32(bytes))]).toEqual([...bytes]);
	});

	it('accepts the step before and after, and never a used step again', async () => {
		const time = 1_800_000_000_000;
		const step = stepAt(time);
		const before = await authenticatorCode(rfcSecret, step - 1);
		const after = await authenticatorCode(rfcSecret, step + 1);
		const tooOld = await authenticatorCode(rfcSecret, step - 2);
		expect(await matchingStep(rfcSecret, before, null, time)).toBe(step - 1);
		expect(await matchingStep(rfcSecret, after, null, time)).toBe(step + 1);
		expect(await matchingStep(rfcSecret, tooOld, null, time)).toBeUndefined();
		expect(await matchingStep(rfcSecret, before, step - 1, time)).toBeUndefined();
		expect(await matchingStep(rfcSecret, 'abcdef', null, time)).toBeUndefined();
	});

	it('makes the address authenticator apps read', () => {
		const link = authenticatorLink('ABCDEFGH', 'person@example.org');
		expect(link).toBe(
			'otpauth://totp/Tribal%20Law%20Project%3Aperson%40example.org?secret=ABCDEFGH&issuer=Tribal%20Law%20Project&algorithm=SHA1&digits=6&period=30'
		);
		const code = scanCode(link);
		expect(code.size).toBeGreaterThanOrEqual(21);
		expect(code.path).toMatch(/^M\d+ \d+h1v1h-1z/);
	});
});

describe('keeping the secret', () => {
	it('encrypts with the key and opens with the same key only', async () => {
		const sealed = await sealSecret('ABCDEFGH', key);
		expect(sealed.startsWith('sealed:')).toBe(true);
		expect(sealed).not.toContain('ABCDEFGH');
		expect(await openSecret(sealed, key)).toBe('ABCDEFGH');
		expect(await openSecret(sealed, 'x'.repeat(40))).toBeUndefined();
		expect(await openSecret(sealed, undefined)).toBeUndefined();
	});

	it('keeps it as it is without a key', async () => {
		const plain = await sealSecret('ABCDEFGH', undefined);
		expect(plain).toBe('plain:ABCDEFGH');
		expect(await openSecret(plain, undefined)).toBe('ABCDEFGH');
		expect(await openSecret(plain, key)).toBe('ABCDEFGH');
	});
});

describe('backup codes', () => {
	it('makes ten different codes that are easy to read', () => {
		const codes = newBackupCodes();
		expect(codes).toHaveLength(10);
		expect(new Set(codes).size).toBe(10);
		for (const code of codes) expect(code).toMatch(/^[0-9a-hjkmnp-tv-z]{5}-[0-9a-hjkmnp-tv-z]{5}$/);
	});

	it('forgives capitals, spaces and misread letters', () => {
		expect(cleanBackupCode(' 7K2MQ X9D4O ')).toBe('7k2mqx9d40');
		expect(cleanBackupCode('abcIl-12345')).toBe('abc1112345');
	});
});

describe('setting up and using two-step sign-in', () => {
	async function setUp(database: ReturnType<typeof testDatabase>, email: string, time: number) {
		const account = await verifiedAccount(database, email);
		const here = await startSession(database, account.identifier, 'password');
		const elsewhere = await startSession(database, account.identifier, 'code');
		const hereHash = (await sessionAccount(database, here.token))!.tokenHash;
		const secret = await startAuthenticatorSetUp(database, account.identifier, key);
		expect(await finishAuthenticatorSetUp(database, account.identifier, 'abcdef', key, hereHash, time)).toEqual({ outcome: 'wrong' });
		const result = await finishAuthenticatorSetUp(
			database,
			account.identifier,
			await authenticatorCode(secret, stepAt(time)),
			key,
			hereHash,
			time
		);
		if (result.outcome !== 'done') throw new Error('not set up');
		return { account, secret, here, elsewhere, backupCodes: result.backupCodes };
	}

	it('turns on with a code from the app, signs out other browsers and gives backup codes', async () => {
		const database = testDatabase();
		const time = Date.now();
		const { account, here, elsewhere, backupCodes } = await setUp(database, 'two@example.org', time);
		expect(backupCodes).toHaveLength(10);
		expect(await twoStepState(database, account.identifier)).toMatchObject({ on: true, backupCodesLeft: 10 });
		expect((await sessionAccount(database, here.token))?.secondStep).toBe('done');
		expect(await sessionAccount(database, elsewhere.token)).toBeUndefined();
		const stored = await database
			.prepare('SELECT authenticator_secret AS stored FROM accounts WHERE identifier = ?')
			.bind(account.identifier)
			.first<{ stored: string }>();
		expect(stored?.stored.startsWith('sealed:')).toBe(true);
	});

	it('sends the next sign-in to the second step, which takes an app code once', async () => {
		const database = testDatabase();
		const time = Date.now();
		const { secret } = await setUp(database, 'next@example.org', time - 5 * 60_000);
		const account = await verifiedAccount(database, 'next@example.org');
		expect(account.hasTwoStep).toBe(true);
		const cookies = cookieJar();
		expect(await finishSignIn(database, cookies, account, 'password', '/profile', undefined)).toEqual({
			outcome: 'signed-in',
			destination: '/sign-in/two-step?returnTo=%2Fprofile'
		});
		const waiting = (await sessionAccount(database, cookies.values.get(sessionCookie)))!;
		expect(waiting.secondStep).toBe('waiting');

		const code = await authenticatorCode(secret, stepAt(time));
		expect(await trySecondStep(database, account.identifier, waiting.tokenHash, code, key, time)).toMatchObject({
			outcome: 'accepted',
			usedBackupCode: false
		});
		expect((await sessionAccount(database, cookies.values.get(sessionCookie)))?.secondStep).toBe('done');

		// The same code does not work for a second sign-in.
		const again = cookieJar();
		await finishSignIn(database, again, account, 'password', '/profile', undefined);
		const second = (await sessionAccount(database, again.values.get(sessionCookie)))!;
		expect(await trySecondStep(database, account.identifier, second.tokenHash, code, key, time)).toEqual({ outcome: 'wrong' });
	});

	it('takes each backup code once', async () => {
		const database = testDatabase();
		const time = Date.now();
		const { account, backupCodes } = await setUp(database, 'backup@example.org', time);
		const first = await startSession(database, account.identifier, 'password', { secondStep: 'waiting' });
		const firstHash = (await sessionAccount(database, first.token))!.tokenHash;
		expect(await trySecondStep(database, account.identifier, firstHash, backupCodes[0].toUpperCase(), key, time)).toEqual({
			outcome: 'accepted',
			usedBackupCode: true,
			backupCodesLeft: 9
		});
		const second = await startSession(database, account.identifier, 'password', { secondStep: 'waiting' });
		const secondHash = (await sessionAccount(database, second.token))!.tokenHash;
		expect(await trySecondStep(database, account.identifier, secondHash, backupCodes[0], key, time)).toEqual({ outcome: 'wrong' });
	});

	it('ends the sign-in after five wrong codes', async () => {
		const database = testDatabase();
		const time = Date.now();
		const { account } = await setUp(database, 'wrong@example.org', time);
		const started = await startSession(database, account.identifier, 'password', { secondStep: 'waiting' });
		const hash = (await sessionAccount(database, started.token))!.tokenHash;
		for (let attempt = 1; attempt < wrongSecondStepsAllowed; attempt += 1) {
			expect((await trySecondStep(database, account.identifier, hash, 'zzzzz-zzzzz', key, time)).outcome).toBe('wrong');
		}
		expect((await trySecondStep(database, account.identifier, hash, 'zzzzz-zzzzz', key, time)).outcome).toBe('too-many');
		expect(await sessionAccount(database, started.token)).toBeUndefined();
	});

	it('turns off and deletes the backup codes', async () => {
		const database = testDatabase();
		const { account } = await setUp(database, 'off@example.org', Date.now());
		await turnOffTwoStep(database, account.identifier);
		expect(await twoStepState(database, account.identifier)).toEqual({ on: false, addedAt: null, backupCodesLeft: 0 });
		expect((await verifiedAccount(database, 'off@example.org')).hasTwoStep).toBe(false);
	});

	it('encrypts a secret kept as it is once the key is set', async () => {
		const database = testDatabase();
		const time = Date.now();
		const account = await verifiedAccount(database, 'later@example.org');
		const here = await startSession(database, account.identifier, 'password');
		const hash = (await sessionAccount(database, here.token))!.tokenHash;
		const secret = await startAuthenticatorSetUp(database, account.identifier, undefined);
		await finishAuthenticatorSetUp(database, account.identifier, await authenticatorCode(secret, stepAt(time)), undefined, hash, time);
		const started = await startSession(database, account.identifier, 'password', { secondStep: 'waiting' });
		const waitingHash = (await sessionAccount(database, started.token))!.tokenHash;
		const later = time + 30_000;
		expect((await trySecondStep(database, account.identifier, waitingHash, await authenticatorCode(secret, stepAt(later)), key, later)).outcome).toBe('accepted');
		const stored = await database
			.prepare('SELECT authenticator_secret AS stored FROM accounts WHERE identifier = ?')
			.bind(account.identifier)
			.first<{ stored: string }>();
		expect(stored?.stored.startsWith('sealed:')).toBe(true);
	});
});

describe('who needs two-step sign-in, and how long sessions last', () => {
	it('is needed by the lead author, editors, advisors and nation reviewers', () => {
		expect(roles.filter(needsTwoStep)).toEqual(['lead-author', 'editor', 'advisor', 'nation-reviewer']);
	});

	it('keeps a contributor without workspace access signed in for 30 days if asked, never someone with workspace access', async () => {
		const database = testDatabase();
		const lead = await verifiedAccount(database, 'lead@example.org');
		const leadCookies = cookieJar();
		await finishSignIn(database, leadCookies, lead, 'code', '/workspace', 'lead@example.org', { keep: true });
		const leadSession = (await sessionAccount(database, leadCookies.values.get(sessionCookie)))!;
		expect(leadSession.lasting).toBe(false);

		const reader = await verifiedAccount(database, 'reader@example.org');
		const readerCookies = cookieJar();
		await finishSignIn(database, readerCookies, reader, 'code', '/nations/navajo-nation', 'lead@example.org', { keep: true });
		const readerSession = (await sessionAccount(database, readerCookies.values.get(sessionCookie)))!;
		expect(readerSession.lasting).toBe(true);
		const days = (Date.parse(readerSession.expiresAt) - Date.parse(readerSession.startedAt)) / 86_400_000;
		expect(Math.round(days)).toBe(lastingSessionDays);
	});

	it('ends a lasting session at the workspace limits if the person gains access', () => {
		const time = Date.parse('2026-11-23T12:00:00Z');
		const base = { startedAt: '2026-11-23T11:00:00Z', lastSeenAt: '2026-11-23T11:55:00Z' };
		expect(pastWorkspaceLimits(base as never, time)).toBe(false);
		expect(pastWorkspaceLimits({ ...base, startedAt: '2026-11-22T11:00:00Z' } as never, time)).toBe(true);
		expect(pastWorkspaceLimits({ ...base, lastSeenAt: '2026-11-23T07:00:00Z' } as never, time)).toBe(true);
	});

	it('counts a sign-in from the last 10 minutes as recent', () => {
		const time = Date.parse('2026-11-23T12:00:00Z');
		expect(signedInRecently({ startedAt: '2026-11-23T11:55:00Z' } as never, time)).toBe(true);
		expect(signedInRecently({ startedAt: '2026-11-23T11:45:00Z' } as never, time)).toBe(false);
		expect(signedInRecently(undefined, time)).toBe(false);
	});
});
