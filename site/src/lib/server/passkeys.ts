/**
 * Passkeys (WebAuthn): signing in with the fingerprint, face or PIN that
 * unlocks the person's device or password manager, instead of a password
 * (site/COLLABORATION.md, "Passkeys"; decision record 0062).
 *
 * A passkey belongs to the site's address: the browser offers it only on
 * triballawproject.org (the "relying party"), so it cannot be phished by a
 * look-alike site. Only the public key is kept here. Passkeys are
 * discoverable, so signing in needs no email address first, and each passkey
 * must check the person (user verification), which makes it both steps of
 * sign-in at once.
 */
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import {
	generateAuthenticationOptions,
	generateRegistrationOptions,
	verifyAuthenticationResponse,
	verifyRegistrationResponse,
	type AuthenticationResponseJSON,
	type PublicKeyCredentialCreationOptionsJSON,
	type PublicKeyCredentialRequestOptionsJSON,
	type RegistrationResponseJSON
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { now } from './identifiers.ts';

/** The name the browser shows when it asks to save or use a passkey. */
export const relyingPartyName = 'Tribal Law Project';

/** How long the browser waits for the person, in milliseconds. */
const waitMilliseconds = 5 * 60 * 1000;

/** The most passkeys one account may keep. */
export const maximumPasskeys = 20;

/**
 * The site's address as the browser sees it: the relying party is its host
 * name (triballawproject.org on the live site, localhost on a copy running
 * on this computer), and the origin is the whole address.
 */
export function relyingParty(url: URL): { id: string; origin: string } {
	return { id: url.hostname, origin: url.origin };
}

/**
 * Names for the password managers and devices that hold most passkeys, by
 * the identifier (AAGUID) each one reports, copied on Nov. 26, 2026 from the
 * community list the browsers use (passkeydeveloper/
 * passkey-authenticator-aaguids, aaguid.json; names only). Anything else is
 * called "Passkey".
 */
const knownProviders: Record<string, string> = {
	'bada5566-a7aa-401f-bd96-45619a55120d': '1Password',
	'a11a5faa-9f32-4b8c-8c5d-2f7d13e8c942': 'AliasVault',
	'fbfc3007-154e-4ecc-8c0b-6e020557d7bd': 'Apple Passwords',
	'c4ed941c-86d3-4532-a6a9-bc42b80d5c38': 'Authn8',
	'a4a2d88e-9796-4356-9164-e2a5a8bd019c': 'Avast Password Manager',
	'6bb49926-160a-4306-a100-4eb39ba6ac45': 'AVG Password Manager',
	'e7db2bd3-f2fe-4d71-ad78-7e7aa166cfd1': 'Avira Password Manager',
	'd548826e-79b4-db40-a3d8-11116f7e8349': 'Bitwarden',
	'c9cadfc9-89a9-489e-a25a-c7e86a4d5f15': 'Burp Suite Navigation Recorder',
	'adce0002-35bc-c60a-648b-0b25f1f05503': 'Chrome on Mac',
	'b5397666-4885-aa6b-cebf-e52262a439a2': 'Chromium Browser',
	'35d5ea15-ab24-4416-bdd1-f204c9bce1b6': 'CyberFOX Password Manager',
	'7c596f1a-3e42-4b8d-9a0f-5d2ce1b84493': 'Cyclop Passkey',
	'531126d6-e717-415c-9320-3d9aa6981239': 'Dashlane',
	'de503f9c-21a4-4f76-b4b7-558eb55c6f89': 'Devolutions',
	'771b48fd-d3d4-4f74-9232-fc157ab0507a': 'Edge on Mac',
	'f3809540-7f14-49c1-a8b3-8f813b225541': 'Enpass',
	'd2717a32-9851-48a8-9961-b264c97a411a': 'Fenko Vault',
	'f1d0badc-0def-4f1d-8bad-c0def1d0badc': 'fidont',
	'441f5bad-a8ec-4572-8094-ee73a1c7cec7': 'Fobb Security',
	'ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4': 'Google Password Manager',
	'd49b2120-b865-4191-8cea-be84a52b0485': 'Heimlane Vault',
	'da583154-ce16-4cdf-9fe6-1dba788c0998': 'Hey Be Safe',
	'dd4ec289-e01d-41c9-bb89-70fa845d4bf2': 'iCloud Keychain (Managed)',
	'9c1f2b6e-4d3a-4f7c-8b21-5e6a7d8c9f01': 'Idira',
	'39a5647e-1853-446c-a1f6-a79bae9f5bc7': 'IDmelon',
	'6d212b28-a2c1-4638-b375-5932070f62e9': 'initial',
	'cb6f6666-38ea-4873-9161-ff456a82d316': 'iPass Secure Auth',
	'bfc748bb-3429-4faa-b9f9-7cfa9f3b76d0': 'iPasswords',
	'a10c6dd9-465e-4226-8198-c7c44b91c555': 'Kaspersky Password Manager',
	'eaecdef2-1c31-5634-8639-f1cbd9c00a08': 'KeePassDX',
	'9addb28c-b46f-4402-808f-019651441ff3': 'KeePassPasskey',
	'fdb141b2-5d84-443e-8a35-4698c205a502': 'KeePassXC',
	'0ea242b4-43c4-4a1b-8b17-dd6d0b6baec6': 'Keeper',
	'69840def-9dcf-4632-bf87-6ac2e451b4f5': 'Keyholm',
	'b78a0a55-6ef8-d246-a042-ba0f6d55050c': 'LastPass',
	'22248c4c-7a12-46e2-9a41-44291b373a4d': 'LogMeOnce',
	'd3452668-01fd-4c12-926c-83a4204853aa': 'Microsoft Password Manager',
	'6d6f6e69-6361-4d33-a001-706173736b79': 'Monica Pass',
	'b84e4048-15dc-4dd0-8640-f4f60813c8af': 'NordPass',
	'fa37f553-f9b6-4adb-ac53-8bbb57ebdf0d': 'Norton Password Manager',
	'5ca471bb-a56d-46ad-a496-67e70e9ed9fb': 'Parcel',
	'87f5ec51-f721-4feb-9fe4-be18c4971894': 'PassCard',
	'70617373-7761-6c6c-6669-646f32303236': 'Passwall',
	'53e7a7a5-e75f-4d3d-9483-12fc779cdf23': 'Password Depot',
	'16a5a15d-7244-4563-856d-a5167d8b9783': 'Pleasant Password Server',
	'50726f74-6f6e-5061-7373-50726f746f6e': 'Proton Pass',
	'd350af52-0351-4ba2-acd3-dfeeadc3f764': 'pwSafe',
	'65c97700-f5ef-4d5c-8a42-f30e45ac94b7': 'Royal Vault',
	'53414d53-554e-4700-0000-000000000000': 'Samsung Pass',
	'93fea28e-9b08-41d0-b663-20c36b008e70': 'Share Credentials',
	'e8b7f4a2-c3d5-e6f7-890a-b1c2d3e4f567': 'Sherlocked',
	'd9be9d39-e6a6-4c28-a581-32b044d986e4': 'Sticky Password Manager',
	'891494da-2c90-4d31-a9cd-4eab0aed1309': 'Sésame',
	'7c30bcef-f035-4e21-9175-5c985b4b239c': 'TeamPass',
	'8836336a-f590-0921-301d-46427531eee6': 'Thales Bio Android SDK',
	'66a0ccb3-bd6a-191f-ee06-e375c50b9846': 'Thales Bio iOS SDK',
	'cd69adb5-3c7a-deb9-3177-6800ea6cb72a': 'Thales PIN Android SDK',
	'17290f1e-c212-34d0-1423-365d729f09d9': 'Thales PIN iOS SDK',
	'cc45f64e-52a2-451b-831a-4edd8022a202': 'ToothPic Passkey Provider',
	'9f8a3b2c-1d4e-4f6a-8b0c-2e1d3c4b5a69': 'U2 Secured',
	'45e3057e-b2f9-48ed-912f-9b901e153b16': 'Uniqkey',
	'477b05cd-7f78-4fe7-b629-27247f296138': 'WALLIX Vault',
	'08987058-cadc-4b81-b6e1-30de50dcbe96': 'Windows Hello',
	'9ddd1817-af5a-4672-a2b9-3e3dd95000a9': 'Windows Hello',
	'6028b017-b1d4-4c02-b4b3-afcdafc96bb2': 'Windows Hello',
	'b35a26b2-8f6e-4697-ab1d-d44db4da28c6': 'Zoho Vault'
};

export function passkeyName(aaguid: string | undefined): string {
	return (aaguid && knownProviders[aaguid.toLowerCase()]) || 'Passkey';
}

export interface Passkey {
	credentialId: string;
	name: string;
	device: string | null;
	backedUp: boolean;
	createdAt: string;
	lastUsedAt: string | null;
}

/** An account's passkeys, newest first, for Sign-in and security. */
export async function passkeysOf(database: D1Database, accountIdentifier: string): Promise<Passkey[]> {
	const { results } = await database
		.prepare(
			`SELECT credential_id AS credentialId, name, device, backed_up AS backedUp, created_at AS createdAt, last_used_at AS lastUsedAt
			 FROM passkeys WHERE account_identifier = ? ORDER BY created_at DESC`
		)
		.bind(accountIdentifier)
		.all<Omit<Passkey, 'backedUp'> & { backedUp: number }>();
	return results.map((row) => ({ ...row, backedUp: Boolean(row.backedUp) }));
}

/* Adding a passkey -------------------------------------------------------- */

/** What the browser needs to make a passkey for this account. */
export async function optionsToAdd(
	database: D1Database,
	url: URL,
	account: { identifier: string; email: string }
): Promise<PublicKeyCredentialCreationOptionsJSON> {
	const { results } = await database
		.prepare('SELECT credential_id AS id, transports FROM passkeys WHERE account_identifier = ?')
		.bind(account.identifier)
		.all<{ id: string; transports: string | null }>();
	return generateRegistrationOptions({
		rpName: relyingPartyName,
		rpID: relyingParty(url).id,
		// The account's own random identifier, so a device that already holds a
		// passkey for this account replaces it rather than keeping two.
		userID: new TextEncoder().encode(account.identifier),
		userName: account.email,
		userDisplayName: account.email,
		timeout: waitMilliseconds,
		attestationType: 'none',
		// The browser refuses to make a second passkey in a password manager that holds one already.
		excludeCredentials: results.map((row) => ({ id: row.id, transports: row.transports ? JSON.parse(row.transports) : undefined })),
		authenticatorSelection: { residentKey: 'required', userVerification: 'required' }
	});
}

export type AddResult = { outcome: 'added'; name: string } | { outcome: 'refused'; problem: string };

/** Checks the new passkey the browser made, and keeps its public key. */
export async function addPasskey(
	database: D1Database,
	url: URL,
	accountIdentifier: string,
	expectedChallenge: string,
	response: RegistrationResponseJSON,
	device: string | null
): Promise<AddResult> {
	const party = relyingParty(url);
	let verified;
	try {
		verified = await verifyRegistrationResponse({
			response,
			expectedChallenge,
			expectedOrigin: party.origin,
			expectedRPID: party.id,
			requireUserVerification: true
		});
	} catch (problem) {
		console.error('A new passkey could not be checked', problem);
		return { outcome: 'refused', problem: 'The passkey could not be checked. Please try again.' };
	}
	if (!verified.verified) return { outcome: 'refused', problem: 'The passkey could not be checked. Please try again.' };
	const { credential, aaguid, credentialBackedUp } = verified.registrationInfo;
	const count = await database
		.prepare('SELECT count(*) AS count FROM passkeys WHERE account_identifier = ?')
		.bind(accountIdentifier)
		.first<{ count: number }>();
	if ((count?.count ?? 0) >= maximumPasskeys) {
		return { outcome: 'refused', problem: `An account can keep up to ${maximumPasskeys} passkeys. Remove one first.` };
	}
	const name = passkeyName(aaguid);
	const { meta } = await database
		.prepare(
			`INSERT INTO passkeys (credential_id, account_identifier, public_key, sign_count, transports, name, device, backed_up, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (credential_id) DO NOTHING`
		)
		.bind(
			credential.id,
			accountIdentifier,
			isoBase64URL.fromBuffer(credential.publicKey),
			credential.counter,
			credential.transports ? JSON.stringify(credential.transports) : null,
			name,
			device ? device.slice(0, 60) : null,
			credentialBackedUp ? 1 : 0,
			now()
		)
		.run();
	if (meta.changes !== 1) return { outcome: 'refused', problem: 'That passkey is already on an account.' };
	return { outcome: 'added', name };
}

/** Removes one of an account's passkeys. Returns whether there was one to remove. */
export async function removePasskey(database: D1Database, accountIdentifier: string, credentialId: string): Promise<boolean> {
	const { meta } = await database
		.prepare('DELETE FROM passkeys WHERE account_identifier = ? AND credential_id = ?')
		.bind(accountIdentifier, credentialId)
		.run();
	return meta.changes === 1;
}

/* Signing in with a passkey ---------------------------------------------- */

/** What the browser needs to ask for any passkey this site has made. */
export function optionsToSignIn(url: URL): Promise<PublicKeyCredentialRequestOptionsJSON> {
	return generateAuthenticationOptions({
		rpID: relyingParty(url).id,
		timeout: waitMilliseconds,
		// Discoverable passkeys: the browser lists the ones it holds for this site.
		allowCredentials: [],
		userVerification: 'required'
	});
}

export type SignInResult = { outcome: 'accepted'; accountIdentifier: string } | { outcome: 'refused' };

/**
 * Checks the browser's answer to a passkey challenge, and returns the account
 * whose passkey signed it.
 */
export async function checkPasskey(
	database: D1Database,
	url: URL,
	expectedChallenge: string,
	response: AuthenticationResponseJSON
): Promise<SignInResult> {
	if (typeof response?.id !== 'string' || response.id.length > 1400) return { outcome: 'refused' };
	const row = await database
		.prepare(
			`SELECT account_identifier AS accountIdentifier, public_key AS publicKey, sign_count AS signCount, transports
			 FROM passkeys WHERE credential_id = ?`
		)
		.bind(response.id)
		.first<{ accountIdentifier: string; publicKey: string; signCount: number; transports: string | null }>();
	if (!row) return { outcome: 'refused' };
	const party = relyingParty(url);
	let verified;
	try {
		verified = await verifyAuthenticationResponse({
			response,
			expectedChallenge,
			expectedOrigin: party.origin,
			expectedRPID: party.id,
			requireUserVerification: true,
			credential: {
				id: response.id,
				publicKey: isoBase64URL.toBuffer(row.publicKey),
				counter: row.signCount,
				transports: row.transports ? JSON.parse(row.transports) : undefined
			}
		});
	} catch (problem) {
		console.error('A passkey sign-in could not be checked', problem);
		return { outcome: 'refused' };
	}
	if (!verified.verified) return { outcome: 'refused' };
	await database
		.prepare('UPDATE passkeys SET sign_count = ?, backed_up = ?, last_used_at = ? WHERE credential_id = ?')
		.bind(verified.authenticationInfo.newCounter, verified.authenticationInfo.credentialBackedUp ? 1 : 0, now(), response.id)
		.run();
	return { outcome: 'accepted', accountIdentifier: row.accountIdentifier };
}
