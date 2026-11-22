// See https://svelte.dev/docs/kit/types#app.d.ts
import type { D1Database, R2Bucket, RateLimit } from '@cloudflare/workers-types/index.ts';
import type { SignedInAccount } from '#lib/server/contributor-profiles.ts';
import type { SignedInPerson } from '#lib/server/people.ts';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** The signed-in person, set by src/hooks.server.ts on pages the Worker renders. */
			person: SignedInPerson | undefined;
			/**
			 * Whoever is signed in with Auth0 with a verified email address, with
			 * or without workspace access. Set on the workspace and profile pages.
			 */
			account: SignedInAccount | undefined;
			/** Why a permission check refused this request, for the activity log (src/hooks.server.ts). */
			refused: string | undefined;
		}
		// interface PageData {}
		// interface PageState {}
	}

	/**
	 * Bindings in wrangler.jsonc and the Worker's secrets, set in the Cloudflare
	 * dashboard (decision record 0006). Secrets are optional here because the
	 * site still builds and serves its public pages before they are set.
	 */
	interface WorkerEnvironment {
		database: D1Database;
		sourceDocuments: R2Bucket;
		requestFormLimit?: RateLimit;
		workspaceChangeLimit?: RateLimit;
		AUTH0_DOMAIN?: string;
		AUTH0_CLIENT_ID?: string;
		AUTH0_CLIENT_SECRET?: string;
		SESSION_SECRET?: string;
		LEAD_AUTHOR_EMAIL?: string;
	}
}

declare module 'virtual:design-tokens.css';

export {};
