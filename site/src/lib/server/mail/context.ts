/**
 * What every part of the inbox works with: the database, the private
 * bucket, the settings, and the time. Passed in rather than read from the
 * Worker, so tests can run each part with an in-memory database and bucket.
 */
import type { D1Database, R2Bucket } from '@cloudflare/workers-types/index.ts';
import type { MailCarrier } from './carriers.ts';
import type { MailSettings } from './settings.ts';

export interface MailContext {
	database: D1Database;
	bucket: R2Bucket;
	settings: MailSettings;
	/** The current time; tests set it. */
	now?: () => Date;
}

/**
 * The services that carry mail out (src/lib/server/mail/carriers.ts):
 * replies and other mail people started go through `replies`, outreach
 * through `outreach`. Either is null while it is not set up.
 */
export interface MailCarriers {
	replies: MailCarrier | null;
	outreach: MailCarrier | null;
}

export function currentTime(context: Pick<MailContext, 'now'>): Date {
	return context.now ? context.now() : new Date();
}

/** Where things are kept in the bucket. Everything for mail is under mail/. */
export const bucketKeys = {
	raw: (identifier: string, at: Date) =>
		`mail/raw/${at.getUTCFullYear()}/${String(at.getUTCMonth() + 1).padStart(2, '0')}/${identifier}.eml`,
	html: (identifier: string) => `mail/html/${identifier}.html`,
	attachment: (messageIdentifier: string, attachmentIdentifier: string) =>
		`mail/attachments/${messageIdentifier}/${attachmentIdentifier}`
};

/** Records who did what in the inbox (the mail_actions table). */
export function actionStatement(
	context: MailContext,
	action: {
		personIdentifier: string | null;
		action: string;
		threadIdentifier?: string | null;
		batchIdentifier?: string | null;
		note?: string | null;
	}
) {
	return context.database
		.prepare(
			`INSERT INTO mail_actions (identifier, person_identifier, action, thread_identifier, batch_identifier, note, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(
			crypto.randomUUID(),
			action.personIdentifier,
			action.action,
			action.threadIdentifier ?? null,
			action.batchIdentifier ?? null,
			action.note ?? null,
			currentTime(context).toISOString()
		);
}
