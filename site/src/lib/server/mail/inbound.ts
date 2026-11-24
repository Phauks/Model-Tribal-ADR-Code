/**
 * Mail arriving through Cloudflare Email Routing (site/MAIL.md, "How mail
 * comes in"). The Worker's email handler passes each message here; it is
 * parsed with postal-mime, kept whole in the private bucket, and filed in a
 * conversation:
 *
 * - A reply joins the conversation it answers, found by its In-Reply-To and
 *   References headers, or else by subject and sender within 60 days.
 * - An automatic reply (out of office and the like) is shown, but does not
 *   count as an answer for follow-up reminders.
 * - A delivery failure report marks the message it is about as bounced.
 * - Mail to unsubscribe+<token>@ puts the sender on the do-not-email list.
 * - A reply whose first line asks to stop is flagged for a person to confirm.
 * - Mail that fails the sender's own DMARC policy goes to Spam.
 */
import PostalMime, { type Email } from 'postal-mime';
import { cleanAddress, messageIds, normalizeSubject, snippetOf, asksToStop, type MailAddress } from '#lib/mail.ts';
import { bucketKeys, currentTime, type MailContext } from './context.ts';
import { inboxForArrival } from './inboxes.ts';
import { isProjectAddress } from './settings.ts';
import { factsFor, ruleAddressForms, runRules } from './rules.ts';
import { storeSentFile } from '#lib/server/file-scans.ts';
import { blockedPattern } from './senders.ts';
import { suppress } from './suppressions.ts';
import { readToken, unsubscribeAddressToken } from './tokens.ts';

/** The header the inbox's own "new mail" notices carry, so they never start a loop. */
export const noticeHeader = 'X-Project-Inbox-Notice';

export interface ArrivingMail {
	/** The envelope sender (MAIL FROM), empty for delivery reports. */
	from: string;
	/** The envelope recipient: the project address the message was sent to. */
	to: string;
	raw: ArrayBuffer | Uint8Array;
}

export type ArrivalResult =
	| {
			outcome: 'filed';
			threadIdentifier: string;
			messageIdentifier: string;
			spam: boolean;
			automatic: boolean;
			notify: boolean;
			/**
			 * Whether a person wrote it to the project, so the away message may
			 * answer it: not Spam, not an automatic reply or delivery report, not
			 * from a mailing list, not to a personal inbox, and not from the
			 * project's own addresses.
			 */
			answerable: boolean;
			/** The names of the auto-sort rules that matched, in the order they ran. */
			sortedBy: string[];
	  }
	| { outcome: 'unsubscribed'; email: string }
	| { outcome: 'rejected'; reason: string };

const decoder = new TextDecoder();

function header(email: Email, name: string): string | null {
	const found = email.headers.find((item) => item.key === name.toLowerCase());
	return found ? found.value : null;
}

function allHeaders(email: Email, name: string): string[] {
	return email.headers.filter((item) => item.key === name.toLowerCase()).map((item) => item.value);
}

function addressOf(value: { address?: string; name?: string } | undefined): MailAddress | null {
	if (!value?.address) return null;
	const email = cleanAddress(value.address);
	return email ? { email, name: value.name?.trim() || null } : null;
}

function addressList(values: { address?: string; name?: string; group?: { address?: string; name?: string }[] }[] | undefined): MailAddress[] {
	const list: MailAddress[] = [];
	for (const value of values ?? []) {
		for (const item of value.group ?? [value]) {
			const address = addressOf(item);
			if (address && !list.some((known) => known.email === address.email)) list.push(address);
		}
	}
	return list;
}

/**
 * Whether a message is an automatic reply, by the headers RFC 3834 and the
 * common mail programs set, or an "Automatic reply" or "Out of office" subject.
 */
export function isAutomatic(email: Email): boolean {
	const submitted = header(email, 'auto-submitted');
	if (submitted && !/^no\b/i.test(submitted.trim())) return true;
	if (header(email, 'x-autoreply') || header(email, 'x-autorespond') || header(email, 'x-auto-response-suppress')?.match(/all|oof/i)) return true;
	if (/^(auto_reply|bulk|junk|list)$/i.test(header(email, 'precedence')?.trim() ?? '')) return true;
	return /^(automatic reply|auto(-|\s)?reply|out of (the )?office|autoreply)\b/i.test(email.subject?.trim() ?? '');
}

/**
 * Why a message belongs in Spam, or null. Cloudflare Email Routing records
 * its SPF, DKIM and DMARC checks in Authentication-Results headers; a message
 * that fails the sender's own DMARC policy claims to be from someone it is
 * not.
 */
export function spamReason(email: Email): string | null {
	const results = [...allHeaders(email, 'authentication-results'), ...allHeaders(email, 'arc-authentication-results')].join('; ');
	if (/\bdmarc=fail\b/i.test(results)) return 'It failed the sender’s own DMARC check, so it may not be from who it says.';
	if (/\bspf=fail\b/i.test(results) && !/\bdkim=pass\b/i.test(results)) {
		return 'It failed the sender’s SPF check and has no valid DKIM signature.';
	}
	if (/^yes\b/i.test(header(email, 'x-spam-flag')?.trim() ?? '')) return 'An earlier mail server marked it as spam.';
	return null;
}

export interface DeliveryReport {
	/** "bounced" for a permanent failure, "deferred" for a delay. */
	status: 'bounced' | 'deferred';
	recipients: string[];
	detail: string;
	/** Message-IDs of the message the report is about. */
	originalIds: string[];
}

function attachmentText(content: ArrayBuffer | string | Uint8Array): string {
	return typeof content === 'string' ? content : decoder.decode(content);
}

/**
 * A delivery status notification (RFC 3464), or null when the message is not
 * one. Reads the machine-readable part when there is one, and otherwise
 * looks for the usual wording.
 */
export function deliveryReport(email: Email, envelopeFrom: string): DeliveryReport | null {
	const contentType = header(email, 'content-type') ?? '';
	const statusPart = email.attachments.find((part) => /message\/(global-)?delivery-status/i.test(part.mimeType));
	const fromDaemon = /^(mailer-daemon|postmaster)@/i.test(email.from?.address ?? '') || envelopeFrom.trim() === '' || envelopeFrom === '<>';
	const looksLikeReport = /multipart\/report/i.test(contentType) && /delivery-status/i.test(contentType);
	if (!statusPart && !looksLikeReport && !(fromDaemon && /undeliver|delivery (status|failure)|failure notice|returned mail/i.test(email.subject ?? ''))) {
		return null;
	}
	const statusText = statusPart ? attachmentText(statusPart.content) : `${email.text ?? ''}`;
	const recipients = [...statusText.matchAll(/^(?:Final|Original)-Recipient:\s*rfc822;\s*<?([^\s>]+)>?/gim)]
		.map((match) => cleanAddress(match[1]))
		.filter((value): value is string => value !== null);
	const actions = [...statusText.matchAll(/^Action:\s*(\S+)/gim)].map((match) => match[1].toLowerCase());
	const codes = [...statusText.matchAll(/^Status:\s*(\d\.\d{1,3}\.\d{1,3})/gim)].map((match) => match[1]);
	const diagnostic = /^Diagnostic-Code:\s*(.+(?:\r?\n[ \t].+)*)/im.exec(statusText)?.[1]?.replace(/\s+/g, ' ').trim();
	const permanent = actions.includes('failed') || codes.some((code) => code.startsWith('5'));
	const delayed = actions.includes('delayed') || codes.some((code) => code.startsWith('4'));
	const original = email.attachments
		.filter((part) => /message\/(rfc822|global)|text\/rfc822-headers|message\/global-headers/i.test(part.mimeType))
		.map((part) => attachmentText(part.content))
		.join('\n');
	const originalIds = [...`${original}\n${email.text ?? ''}`.matchAll(/^Message-ID:\s*<([^<>\s]+)>/gim)].map((match) => match[1]);
	return {
		status: permanent || !delayed ? 'bounced' : 'deferred',
		recipients,
		detail: diagnostic ?? (codes[0] ? `Status ${codes[0]}` : (email.subject ?? 'Delivery failure')),
		originalIds: [...new Set(originalIds)]
	};
}

interface ThreadRow {
	identifier: string;
	folder: string;
	remind_set_at: string | null;
	nation_identifier: string | null;
}

/**
 * The conversation a message answers, by its Message-ID references, or else
 * by subject and sender, within the inbox it arrived in: the same message
 * sent to two of the project's addresses is kept in each inbox.
 */
export async function findConversation(
	context: MailContext,
	inboxIdentifier: string,
	references: string[],
	normalized: string,
	counterpart: string | null,
	at: Date
): Promise<ThreadRow | null> {
	for (const id of [...references].reverse().slice(0, 20)) {
		const row = await context.database
			.prepare(
				`SELECT t.identifier, t.folder, t.remind_set_at, t.nation_identifier FROM mail_messages m
				 JOIN mail_threads t ON t.identifier = m.thread_identifier
				 WHERE (m.message_id = ?1 OR m.provider_message_id = ?1) AND t.inbox_identifier = ?2 LIMIT 1`
			)
			.bind(id, inboxIdentifier)
			.first<ThreadRow>();
		if (row) return row;
	}
	if (!counterpart || normalized.length < 4) return null;
	const since = new Date(at.getTime() - 60 * 86_400_000).toISOString();
	return context.database
		.prepare(
			`SELECT identifier, folder, remind_set_at, nation_identifier FROM mail_threads
			 WHERE normalized_subject = ? AND counterpart_address = ? AND last_message_at >= ? AND inbox_identifier = ?
			 ORDER BY last_message_at DESC LIMIT 1`
		)
		.bind(normalized, counterpart, since, inboxIdentifier)
		.first<ThreadRow>();
}

/** The nation an address belongs to in the address book, when the address book is there. */
export async function nationForAddress(context: MailContext, email: string): Promise<string | null> {
	try {
		const row = await context.database
			.prepare(
				`SELECT c.nation_identifier AS nation, o.nation_identifier AS organizationNation FROM contact_methods m
				 JOIN contacts c ON c.identifier = m.contact_identifier
				 LEFT JOIN contacts o ON o.identifier = c.organization_identifier
				 WHERE m.method = 'email' AND m.value = ? LIMIT 1`
			)
			.bind(email.toLowerCase())
			.first<{ nation: string | null; organizationNation: string | null }>();
		return row?.nation ?? row?.organizationNation ?? null;
	} catch (problem) {
		if (/no such table/i.test(String(problem))) return null;
		throw problem;
	}
}

/**
 * Plain text for a message sent only as HTML, for reading, search and the
 * preview line: block elements become line breaks, other tags are dropped,
 * and the common character references are read.
 */
export function htmlToText(html: string): string {
	return html
		.replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, '')
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/(p|div|li|tr|h[1-6]|blockquote|table)>/gi, '\n')
		.replace(/<[^>]+>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;|&apos;/g, "'")
		.replace(/&#(\d+);/g, (_whole, code: string) => String.fromCodePoint(Number(code)))
		.replace(/&amp;/g, '&')
		.replace(/[ \t]+/g, ' ')
		.replace(/ *\n */g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

/** Files one arriving message. */
export async function receiveMail(context: MailContext, arriving: ArrivingMail): Promise<ArrivalResult> {
	const { settings } = context;
	if (!settings.domain) return { outcome: 'rejected', reason: 'This address is not taking mail yet.' };
	const at = currentTime(context);
	const raw = arriving.raw instanceof Uint8Array ? arriving.raw : new Uint8Array(arriving.raw);
	const email = await PostalMime.parse(raw, { attachmentEncoding: 'arraybuffer' });

	// Unsubscribe by address: unsubscribe+<token>@domain.
	const token = unsubscribeAddressToken(arriving.to);
	if (token) {
		const recipient = settings.signingKey ? await readToken(settings.signingKey, 'unsubscribe', token) : null;
		const row = recipient
			? await context.database.prepare('SELECT email FROM outreach_recipients WHERE identifier = ?').bind(recipient).first<{ email: string }>()
			: null;
		const address = row?.email ?? cleanAddress(arriving.from) ?? addressOf(email.from)?.email ?? null;
		if (!address) return { outcome: 'rejected', reason: 'This unsubscribe address is not valid.' };
		await suppress(context, address, 'unsubscribed', { source: row ? 'unsubscribe address' : 'unsubscribe address, unsigned' });
		return { outcome: 'unsubscribed', email: address };
	}

	// The inbox it goes to: the one for the address it was sent to, or else the catch-all (src/lib/server/mail/inboxes.ts).
	const inbox = await inboxForArrival(context, cleanAddress(arriving.to));
	if (!inbox) return { outcome: 'rejected', reason: 'No inbox takes this mail.' };
	// The same message filed again (a sender's server trying twice, or a try again after filing failed half way) is
	// not filed twice: it is the one already in this inbox.
	const ownId = messageIds(email.messageId)[0] ?? null;
	if (ownId) {
		const already = await context.database
			.prepare(
				`SELECT m.identifier, m.thread_identifier FROM mail_messages m JOIN mail_threads t ON t.identifier = m.thread_identifier
				 WHERE m.message_id = ? AND m.direction = 'in' AND t.inbox_identifier = ? LIMIT 1`
			)
			.bind(ownId, inbox.identifier)
			.first<{ identifier: string; thread_identifier: string }>();
		if (already) {
			return { outcome: 'filed', threadIdentifier: already.thread_identifier, messageIdentifier: already.identifier, spam: false, automatic: false, notify: false, answerable: false, sortedBy: [] };
		}
	}
	const identifier = crypto.randomUUID();
	const from = addressOf(email.from) ?? addressOf(email.sender) ?? { email: cleanAddress(arriving.from) ?? 'unknown@invalid', name: null };
	const to = addressList(email.to);
	const cc = addressList(email.cc);
	const replyTo = addressList(email.replyTo)[0] ?? null;
	const subject = (email.subject ?? '').trim() || '(no subject)';
	const text = (email.text ?? '').trim() || (email.html ? htmlToText(email.html) : '');
	const ownNotice = header(email, noticeHeader.toLowerCase()) !== null;
	const report = deliveryReport(email, arriving.from);
	const automatic = ownNotice || report !== null || isAutomatic(email);
	// A blocked sender's mail is kept, in Spam, in a conversation of its own (src/lib/server/mail/senders.ts).
	const blocked = report ? null : await blockedPattern(context, from.email);
	const spam = report ? null : blocked ? `You blocked ${blocked.startsWith('@') ? `mail from ${blocked}` : 'this sender'}.` : spamReason(email);
	const references = [...messageIds(email.references), ...messageIds(email.inReplyTo), ...(report?.originalIds ?? [])];
	const projectAddress = cleanAddress(arriving.to) ?? inbox.address;
	// The other side of the conversation: whoever wrote, or, for a copy of our own mail, whoever it went to.
	const counterpart = isProjectAddress(settings, (replyTo ?? from).email) ? (to.find((item) => !isProjectAddress(settings, item.email)) ?? from) : (replyTo ?? from);
	const normalized = normalizeSubject(subject);
	const existing = blocked ? null : await findConversation(context, inbox.identifier, references, normalized, report ? null : counterpart.email, at);
	const threadIdentifier = existing?.identifier ?? crypto.randomUUID();
	const nation = existing?.nation_identifier ?? (await nationForAddress(context, counterpart.email));
	const stamp = at.toISOString();

	// Keep the whole message, its HTML and its attachments in the bucket.
	const rawKey = bucketKeys.raw(identifier, at);
	await context.bucket.put(rawKey, raw, { httpMetadata: { contentType: 'message/rfc822' } });
	const htmlKey = email.html ? bucketKeys.html(identifier) : null;
	if (htmlKey) await context.bucket.put(htmlKey, email.html!, { httpMetadata: { contentType: 'text/html; charset=utf-8' } });
	const attachmentRows: { id: string; filename: string; mediaType: string; size: number; contentId: string | null; inline: number; key: string }[] = [];
	for (const part of email.attachments) {
		const id = crypto.randomUUID();
		const key = bucketKeys.attachment(identifier, id);
		const content = typeof part.content === 'string' ? new TextEncoder().encode(part.content) : new Uint8Array(part.content);
		// Held until the virus check passes (site/SCANNING.md, src/lib/server/mail/scans.ts).
		await storeSentFile(
			context.database,
			context.bucket,
			{ objectKey: key, purpose: 'mail-attachment', subject: id, bytes: content, httpMetadata: { contentType: part.mimeType || 'application/octet-stream' } },
			at
		);
		attachmentRows.push({
			id,
			filename: (part.filename ?? '').trim() || 'attachment',
			mediaType: part.mimeType || 'application/octet-stream',
			size: content.byteLength,
			contentId: part.contentId?.replace(/^<|>$/g, '') ?? null,
			inline: part.disposition === 'inline' ? 1 : 0,
			key
		});
	}

	const database = context.database;
	const statements = [];
	if (existing) {
		const answers = !automatic && existing.remind_set_at !== null && existing.remind_set_at <= stamp;
		// A reply brings an archived or deleted conversation back, and one waiting on a reminder from wherever it was filed.
		const comesBack = !spam && (existing.folder === 'archive' || existing.folder === 'trash' || (answers && existing.folder === 'folder'));
		statements.push(
			database
				.prepare(
					`UPDATE mail_threads SET unread = 1, message_count = message_count + 1, last_message_at = ?1, last_inbound_at = ?1,
					 folder = CASE WHEN ?2 THEN 'inbox' ELSE folder END, folder_identifier = CASE WHEN ?2 THEN NULL ELSE folder_identifier END,
					 remind_at = CASE WHEN ?3 THEN NULL ELSE remind_at END,
					 remind_set_at = CASE WHEN ?3 THEN NULL ELSE remind_set_at END,
					 stop_requested = CASE WHEN ?4 THEN 1 ELSE stop_requested END,
					 nation_identifier = COALESCE(nation_identifier, ?5), updated_at = ?1
					 WHERE identifier = ?6`
				)
				.bind(stamp, comesBack ? 1 : 0, answers ? 1 : 0, !automatic && asksToStop(text) ? 1 : 0, nation, threadIdentifier)
		);
	} else {
		statements.push(
			database
				.prepare(
					`INSERT INTO mail_threads (identifier, subject, normalized_subject, folder, unread, project_address, counterpart_address,
					 counterpart_name, nation_identifier, message_count, last_message_at, last_inbound_at, stop_requested, created_at, updated_at, inbox_identifier)
					 VALUES (?1, ?2, ?3, ?4, 1, ?5, ?6, ?7, ?8, 1, ?9, ?9, ?10, ?9, ?9, ?11)`
				)
				.bind(
					threadIdentifier,
					subject,
					normalized,
					spam ? 'spam' : 'inbox',
					projectAddress,
					counterpart.email,
					counterpart.name ?? null,
					nation,
					stamp,
					!automatic && asksToStop(text) ? 1 : 0,
					inbox.identifier
				)
		);
	}
	statements.push(
		database
			.prepare(
				`INSERT INTO mail_messages (identifier, thread_identifier, direction, status, message_id, in_reply_to, reference_ids,
				 from_address, from_name, to_list, cc_list, reply_to, subject, text_body, snippet, html_key, raw_key, size, spam_reason,
				 automatic, list_unsubscribe, list_unsubscribe_post, received_at, created_at)
				 VALUES (?, ?, 'in', 'received', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(
				identifier,
				threadIdentifier,
				messageIds(email.messageId)[0] ?? null,
				messageIds(email.inReplyTo)[0] ?? null,
				messageIds(email.references).join(' ') || null,
				from.email,
				from.name ?? null,
				JSON.stringify(to),
				JSON.stringify(cc),
				replyTo?.email ?? null,
				subject,
				text,
				snippetOf(text),
				htmlKey,
				rawKey,
				raw.byteLength,
				spam,
				automatic ? 1 : 0,
				header(email, 'list-unsubscribe')?.slice(0, 2000) ?? null,
				header(email, 'list-unsubscribe-post')?.slice(0, 200) ?? null,
				email.date ? new Date(email.date).toISOString() : stamp,
				stamp
			),
		database
			.prepare('INSERT INTO mail_search (subject, sender, body, message_identifier, thread_identifier) VALUES (?, ?, ?, ?, ?)')
			.bind(subject, `${from.name ?? ''} ${from.email}`.trim(), text.slice(0, 100_000), identifier, threadIdentifier),
		...attachmentRows.map((row) =>
			database
				.prepare(
					`INSERT INTO mail_attachments (identifier, message_identifier, filename, media_type, size, content_id, inline, bucket_key)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
				)
				.bind(row.id, identifier, row.filename, row.mediaType, row.size, row.contentId, row.inline, row.key)
		)
	);
	if (!automatic) {
		// A reply to outreach: mark the recipient as replied and tag the conversation.
		statements.push(
			database
				.prepare(`UPDATE outreach_recipients SET status = 'replied', replied_at = ? WHERE thread_identifier = ? AND status = 'sent'`)
				.bind(stamp, threadIdentifier),
			database
				.prepare(
					`INSERT OR IGNORE INTO mail_thread_tags (thread_identifier, tag_identifier)
					 SELECT ?1, 'tag-outreach-reply' WHERE EXISTS (SELECT 1 FROM outreach_recipients WHERE thread_identifier = ?1)
					 AND EXISTS (SELECT 1 FROM mail_tags WHERE identifier = 'tag-outreach-reply')`
				)
				.bind(threadIdentifier)
		);
	}
	await database.batch(statements);
	// Every attachment is held until the virus check says clean (src/lib/server/mail/scans.ts).

	if (report) await applyDeliveryReport(context, report, identifier);

	// Auto-sort rules (src/lib/server/mail/rules.ts), for mail a person wrote or a machine sent, not for Spam or delivery reports.
	// They are the team's, so they sort shared inboxes only; nobody else's rules touch a personal inbox.
	const personal = inbox.kind === 'personal';
	const sortedBy =
		spam || report || personal
			? []
			: await runRules(
					context,
					threadIdentifier,
					factsFor({
						fromAddress: from.email,
						fromName: from.name ?? null,
						to: [...to, ...cc].flatMap(ruleAddressForms).concat(projectAddress ? [projectAddress] : []),
						subject,
						body: text,
						attachment: attachmentRows.some((row) => row.inline === 0),
						nation: nation !== null,
						automatic
					})
				);

	// A rule that marked the mail read or filed it away also means no "new mail" notice for it.
	const quietened =
		sortedBy.length > 0 &&
		(await context.database
			.prepare(`SELECT 1 AS found FROM mail_threads WHERE identifier = ? AND (unread = 0 OR folder IN ('archive', 'trash', 'spam'))`)
			.bind(threadIdentifier)
			.first()) !== null;
	// The "new mail" notice is about the team's mail, so a personal inbox's mail does not send it.
	const notify = !spam && !automatic && !quietened && !personal && (await noticeDue(context, at));
	const fromList = header(email, 'list-id') !== null || header(email, 'list-unsubscribe') !== null;
	// The away message is the team's, so it answers mail to shared inboxes only.
	const answerable = !spam && !automatic && !fromList && !personal && !isProjectAddress(settings, from.email);
	return { outcome: 'filed', threadIdentifier, messageIdentifier: identifier, spam: spam !== null, automatic, notify, answerable, sortedBy };
}

/** Marks the message a delivery report is about, and puts a permanently failed address on the do-not-email list. */
async function applyDeliveryReport(context: MailContext, report: DeliveryReport, reportIdentifier: string): Promise<void> {
	const at = currentTime(context).toISOString();
	let messageIdentifier: string | null = null;
	for (const id of report.originalIds) {
		const row = await context.database
			.prepare('SELECT identifier FROM mail_messages WHERE (message_id = ?1 OR provider_message_id = ?1) AND direction = ? LIMIT 1')
			.bind(id, 'out')
			.first<{ identifier: string }>();
		if (row) {
			messageIdentifier = row.identifier;
			break;
		}
	}
	const statements = [];
	for (const recipient of report.recipients.length ? report.recipients : [null]) {
		statements.push(
			context.database
				.prepare(
					`INSERT INTO mail_delivery_events (identifier, message_identifier, provider_message_id, recipient, event_type, detail, occurred_at, received_at)
					 VALUES (?, ?, NULL, ?, ?, ?, ?, ?)`
				)
				.bind(crypto.randomUUID(), messageIdentifier, recipient, `report.${report.status}`, `${report.detail} (report ${reportIdentifier})`, at, at)
		);
	}
	if (messageIdentifier) {
		statements.push(
			context.database
				.prepare(`UPDATE mail_messages SET delivery_status = ?, delivery_detail = ?, delivery_at = ? WHERE identifier = ?`)
				.bind(report.status, report.detail, at, messageIdentifier)
		);
		if (report.status === 'bounced') {
			statements.push(
				context.database
					.prepare(`UPDATE outreach_recipients SET status = 'bounced' WHERE message_identifier = ? AND status IN ('sent', 'queued')`)
					.bind(messageIdentifier)
			);
		}
	}
	await context.database.batch(statements);
	if (report.status === 'bounced') {
		for (const recipient of report.recipients) await suppress(context, recipient, 'hard-bounce', { source: 'delivery report' });
	}
}

/**
 * Whether to send the "new mail" notice now: at most one every 30 minutes,
 * so a busy day sends a few notices, not one per message.
 */
export async function noticeDue(context: MailContext, at: Date): Promise<boolean> {
	if (!context.settings.noticeAddress || isProjectAddress(context.settings, context.settings.noticeAddress)) return false;
	const last = await context.database.prepare(`SELECT value FROM mail_state WHERE key = 'last-notice-at'`).first<{ value: string }>();
	if (last && at.getTime() - new Date(last.value).getTime() < 30 * 60_000) return false;
	await context.database
		.prepare(`INSERT INTO mail_state (key, value) VALUES ('last-notice-at', ?1) ON CONFLICT (key) DO UPDATE SET value = ?1`)
		.bind(at.toISOString())
		.run();
	return true;
}
