/**
 * Signing in with Google or Microsoft (OpenID Connect, authorization code
 * flow with PKCE; site/COLLABORATION.md, "Google and Microsoft sign-in";
 * decision record 0062). The provider only vouches for who the person is;
 * the session is still the site's own, and what the person may do is still
 * decided by the `people` table.
 *
 * Each provider is on only when its client identifier (a public setting in
 * wrangler.jsonc) and its client secret (a Worker secret set in the
 * Cloudflare dashboard) are both set; until then its button is not shown and
 * its addresses answer 404. Trevor deferred both on Nov. 26, 2026.
 *
 * A Google or Microsoft account is tied to a site account by the provider's
 * own identifier for the person: Google's `sub`, Microsoft's tenant and
 * object identifiers (`tid`, `oid`). The first time, it joins the site
 * account with the same email address only if the provider confirms that
 * the person owns that address (Google's `email_verified`, Microsoft's
 * `xms_edov`, or a personal Microsoft account). Otherwise the person signs
 * in another way and connects the account on Sign-in and security.
 */
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import type { Cookies } from '@sveltejs/kit';
import * as oauth from 'oauth4webapi';
import { accountByIdentifier, verifiedAccount, type Account } from './accounts.ts';
import { now } from './identifiers.ts';
import { startChallenge, takeChallenge } from './sign-in-challenges.ts';

export type Provider = 'google' | 'microsoft';

export const providerNames: Record<Provider, string> = { google: 'Google', microsoft: 'Microsoft' };

export function isProvider(value: string): value is Provider {
	return value === 'google' || value === 'microsoft';
}

export interface ProviderSettings {
	GOOGLE_CLIENT_ID?: string;
	GOOGLE_CLIENT_SECRET?: string;
	MICROSOFT_CLIENT_ID?: string;
	MICROSOFT_CLIENT_SECRET?: string;
}

/** The tenant every personal Microsoft account (Outlook.com, Hotmail, Xbox) belongs to. */
export const personalMicrosoftTenant = '9188040d-6c67-4c5b-b112-36a304b66dad';

const microsoftIssuer = (tenant: string) => `https://login.microsoftonline.com/${tenant}/v2.0`;

/**
 * The providers' published endpoints, written here so a sign-in needs no
 * discovery request first (Google: accounts.google.com/.well-known/
 * openid-configuration; Microsoft: login.microsoftonline.com/common/v2.0/
 * .well-known/openid-configuration).
 */
const servers: Record<Provider, oauth.AuthorizationServer> = {
	google: {
		issuer: 'https://accounts.google.com',
		authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
		token_endpoint: 'https://oauth2.googleapis.com/token',
		jwks_uri: 'https://www.googleapis.com/oauth2/v3/certs'
	},
	microsoft: {
		// "common" takes work, school and personal accounts. Each ID token
		// names the person's own tenant as its issuer, so the issuer to expect
		// is filled in from the token (microsoftServerFor) before it is checked.
		issuer: microsoftIssuer('common'),
		authorization_endpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
		token_endpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
		jwks_uri: 'https://login.microsoftonline.com/common/discovery/v2.0/keys'
	}
};

/**
 * Microsoft's server, expecting the issuer named by the ID token's own
 * tenant (tid), which must be a tenant identifier. The token is then checked
 * in full against it, as for Google.
 */
async function microsoftServerFor(response: Response): Promise<oauth.AuthorizationServer> {
	const body: { id_token?: unknown } = await response.clone().json().catch(() => ({}));
	let tenant = 'unknown';
	if (typeof body.id_token === 'string') {
		try {
			const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body.id_token.split('.')[1] ?? '')));
			if (typeof payload.tid === 'string' && /^[0-9a-f-]{36}$/i.test(payload.tid)) tenant = payload.tid.toLowerCase();
		} catch {
			// Left as "unknown", so the check below refuses it.
		}
	}
	return { ...servers.microsoft, issuer: microsoftIssuer(tenant) };
}

function fromBase64Url(text: string): Uint8Array {
	const padded = text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '=');
	return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

/** The only places outside this site that a sign-in may send the browser to. */
export const providerOrigins = ['https://accounts.google.com', 'https://login.microsoftonline.com'];

function credentials(settings: ProviderSettings, provider: Provider): { id: string; secret: string } | undefined {
	const id = (provider === 'google' ? settings.GOOGLE_CLIENT_ID : settings.MICROSOFT_CLIENT_ID)?.trim();
	const secret = (provider === 'google' ? settings.GOOGLE_CLIENT_SECRET : settings.MICROSOFT_CLIENT_SECRET)?.trim();
	return id && secret ? { id, secret } : undefined;
}

/** The providers that are switched on, for the sign-in forms and Sign-in and security. */
export function availableProviders(settings: ProviderSettings): Provider[] {
	return (['google', 'microsoft'] as const).filter((provider) => credentials(settings, provider));
}

/** The address the provider sends the browser back to, as registered with it. */
export function callbackAddress(url: URL, provider: Provider): string {
	return new URL(`/sign-in/${provider}/callback`, url.origin).href;
}

interface WaitingSignIn {
	state: string;
	nonce: string;
	verifier: string;
	returnTo: string;
	keep: boolean;
	/** Connecting to the signed-in account, from Sign-in and security, rather than signing in. */
	connect: boolean;
}

/**
 * Starts a sign-in (or connecting an account) and returns the provider's
 * address to send the browser to.
 */
export async function startOutsideSignIn(
	database: D1Database,
	cookies: Cookies,
	url: URL,
	settings: ProviderSettings,
	provider: Provider,
	choices: { returnTo: string; keep: boolean; connectTo?: string }
): Promise<string | undefined> {
	const client = credentials(settings, provider);
	if (!client) return undefined;
	const waiting: WaitingSignIn = {
		state: oauth.generateRandomState(),
		nonce: oauth.generateRandomNonce(),
		verifier: oauth.generateRandomCodeVerifier(),
		returnTo: choices.returnTo,
		keep: choices.keep,
		connect: Boolean(choices.connectTo)
	};
	await startChallenge(database, cookies, provider, waiting, choices.connectTo ?? null);
	const address = new URL(servers[provider].authorization_endpoint!);
	address.searchParams.set('client_id', client.id);
	address.searchParams.set('redirect_uri', callbackAddress(url, provider));
	address.searchParams.set('response_type', 'code');
	address.searchParams.set('scope', 'openid email profile');
	address.searchParams.set('state', waiting.state);
	address.searchParams.set('nonce', waiting.nonce);
	address.searchParams.set('code_challenge', await oauth.calculatePKCECodeChallenge(waiting.verifier));
	address.searchParams.set('code_challenge_method', 'S256');
	// Lets the person pick which account, rather than using whichever is signed in.
	address.searchParams.set('prompt', 'select_account');
	return address.href;
}

/** Who the provider says the person is. */
export interface OutsideIdentity {
	provider: Provider;
	/** Google's sub, or Microsoft's "tid:oid". */
	subject: string;
	email: string | undefined;
	/** The provider confirms the person owns the address. */
	emailVerified: boolean;
}

/** Reads who the person is from the provider's checked ID token claims. */
export function identityFrom(provider: Provider, claims: Record<string, unknown>): OutsideIdentity | undefined {
	const email = typeof claims.email === 'string' && claims.email.includes('@') ? claims.email.normalize('NFC').trim() : undefined;
	if (provider === 'google') {
		if (typeof claims.sub !== 'string' || !claims.sub) return undefined;
		return { provider, subject: claims.sub, email, emailVerified: claims.email_verified === true };
	}
	if (typeof claims.tid !== 'string' || typeof claims.oid !== 'string' || !claims.tid || !claims.oid) return undefined;
	return {
		provider,
		subject: `${claims.tid}:${claims.oid}`,
		email,
		// xms_edov: the organization owns the address's domain. A personal
		// account's address is confirmed by Microsoft when it is made.
		emailVerified: claims.xms_edov === true || claims.xms_edov === 'true' || claims.tid === personalMicrosoftTenant
	};
}

export type FinishedOutside =
	| { outcome: 'identified'; identity: OutsideIdentity; returnTo: string; keep: boolean; connectTo: string | undefined }
	| { outcome: 'refused'; reason: 'expired' | 'cancelled' | 'failed' };

/** Checks the provider's answer when it sends the browser back. */
export async function finishOutsideSignIn(
	database: D1Database,
	cookies: Cookies,
	url: URL,
	settings: ProviderSettings,
	provider: Provider
): Promise<FinishedOutside> {
	const client = credentials(settings, provider);
	const challenge = await takeChallenge<WaitingSignIn>(database, cookies, provider);
	if (!client || !challenge) return { outcome: 'refused', reason: 'expired' };
	const waiting = challenge.details;
	if (url.searchParams.get('error') === 'access_denied') return { outcome: 'refused', reason: 'cancelled' };
	const as = servers[provider];
	const oauthClient: oauth.Client = { client_id: client.id };
	try {
		const parameters = new URLSearchParams(url.searchParams);
		// Microsoft's "common" endpoint names the person's own tenant as the
		// issuer; the ID token's issuer is checked against it below instead.
		if (provider === 'microsoft') parameters.delete('iss');
		const callback = oauth.validateAuthResponse(as, oauthClient, parameters, waiting.state);
		const response = await oauth.authorizationCodeGrantRequest(
			as,
			oauthClient,
			oauth.ClientSecretPost(client.secret),
			callback,
			callbackAddress(url, provider),
			waiting.verifier
		);
		const checkedAgainst = provider === 'microsoft' ? await microsoftServerFor(response) : as;
		const tokens = await oauth.processAuthorizationCodeResponse(checkedAgainst, oauthClient, response, {
			expectedNonce: waiting.nonce,
			requireIdToken: true
		});
		const claims = oauth.getValidatedIdTokenClaims(tokens);
		const identity = claims ? identityFrom(provider, claims as Record<string, unknown>) : undefined;
		if (!identity) return { outcome: 'refused', reason: 'failed' };
		return {
			outcome: 'identified',
			identity,
			returnTo: waiting.returnTo,
			keep: waiting.keep,
			connectTo: waiting.connect ? (challenge.accountIdentifier ?? undefined) : undefined
		};
	} catch (problem) {
		console.error(`A ${providerNames[provider]} sign-in could not be checked`, problem);
		return { outcome: 'refused', reason: 'failed' };
	}
}

/* Connected accounts ------------------------------------------------------ */

export interface ConnectedSignIn {
	provider: Provider;
	email: string | null;
	createdAt: string;
	lastUsedAt: string | null;
}

export async function connectedSignIns(database: D1Database, accountIdentifier: string): Promise<ConnectedSignIn[]> {
	const { results } = await database
		.prepare(
			`SELECT provider, email, created_at AS createdAt, last_used_at AS lastUsedAt
			 FROM outside_sign_ins WHERE account_identifier = ? ORDER BY provider`
		)
		.bind(accountIdentifier)
		.all<ConnectedSignIn>();
	return results;
}

export type MatchResult =
	| { outcome: 'account'; account: Account }
	| { outcome: 'refused'; reason: 'unverified-email' | 'connected-elsewhere' };

/**
 * The site account a Google or Microsoft sign-in belongs to: the one it was
 * connected to before; or, the first time, the account with the same
 * confirmed email address, made if there is none.
 */
export async function accountForIdentity(database: D1Database, identity: OutsideIdentity): Promise<MatchResult> {
	const linked = await database
		.prepare('SELECT account_identifier AS accountIdentifier FROM outside_sign_ins WHERE provider = ? AND subject = ?')
		.bind(identity.provider, identity.subject)
		.first<{ accountIdentifier: string }>();
	if (linked) {
		const account = await accountByIdentifier(database, linked.accountIdentifier);
		if (account) {
			await database
				.prepare('UPDATE outside_sign_ins SET last_used_at = ?, email = coalesce(?, email) WHERE provider = ? AND subject = ?')
				.bind(now(), identity.email ?? null, identity.provider, identity.subject)
				.run();
			return { outcome: 'account', account };
		}
	}
	if (!identity.email || !identity.emailVerified) return { outcome: 'refused', reason: 'unverified-email' };
	const account = await verifiedAccount(database, identity.email);
	const connected = await connect(database, account.identifier, identity);
	if (!connected) return { outcome: 'refused', reason: 'connected-elsewhere' };
	return { outcome: 'account', account };
}

/**
 * Connects a Google or Microsoft account to a site account, replacing any
 * earlier one from the same provider. Refused (false) when that Google or
 * Microsoft account is connected to a different site account.
 */
export async function connect(database: D1Database, accountIdentifier: string, identity: OutsideIdentity): Promise<boolean> {
	const existing = await database
		.prepare('SELECT account_identifier AS accountIdentifier FROM outside_sign_ins WHERE provider = ? AND subject = ?')
		.bind(identity.provider, identity.subject)
		.first<{ accountIdentifier: string }>();
	if (existing && existing.accountIdentifier !== accountIdentifier) return false;
	const time = now();
	await database.batch([
		database
			.prepare('DELETE FROM outside_sign_ins WHERE account_identifier = ? AND provider = ? AND subject != ?')
			.bind(accountIdentifier, identity.provider, identity.subject),
		database
			.prepare(
				`INSERT INTO outside_sign_ins (provider, subject, account_identifier, email, created_at, last_used_at)
				 VALUES (?, ?, ?, ?, ?, ?)
				 ON CONFLICT (provider, subject) DO UPDATE SET email = excluded.email, last_used_at = excluded.last_used_at`
			)
			.bind(identity.provider, identity.subject, accountIdentifier, identity.email ?? null, time, time)
	]);
	return true;
}

/** Disconnects a provider from an account. Returns whether one was connected. */
export async function disconnect(database: D1Database, accountIdentifier: string, provider: Provider): Promise<boolean> {
	const { meta } = await database
		.prepare('DELETE FROM outside_sign_ins WHERE account_identifier = ? AND provider = ?')
		.bind(accountIdentifier, provider)
		.run();
	return meta.changes === 1;
}
