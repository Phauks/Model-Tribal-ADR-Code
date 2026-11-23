/**
 * The inbox's settings, from wrangler.jsonc variables, the mailSigningKey
 * binding to Cloudflare Secrets Store and the outreach mailbox's password
 * (site/MAIL.md, "Switching email on"). While MAIL_DOMAIN is empty the inbox
 * pages still open, but nothing is received or sent.
 */
import { storedSecret, type StoredSecret } from '../stored-secrets.ts';

export interface MailSettings {
	/** The project's mail domain, such as example.org, or null while email is off. */
	domain: string | null;
	/** The project's own addresses, such as contact@example.org. */
	addresses: string[];
	/** The address replies come from when a message reached the catch-all. */
	defaultAddress: string | null;
	/** Where the "new mail" notice goes: a verified address in Email Routing, or null for none. */
	noticeAddress: string | null;
	/** The website's address, for links in notices and unsubscribe links. */
	siteAddress: string | null;
	/** The sender's name on mail from the project. */
	senderName: string;
	outreach: OutreachSettings | null;
	/**
	 * The key that signs unsubscribe and acknowledgment links: the
	 * mailSigningKey binding to Cloudflare Secrets Store. Read it with
	 * mailSigningKey.
	 */
	signingKey: StoredSecret | null;
}

/** The value of the key that signs unsubscribe and acknowledgment links, or nothing while it is not set. */
export function mailSigningKey(settings: MailSettings): Promise<string | undefined> {
	return storedSecret(settings.signingKey ?? undefined);
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
	const localParts = (text(environment.MAIL_ADDRESSES) ?? 'contact')
		.split(',')
		.map((part) => part.trim().toLowerCase())
		.filter((part) => /^[a-z0-9._-]+$/.test(part));
	const addresses = domain ? localParts.map((part) => `${part}@${domain}`) : [];
	return {
		domain,
		addresses,
		defaultAddress: addresses[0] ?? null,
		noticeAddress: text(environment.MAIL_NOTICE_ADDRESS),
		siteAddress: text(environment.SITE_ADDRESS)?.replace(/\/+$/, '') ?? null,
		senderName: text(environment.MAIL_SENDER_NAME) ?? 'Model Tribal ADR Code',
		outreach: outreachSettings(environment),
		signingKey: environment.mailSigningKey ?? null
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

/** Whether an address is one of the project's own. */
export function isProjectAddress(settings: MailSettings, address: string): boolean {
	const lower = address.toLowerCase();
	return settings.domain !== null && (lower.endsWith(`@${settings.domain}`) || settings.addresses.includes(lower));
}
