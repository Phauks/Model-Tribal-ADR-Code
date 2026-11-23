/**
 * The inbox as the Worker runs it: settings, storage and carriers from the
 * Worker's bindings (src/app.d.ts, wrangler.jsonc). Kept apart from the rest
 * of src/lib/server/mail/ so those parts run in tests without a Worker.
 */
import { error } from '@sveltejs/kit';
import { workerEnvironment } from '../environment.ts';
import { cloudflareCarrier, smtpCarrier } from './carriers.ts';
import type { MailCarriers, MailContext } from './context.ts';
import { mailSettings } from './settings.ts';
import { workerSocketOpener } from './socket-opener.ts';

/** The inbox's context, or "503" while the database or the mail bucket is not connected. */
export function mailContext(): MailContext {
	const environment = workerEnvironment();
	if (!environment.database || !environment.mailFiles) error(503, 'The database or the mail bucket is not connected.');
	return { database: environment.database, bucket: environment.mailFiles, settings: mailSettings(environment) };
}

/** Replies go through Cloudflare Email Service; outreach through the outreach carrier named in OUTREACH_CARRIER. */
export function mailCarriers(context: MailContext): MailCarriers {
	const environment = workerEnvironment();
	const outreach = context.settings.outreach;
	return {
		replies: environment.projectEmail && context.settings.domain ? cloudflareCarrier(environment.projectEmail) : null,
		outreach: outreach?.carrier === 'smtp' ? smtpCarrier(outreach, workerSocketOpener, context.settings.domain ?? 'localhost') : null
	};
}
