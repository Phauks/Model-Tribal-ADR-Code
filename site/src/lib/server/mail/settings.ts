/**
 * The inbox's settings, from wrangler.jsonc variables and dashboard secrets
 * (site/MAIL.md, "Switching email on"). While MAIL_DOMAIN is empty the inbox
 * pages still open, but nothing is received or sent.
 */

export interface MailSettings {
	/** The project's mail domain, such as example.org, or null while email is off. */
	domain: string | null;
	/** Where the "new mail" notice goes: a verified address in Email Routing, or null for none. */
	noticeAddress: string | null;
	/** The website's address, for links in notices and unsubscribe links. */
	siteAddress: string | null;
	/** The sender's name on mail from the project. */
	senderName: string;
	outreach: OutreachSettings | null;
	/** Secret for signing unsubscribe and acknowledgment links. */
	signingKey: string | null;
}

export interface OutreachSettings {
	/** Which kind of service carries outreach (src/lib/server/mail/carriers.ts). Only "smtp" today. */
	carrier: 'smtp';
	from: string;
	/** Where replies should go, normally an address in the project inbox. */
	replyTo: string | null;
	host: string;
	port: number;
	/** "tls" for port 465 (TLS from the start), "starttls" for port 587. */
	security: 'tls' | 'starttls';
	username: string;
	password: string;
}

function text(value: unknown): string | null {
	return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

export function mailSettings(environment: WorkerEnvironment): MailSettings {
	const domain = text(environment.MAIL_DOMAIN)?.toLowerCase() ?? null;
	return {
		domain,
		noticeAddress: text(environment.MAIL_NOTICE_ADDRESS),
		siteAddress: text(environment.SITE_ADDRESS)?.replace(/\/+$/, '') ?? null,
		senderName: text(environment.MAIL_SENDER_NAME) ?? 'Model Tribal ADR Code',
		outreach: outreachSettings(environment),
		signingKey: text(environment.MAIL_SIGNING_KEY)
	};
}

function outreachSettings(environment: WorkerEnvironment): OutreachSettings | null {
	const carrier = text(environment.OUTREACH_CARRIER);
	const from = text(environment.OUTREACH_FROM);
	const host = text(environment.OUTREACH_SMTP_HOST);
	const username = text(environment.OUTREACH_SMTP_USERNAME) ?? from;
	const password = text(environment.OUTREACH_SMTP_PASSWORD);
	if (carrier !== 'smtp' || !from || !host || !username || !password) return null;
	const port = Number(text(environment.OUTREACH_SMTP_PORT) ?? '465');
	return {
		carrier: 'smtp',
		from,
		replyTo: text(environment.OUTREACH_REPLY_TO),
		host,
		port: Number.isInteger(port) && port > 0 ? port : 465,
		security: port === 587 ? 'starttls' : 'tls',
		username,
		password
	};
}

/** Whether an address is one of the project's own: any address on the mail domain (each inbox's, and the catch-all's). */
export function isProjectAddress(settings: MailSettings, address: string): boolean {
	return settings.domain !== null && address.toLowerCase().endsWith(`@${settings.domain}`);
}
