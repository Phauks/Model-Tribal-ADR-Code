import { describe, expect, it } from 'vitest';
import { verifiedAccount, startSession, sessionAccount } from '../src/lib/server/accounts.ts';
import {
	accountForIdentity,
	availableProviders,
	connect,
	connectedSignIns,
	disconnect,
	identityFrom,
	personalMicrosoftTenant
} from '../src/lib/server/outside-sign-in.ts';
import { passkeyName, passkeysOf, removePasskey } from '../src/lib/server/passkeys.ts';
import { checkTurnstile, turnstileSiteKey } from '../src/lib/server/turnstile.ts';
import { testDatabase } from './database.ts';

const turnstileOn = { TURNSTILE_SITE_KEY: 'site-key', TURNSTILE_SECRET_KEY: 'secret', TURNSTILE_HOSTNAMES: 'triballawproject.org' };

function formWith(token?: string): FormData {
	const form = new FormData();
	if (token !== undefined) form.set('cf-turnstile-response', token);
	return form;
}

function answering(body: unknown, status = 200): typeof fetch {
	return (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
}

describe('the "are you a person?" check (Turnstile)', () => {
	it('is off until both the site key and the secret are set', async () => {
		expect(turnstileSiteKey({ TURNSTILE_SITE_KEY: 'site-key' })).toBeUndefined();
		expect(turnstileSiteKey(turnstileOn)).toBe('site-key');
		const result = await checkTurnstile({ TURNSTILE_SITE_KEY: 'site-key' }, formWith(), 'sign_in', null);
		expect(result.outcome).toBe('off');
	});

	it('passes a good token for the right form and host', async () => {
		const send = answering({ success: true, action: 'sign_in', hostname: 'triballawproject.org' });
		expect((await checkTurnstile(turnstileOn, formWith('token'), 'sign_in', '192.0.2.1', send)).outcome).toBe('passed');
	});

	it('accepts any of several forms when an action serves more than one', async () => {
		const send = answering({ success: true, action: 'forgot_password', hostname: 'triballawproject.org' });
		const result = await checkTurnstile(turnstileOn, formWith('token'), ['sign_in', 'forgot_password'], null, send);
		expect(result.outcome).toBe('passed');
	});

	it('refuses a missing token, a failed token, another form, another host and no answer', async () => {
		const good = { success: true, action: 'sign_in', hostname: 'triballawproject.org' };
		expect((await checkTurnstile(turnstileOn, formWith(), 'sign_in', null, answering(good))).outcome).toBe('refused');
		expect((await checkTurnstile(turnstileOn, formWith('token'), 'sign_in', null, answering({ success: false, 'error-codes': ['timeout-or-duplicate'] }))).outcome).toBe('refused');
		expect((await checkTurnstile(turnstileOn, formWith('token'), 'sign_in', null, answering({ ...good, action: 'request' }))).outcome).toBe('refused');
		expect((await checkTurnstile(turnstileOn, formWith('token'), 'sign_in', null, answering({ ...good, hostname: 'localhost' }))).outcome).toBe('refused');
		expect((await checkTurnstile(turnstileOn, formWith('token'), 'sign_in', null, answering({}, 500))).outcome).toBe('refused');
		const failing = (async () => {
			throw new Error('offline');
		}) as typeof fetch;
		expect((await checkTurnstile(turnstileOn, formWith('token'), 'sign_in', null, failing)).outcome).toBe('refused');
	});

	it('refuses everything when no host names are set', async () => {
		const send = answering({ success: true, action: 'sign_in', hostname: 'triballawproject.org' });
		const result = await checkTurnstile({ ...turnstileOn, TURNSTILE_HOSTNAMES: '' }, formWith('token'), 'sign_in', null, send);
		expect(result.outcome).toBe('refused');
	});
});

describe('Google and Microsoft sign-in', () => {
	it('is off until a provider has both its client identifier and its secret', () => {
		expect(availableProviders({})).toEqual([]);
		expect(availableProviders({ GOOGLE_CLIENT_ID: 'id' })).toEqual([]);
		expect(availableProviders({ GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 's', MICROSOFT_CLIENT_ID: '' })).toEqual(['google']);
	});

	it('reads who the person is, and whether the provider confirms their address', () => {
		expect(identityFrom('google', { sub: '123', email: 'dana@example.org', email_verified: true })).toEqual({
			provider: 'google',
			subject: '123',
			email: 'dana@example.org',
			emailVerified: true
		});
		expect(identityFrom('google', { sub: '123', email: 'dana@example.org' })?.emailVerified).toBe(false);
		expect(identityFrom('google', { email: 'dana@example.org' })).toBeUndefined();
		const work = identityFrom('microsoft', { tid: 'tenant', oid: 'object', email: 'dana@nation.gov' });
		expect(work).toMatchObject({ subject: 'tenant:object', emailVerified: false });
		expect(identityFrom('microsoft', { tid: 'tenant', oid: 'object', email: 'dana@nation.gov', xms_edov: true })?.emailVerified).toBe(true);
		expect(identityFrom('microsoft', { tid: personalMicrosoftTenant, oid: 'o', email: 'dana@outlook.com' })?.emailVerified).toBe(true);
	});

	it('joins a confirmed address to its account the first time, and by identifier afterwards', async () => {
		const database = testDatabase();
		const existing = await verifiedAccount(database, 'dana@example.org');
		const first = await accountForIdentity(database, { provider: 'google', subject: 'g-1', email: 'dana@example.org', emailVerified: true });
		expect(first).toMatchObject({ outcome: 'account', account: { identifier: existing.identifier } });
		// The Google address changed since, but the identifier still finds the account.
		const later = await accountForIdentity(database, { provider: 'google', subject: 'g-1', email: 'dana@new.example', emailVerified: true });
		expect(later).toMatchObject({ outcome: 'account', account: { identifier: existing.identifier } });
		expect((await connectedSignIns(database, existing.identifier)).map((row) => row.email)).toEqual(['dana@new.example']);
	});

	it('never joins an unconfirmed address to an account', async () => {
		const database = testDatabase();
		await verifiedAccount(database, 'dana@nation.gov');
		const result = await accountForIdentity(database, { provider: 'microsoft', subject: 't:o', email: 'dana@nation.gov', emailVerified: false });
		expect(result).toEqual({ outcome: 'refused', reason: 'unverified-email' });
	});

	it('connects a provider to one account only, and disconnects it', async () => {
		const database = testDatabase();
		const dana = await verifiedAccount(database, 'dana@example.org');
		const lee = await verifiedAccount(database, 'lee@example.org');
		const identity = { provider: 'microsoft' as const, subject: 't:o', email: 'shared@nation.gov', emailVerified: false };
		expect(await connect(database, dana.identifier, identity)).toBe(true);
		expect(await connect(database, lee.identifier, identity)).toBe(false);
		expect(await accountForIdentity(database, identity)).toMatchObject({ outcome: 'account', account: { identifier: dana.identifier } });
		expect(await disconnect(database, dana.identifier, 'microsoft')).toBe(true);
		expect(await disconnect(database, dana.identifier, 'microsoft')).toBe(false);
	});
});

describe('passkeys', () => {
	it('names the password manager that holds a passkey, or calls it a passkey', () => {
		expect(passkeyName('fbfc3007-154e-4ecc-8c0b-6e020557d7bd')).toBe('Apple Passwords');
		expect(passkeyName('EA9B8D66-4D01-1D21-3CE4-B6B48CB575D4')).toBe('Google Password Manager');
		expect(passkeyName('00000000-0000-0000-0000-000000000000')).toBe('Passkey');
		expect(passkeyName(undefined)).toBe('Passkey');
	});

	it('lists and removes only the account’s own passkeys', async () => {
		const database = testDatabase();
		const dana = await verifiedAccount(database, 'dana@example.org');
		const lee = await verifiedAccount(database, 'lee@example.org');
		await database
			.prepare(
				`INSERT INTO passkeys (credential_id, account_identifier, public_key, name, device, created_at)
				 VALUES ('credential-1', ?, 'key', 'Apple Passwords', 'Safari on Mac', '2026-11-26T00:00:00Z')`
			)
			.bind(dana.identifier)
			.run();
		expect((await passkeysOf(database, dana.identifier)).map((passkey) => passkey.name)).toEqual(['Apple Passwords']);
		expect(await removePasskey(database, lee.identifier, 'credential-1')).toBe(false);
		expect(await removePasskey(database, dana.identifier, 'credential-1')).toBe(true);
		expect(await passkeysOf(database, dana.identifier)).toEqual([]);
	});

	it('keeps sessions that started with a passkey, Google or Microsoft', async () => {
		const database = testDatabase();
		const dana = await verifiedAccount(database, 'dana@example.org');
		for (const method of ['passkey', 'google', 'microsoft'] as const) {
			const { token } = await startSession(database, dana.identifier, method, { secondStep: method === 'passkey' ? 'done' : 'none' });
			expect((await sessionAccount(database, token))?.method).toBe(method);
		}
	});
});
