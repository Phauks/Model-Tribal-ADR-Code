/**
 * Sign-in with Auth0 (site/COLLABORATION.md, "How sign-in works").
 *
 * Auth0 proves who someone is; the site's own database decides what they may
 * do. The session lives in an encrypted, HTTP-only cookie written by the
 * Auth0 server SDK, so the Worker keeps no session table. Every setting comes
 * from Worker secrets set in the Cloudflare dashboard, never from GitHub
 * (decision record 0006).
 */
import {
	CookieTransactionStore,
	ServerClient,
	StatelessStateStore,
	type CookieHandler,
	type CookieSerializeOptions
} from '@auth0/auth0-server-js';
import type { Cookies } from '@sveltejs/kit';

/** What the SDK's stores need from the current request: SvelteKit's cookies. */
export interface StoreOptions {
	cookies: Cookies;
}

class SvelteKitCookieHandler implements CookieHandler<StoreOptions> {
	setCookie(
		name: string,
		value: string,
		options?: CookieSerializeOptions,
		storeOptions?: StoreOptions
	): void {
		storeOptions?.cookies.set(name, value, { ...options, path: options?.path ?? '/' });
	}

	getCookie(name: string, storeOptions?: StoreOptions): string | undefined {
		return storeOptions?.cookies.get(name);
	}

	getCookies(storeOptions?: StoreOptions): Record<string, string> {
		const found: Record<string, string> = {};
		for (const { name, value } of storeOptions?.cookies.getAll() ?? []) found[name] = value;
		return found;
	}

	deleteCookie(name: string, storeOptions?: StoreOptions, options?: CookieSerializeOptions): void {
		storeOptions?.cookies.delete(name, { ...options, path: options?.path ?? '/' });
	}
}

export interface SignInSettings {
	domain: string;
	clientIdentifier: string;
	clientSecret: string;
	sessionSecret: string;
}

/** The secrets sign-in needs, or the names of the ones that are missing. */
export function signInSettings(
	environment: WorkerEnvironment
): { settings: SignInSettings } | { missing: string[] } {
	const values = {
		AUTH0_DOMAIN: environment.AUTH0_DOMAIN?.trim(),
		AUTH0_CLIENT_ID: environment.AUTH0_CLIENT_ID?.trim(),
		AUTH0_CLIENT_SECRET: environment.AUTH0_CLIENT_SECRET?.trim(),
		SESSION_SECRET: environment.SESSION_SECRET?.trim()
	};
	const missing = Object.entries(values)
		.filter(([, value]) => !value)
		.map(([name]) => name);
	if (values.SESSION_SECRET && values.SESSION_SECRET.length < 32) missing.push('SESSION_SECRET (at least 32 characters)');
	if (missing.length > 0) return { missing };
	return {
		settings: {
			// Auth0 wants a bare host name, so a pasted "https://" or "/" is removed.
			domain: values.AUTH0_DOMAIN!.replace(/^https?:\/\//, '').replace(/\/+$/, ''),
			clientIdentifier: values.AUTH0_CLIENT_ID!,
			clientSecret: values.AUTH0_CLIENT_SECRET!,
			sessionSecret: values.SESSION_SECRET!
		}
	};
}

/** The address Auth0 sends people back to. It must be listed in the Auth0 application. */
export const callbackPath = '/sign-in/callback';

const sessionHours = 12;
const inactivityHours = 4;

// One client per site address and settings, kept while the Worker instance
// lives, so Auth0's discovery document is fetched once rather than on every
// request.
const clients = new Map<string, ServerClient<StoreOptions>>();

export function signInClient(settings: SignInSettings, origin: string): ServerClient<StoreOptions> {
	const key = JSON.stringify([origin, settings.domain, settings.clientIdentifier]);
	let client = clients.get(key);
	if (!client) {
		const cookieHandler = new SvelteKitCookieHandler();
		client = new ServerClient<StoreOptions>({
			domain: settings.domain,
			clientId: settings.clientIdentifier,
			clientSecret: settings.clientSecret,
			authorizationParams: {
				redirect_uri: new URL(callbackPath, origin).href,
				scope: 'openid profile email'
			},
			transactionStore: new CookieTransactionStore({ secret: settings.sessionSecret }, cookieHandler),
			stateStore: new StatelessStateStore(
				{
					secret: settings.sessionSecret,
					rolling: true,
					absoluteDuration: sessionHours * 60 * 60,
					inactivityDuration: inactivityHours * 60 * 60
				},
				cookieHandler
			)
		});
		clients.set(key, client);
	}
	return client;
}

/**
 * A path inside this site to return to after signing in, or the workspace.
 * Only paths that start with a single "/" are accepted, so a crafted link
 * cannot send someone to another site after they sign in.
 */
export function safeReturnPath(candidate: string | null | undefined): string {
	if (!candidate) return '/workspace';
	if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) {
		return '/workspace';
	}
	try {
		const parsed = new URL(candidate, 'https://site.invalid');
		if (parsed.origin !== 'https://site.invalid') return '/workspace';
		return `${parsed.pathname}${parsed.search}`;
	} catch {
		return '/workspace';
	}
}
