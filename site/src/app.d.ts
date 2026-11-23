// See https://svelte.dev/docs/kit/types#app.d.ts
import type { D1Database, DurableObjectNamespace, R2Bucket, RateLimit } from '@cloudflare/workers-types/index.ts';
import type { ActiveSession } from '#lib/server/accounts.ts';
import type { SignedInAccount } from '#lib/server/contributor-profiles.ts';
import type { EmailSendBinding } from '#lib/server/mail/carriers.ts';
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
		/** The live editing rooms, one per essay, in the model-tribal-adr-code-live Worker (src/lib/server/live-editing.ts). */
		essayRooms?: DurableObjectNamespace;
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
		/** Cloudflare Email Service, for replies from the project inbox (site/MAIL.md). */
		projectEmail?: EmailSendBinding;
		/** The project's mail domain, such as example.org; empty while email is off (site/MAIL.md, "Switching email on"). */
		MAIL_DOMAIN?: string;
		/** The inbox's own addresses, as local parts separated by commas, such as "contact,requests". The first is the default. */
		MAIL_ADDRESSES?: string;
		/** Where the "new mail" notice goes, if anywhere. Not one of the project's own addresses. */
		MAIL_NOTICE_ADDRESS?: string;
		/** The sender's name on mail from the project. */
		MAIL_SENDER_NAME?: string;
		/** Secret: signs unsubscribe and acknowledgment links. Set as a Secret in the dashboard. */
		MAIL_SIGNING_KEY?: string;
		/** Which service carries outreach: "smtp" (src/lib/server/mail/carriers.ts). Empty while outreach is off. */
		OUTREACH_CARRIER?: string;
		/** The address outreach comes from, on the outreach mail service. */
		OUTREACH_FROM?: string;
		/** Where replies to outreach should go, normally an address in the project inbox. */
		OUTREACH_REPLY_TO?: string;
		OUTREACH_SMTP_HOST?: string;
		/** 465 (TLS from the start, the default) or 587 (STARTTLS). */
		OUTREACH_SMTP_PORT?: string;
		/** The SMTP user name; the From address when empty. */
		OUTREACH_SMTP_USERNAME?: string;
		/** Secret: the mailbox's app password. Set as a Secret in the dashboard. */
		OUTREACH_SMTP_PASSWORD?: string;
		/**
		 * Printed copies (docs/book-orders.md). Ordering stays off unless
		 * BOOK_ORDERS is "test" (Stripe test keys and Lulu's sandbox only) or
		 * "live"; the keys and secrets are set in the Cloudflare dashboard.
		 */
		BOOK_ORDERS?: string;
		/** Where Lulu sends questions about a print job: the project's own address, never the reader's. */
		BOOK_ORDERS_CONTACT_EMAIL?: string;
		/** Added to each copy's price, in cents, toward copies sent to nations. */
		BOOK_MARGIN_CENTS?: string;
		/** Signs the links Lulu uses to download a book's files. */
		BOOK_FILE_LINK_SECRET?: string;
		/** "sandbox" or "production". */
		LULU_ENVIRONMENT?: string;
		LULU_CLIENT_KEY?: string;
		LULU_CLIENT_SECRET?: string;
		STRIPE_SECRET_KEY?: string;
		STRIPE_WEBHOOK_SECRET?: string;
		/**
		 * Sponsor gifts (docs/sponsorship.md). Off unless SPONSOR_GIFTS is
		 * "test" (a Stripe test key only) or "live" (a live key, and
		 * SPONSOR_GIFTS_RECEIVER naming who receives the money).
		 */
		SPONSOR_GIFTS?: string;
		/** The signing secret of the Stripe webhook endpoint at /sponsorship/payment-webhook. */
		STRIPE_SPONSOR_WEBHOOK_SECRET?: string;
		/** Who receives sponsors' gifts, as the gift form names them. */
		SPONSOR_GIFTS_RECEIVER?: string;
	}
}

declare module 'virtual:design-tokens.css';

export {};
