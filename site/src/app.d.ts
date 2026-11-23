// See https://svelte.dev/docs/kit/types#app.d.ts
import type { D1Database, R2Bucket, RateLimit } from '@cloudflare/workers-types/index.ts';
import type { ActiveSession } from '#lib/server/accounts.ts';
import type { SignedInAccount } from '#lib/server/contributor-profiles.ts';
import type { SignInEmailBinding } from '#lib/server/sign-in-email.ts';
import type { UpdateEmailBinding } from '#lib/server/following-email.ts';
import type { SignedInPerson } from '#lib/server/people.ts';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** The signed-in person, set by src/hooks.server.ts on pages the Worker renders. */
			person: SignedInPerson | undefined;
			/**
			 * Whoever is signed in, with or without workspace access. Set on the
			 * workspace and profile pages (src/lib/server/accounts.ts).
			 */
			account: SignedInAccount | undefined;
			/** The current session, for changing a password or signing out. */
			session: ActiveSession | undefined;
			/** Why a permission check refused this request, for the activity log (src/hooks.server.ts). */
			refused: string | undefined;
		}
		// interface PageData {}
		// interface PageState {}
	}

	/**
	 * Bindings and variables in wrangler.jsonc, and settings made in the
	 * Cloudflare dashboard (decision record 0006). Settings are optional here
	 * because the site still builds and serves its public pages without them.
	 */
	interface WorkerEnvironment {
		database: D1Database;
		sourceDocuments: R2Bucket;
		requestFormLimit?: RateLimit;
		workspaceChangeLimit?: RateLimit;
		signInLimit?: RateLimit;
		signInNetworkLimit?: RateLimit;
		/** Files one account can start sending in a minute (src/routes/uploads/pieces). */
		uploadLimit?: RateLimit;
		/** Cloudflare Email Service, for sign-in codes (src/lib/server/sign-in-email.ts). */
		signInEmail?: SignInEmailBinding;
		/** The address sign-in codes come from, on a domain onboarded in Email Service. */
		SIGN_IN_EMAIL_FROM?: string;
		/** Cloudflare Email Service, for summaries of followed pages (src/lib/server/following-email.ts). */
		updateEmail?: UpdateEmailBinding;
		/** The address summaries come from. Empty until the project has a domain, which keeps the emails off. */
		UPDATE_EMAIL_FROM?: string;
		/** The site's public address, for links in emails, such as https://example.org. */
		SITE_ADDRESS?: string;
		/** The first lead author's email address (site/COLLABORATION.md, "First sign-in"). */
		LEAD_AUTHOR_EMAIL?: string;
	}
}

declare module 'virtual:design-tokens.css';

export {};
