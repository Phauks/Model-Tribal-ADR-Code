/**
 * The services that carry mail out of the project. Every sender in the
 * inbox goes through the MailCarrier interface, so a service can be swapped
 * by changing settings, not code (Trevor asked on Nov. 22, 2026 for the
 * outreach service to be replaceable):
 *
 * - "cloudflare": Cloudflare Email Service through a send_email binding. For
 *   replies and other mail people started; Cloudflare's terms allow only
 *   that kind of mail (site/MAIL.md, "Why outreach uses another service").
 * - "smtp": any mailbox provider's SMTP submission server: Zoho Mail today,
 *   or Fastmail, Migadu, Google Workspace and others by changing the
 *   OUTREACH_SMTP_* settings. Used for outreach.
 *
 * Adding another kind (for example a provider's HTTP sending API) means
 * writing one more function that returns a MailCarrier.
 */
import { buildRawMessage, type OutgoingMail } from './mime.ts';
import { sendOverSmtp, type SocketOpener } from './smtp.ts';
import type { OutreachSettings } from './settings.ts';

export interface SentMail {
	/** The Message-ID the message carries, without angle brackets. */
	messageId: string;
	/** The id the service gave it, when the service has its own. */
	providerMessageId: string | null;
}

export interface MailCarrier {
	readonly name: 'cloudflare' | 'smtp';
	send(mail: OutgoingMail): Promise<SentMail>;
}

/** The send_email binding's interface (Cloudflare, "Email Sending Workers API"). */
export interface EmailSendBinding {
	send(message: {
		from: string | { email: string; name: string };
		to: (string | { email: string; name: string })[];
		cc?: (string | { email: string; name: string })[];
		bcc?: (string | { email: string; name: string })[];
		replyTo?: string | { email: string; name: string };
		subject: string;
		text: string;
		html?: string;
		headers?: Record<string, string>;
		attachments?: {
			content: ArrayBuffer | ArrayBufferView | string;
			filename: string;
			type: string;
			disposition: 'attachment' | 'inline';
			contentId?: string;
		}[];
	}): Promise<{ messageId: string }>;
}

function named(address: { email: string; name?: string | null }): string | { email: string; name: string } {
	return address.name ? { email: address.email, name: address.name } : address.email;
}

/**
 * Headers Cloudflare lets a sender set (Cloudflare, "Email headers"): the
 * threading and list headers, and any X- header. Others are left off rather
 * than having the whole message refused.
 */
const cloudflareHeaders = new Set([
	'in-reply-to',
	'references',
	'list-unsubscribe',
	'list-unsubscribe-post',
	'list-id',
	'thread-topic',
	'thread-index'
]);

export function cloudflareCarrier(binding: EmailSendBinding): MailCarrier {
	return {
		name: 'cloudflare',
		async send(mail) {
			const headers: Record<string, string> = {};
			for (const [name, value] of Object.entries(mail.headers ?? {})) {
				if (cloudflareHeaders.has(name.toLowerCase()) || /^x-/i.test(name)) headers[name] = value;
			}
			const result = await binding.send({
				from: named(mail.from),
				to: mail.to.map(named),
				...(mail.cc?.length ? { cc: mail.cc.map(named) } : {}),
				...(mail.bcc?.length ? { bcc: mail.bcc.map(named) } : {}),
				...(mail.replyTo ? { replyTo: named(mail.replyTo) } : {}),
				subject: mail.subject,
				text: mail.text,
				...(mail.html ? { html: mail.html } : {}),
				headers,
				...(mail.attachments?.length
					? {
							attachments: mail.attachments.map((attachment) => ({
								content: attachment.content,
								filename: attachment.filename,
								type: attachment.mediaType,
								disposition: attachment.contentId ? ('inline' as const) : ('attachment' as const),
								...(attachment.contentId ? { contentId: attachment.contentId } : {})
							}))
						}
					: {})
			});
			// Cloudflare writes its own Message-ID; keep both so replies thread either way.
			const providerMessageId = result.messageId.replace(/^<|>$/g, '');
			return { messageId: providerMessageId, providerMessageId };
		}
	};
}

export function smtpCarrier(settings: OutreachSettings, open: SocketOpener, clientName: string): MailCarrier {
	return {
		name: 'smtp',
		async send(mail) {
			const raw = buildRawMessage(mail);
			await sendOverSmtp(
				open,
				{
					host: settings.host,
					port: settings.port,
					security: settings.security,
					username: settings.username,
					password: settings.password,
					clientName
				},
				{
					from: mail.from.email,
					recipients: [...mail.to, ...(mail.cc ?? []), ...(mail.bcc ?? [])].map((address) => address.email)
				},
				raw
			);
			return { messageId: mail.messageId, providerMessageId: null };
		}
	};
}
