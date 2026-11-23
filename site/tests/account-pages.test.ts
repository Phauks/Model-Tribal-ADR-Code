import { beforeEach, describe, expect, it } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { accountPages, currentAccountPage, isAccountPath } from '#lib/account-menu.ts';
import { deviceLabel } from '#lib/device-label.ts';
import { defaultSettings } from '#lib/reading-settings.ts';
import { deleteAccount } from '#lib/server/account-deletion.ts';
import {
	accountDataExport,
	accountSettingsCopy,
	deleteAccountSettingsCopy,
	endOtherSession,
	endOtherSessions,
	saveAccountSettingsCopy,
	signedInDevices
} from '#lib/server/account-pages.ts';
import { sessionAccount, startSession, verifiedAccount } from '#lib/server/accounts.ts';
import type { SignedInAccount } from '#lib/server/contributor-profiles.ts';
import { testDatabase } from './database.ts';

let database: D1Database;
let account: SignedInAccount;

beforeEach(async () => {
	database = testDatabase();
	const created = await verifiedAccount(database, 'reader@example.org');
	account = { subject: created.identifier, email: created.email, name: null };
});

describe('device names', () => {
	it('names the browser and system in a few words', () => {
		const windowsChrome =
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
		const windowsEdge = `${windowsChrome} Edg/131.0.0.0`;
		const iphoneSafari =
			'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
		const macFirefox = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.7; rv:133.0) Gecko/20100101 Firefox/133.0';
		expect(deviceLabel(windowsChrome)).toBe('Chrome on Windows');
		expect(deviceLabel(windowsEdge)).toBe('Edge on Windows');
		expect(deviceLabel(iphoneSafari)).toBe('Safari on iPhone');
		expect(deviceLabel(macFirefox)).toBe('Firefox on Mac');
		expect(deviceLabel(null)).toBe('Unknown browser');
	});
});

describe('the Your account group in the sidebar', () => {
	it('opens on the account, profile and following pages', () => {
		expect(isAccountPath('/account')).toBe(true);
		expect(isAccountPath('/account/security')).toBe(true);
		expect(isAccountPath('/profile/edit')).toBe(true);
		expect(isAccountPath('/accounts')).toBe(false);
		expect(isAccountPath('/following')).toBe(true);
		expect(isAccountPath('/followers')).toBe(false);
		expect(isAccountPath('/uploads')).toBe(true);
	});

	it('marks the most specific entry as the current page', () => {
		expect(currentAccountPage('/account')).toBeUndefined();
		expect(currentAccountPage('/account/email')?.label).toBe('Email and notifications');
		expect(currentAccountPage('/profile/edit')?.label).toBe('Profile and credit');
		expect(currentAccountPage('/profile/password')?.label).toBe('Sign-in and security');
		expect(currentAccountPage('/profile/delete-account')?.label).toBe('Your data');
		expect(currentAccountPage('/profile/nation-team')?.label).toBe('Nation team');
		expect(currentAccountPage('/profile')?.label).toBe('Profile and credit');
		expect(currentAccountPage('/account/unknown')).toBeUndefined();
		expect(accountPages[0].link).toBe('/profile');
	});
});

describe('where you are signed in', () => {
	it('lists sessions with this one first, and signs out others but never this one', async () => {
		const here = await startSession(database, account.subject, 'password', { device: 'Firefox on Windows' });
		const phone = await startSession(database, account.subject, 'code', { device: 'Safari on iPhone' });
		const laptop = await startSession(database, account.subject, 'link', { device: 'Chrome on Mac' });
		const current = (await sessionAccount(database, here.token))!.tokenHash;

		const devices = await signedInDevices(database, account.subject, current);
		expect(devices.map((item) => item.device)[0]).toBe('Firefox on Windows');
		expect(devices[0].current).toBe(true);
		expect(devices).toHaveLength(3);
		expect(devices.every((item) => /^[0-9a-f]{16}$/.test(item.handle))).toBe(true);

		// This session's own handle is refused.
		expect(await endOtherSession(database, account.subject, devices[0].handle, current)).toBe(false);
		const phoneHandle = devices.find((item) => item.device === 'Safari on iPhone')!.handle;
		expect(await endOtherSession(database, account.subject, phoneHandle, current)).toBe(true);
		expect(await sessionAccount(database, phone.token)).toBeUndefined();

		await endOtherSessions(database, account.subject, current);
		expect(await sessionAccount(database, laptop.token)).toBeUndefined();
		expect(await sessionAccount(database, here.token)).toBeDefined();
	});

	it('does not reach another account’s sessions', async () => {
		const other = await verifiedAccount(database, 'other@example.org');
		const theirs = await startSession(database, other.identifier, 'code', { device: 'Chrome on Android' });
		const mine = await startSession(database, account.subject, 'code', { device: 'Firefox on Linux' });
		const theirHandle = (await signedInDevices(database, other.identifier, undefined))[0].handle;
		const current = (await sessionAccount(database, mine.token))!.tokenHash;
		expect(await endOtherSession(database, account.subject, theirHandle, current)).toBe(false);
		await endOtherSessions(database, account.subject, current);
		expect(await sessionAccount(database, theirs.token)).toBeDefined();
	});
});

describe('settings on every device', () => {
	it('keeps a cleaned copy, replaces it, and deletes it when turned off', async () => {
		expect(await accountSettingsCopy(database, account.subject)).toBeUndefined();
		await saveAccountSettingsCopy(database, account.subject, { textSize: '150', font: 'comic-sans', extra: 'x' }, 'dark');
		const copy = await accountSettingsCopy(database, account.subject);
		expect(copy?.settings).toEqual({ ...defaultSettings, textSize: '150' });
		expect(copy?.theme).toBe('dark');

		await saveAccountSettingsCopy(database, account.subject, { otherCursors: 'off' }, 'sepia');
		const replaced = await accountSettingsCopy(database, account.subject);
		expect(replaced?.settings).toEqual({ ...defaultSettings, otherCursors: 'off' });
		expect(replaced?.theme).toBe('device');

		await deleteAccountSettingsCopy(database, account.subject);
		expect(await accountSettingsCopy(database, account.subject)).toBeUndefined();
	});

	it('goes with the account when it is deleted', async () => {
		await saveAccountSettingsCopy(database, account.subject, { contrast: 'more' }, 'light');
		await deleteAccount(database, account, false);
		const left = await database.prepare('SELECT COUNT(*) AS count FROM account_settings').first<{ count: number }>();
		expect(left?.count).toBe(0);
	});
});

describe('download my data', () => {
	it('holds the account, follows, settings and devices, and never the password', async () => {
		await database
			.prepare('UPDATE accounts SET password_hash = ?, password_salt = ? WHERE identifier = ?')
			.bind('secret-hash', 'secret-salt', account.subject)
			.run();
		await database
			.prepare('INSERT INTO follows (account_identifier, address, followed_at) VALUES (?, ?, ?)')
			.bind(account.subject, '/nations/navajo-nation', '2026-11-23T00:00:00.000Z')
			.run();
		await saveAccountSettingsCopy(database, account.subject, { motion: 'reduce' }, 'dark');
		await startSession(database, account.subject, 'code', { device: 'Firefox on Windows' });

		const data = await accountDataExport(database, account);
		const text = JSON.stringify(data);
		expect(text).not.toContain('secret-hash');
		expect(text).not.toContain('secret-salt');
		expect(data.account).toMatchObject({ email: 'reader@example.org', has_password: true });
		expect(data.followedPages).toEqual([{ address: '/nations/navajo-nation', followed_at: '2026-11-23T00:00:00.000Z' }]);
		expect(data.settingsOnEveryDevice).toMatchObject({ theme: 'dark' });
		expect(data.signedIn).toEqual([expect.objectContaining({ device: 'Firefox on Windows', method: 'code' })]);
		expect(text).not.toMatch(/token|handle/);
		expect(data.profile).toBeNull();
	});
});
