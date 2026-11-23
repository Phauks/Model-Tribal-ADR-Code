/**
 * Mail going out from the project inbox: replies, new messages, scheduled
 * sends, and the delivery reports that come back (site/MAIL.md, "How mail
 * goes out").
 *
 * A message is written to mail_messages first (as "scheduled" when it waits
 * for a time, or "sending"), then handed to a carrier
 * (src/lib/server/mail/carriers.ts). Replies and other mail people started
 * go through Cloudflare Email Service; outreach goes through the outreach
 * carrier (src/lib/server/mail/outreach.ts). A copy of every sent message is
 * kept in the bucket like received mail.
 */
import { snippetOf, textToHtml, type MailAddress, normalizeSubject } from '#lib/mail.ts';
import { buildRawMessage, newMessageId, type OutgoingAttachment, type OutgoingMail } from './mime.ts';
import { actionStatement, bucketKeys, currentTime, type MailCarriers, type MailContext } from './context.ts';
import { noticeHeader } from './inbound.ts';
import { openScannedFile, stillScanning, storeSentFile } from '#lib/server/file-scans.ts';
import { heldForVirusCheck } from '#lib/mail.ts';
import { suppress, suppressedAmong } from './suppressions.ts';

/** Cloudflare Email Service takes at most 50 recipients and 25 MiB a message ("Limits"). */
export const recipientLimit = 50;
/** Attachments a person adds, before encoding, which adds about a third. */
export const attachmentLimitBytes = 18 * 1024 * 1024;

export interface Composition {
	personIdentifier: string;
	/** The conversation this replies in, or null for a new one. */
	threadIdentifier: string | null;
	/** One of the project's addresses. */
	from: string;
	to: MailAddress[];
	cc?: MailAddress[];
	bcc?: MailAddress[];
	subject: string;
	text: string;
	attachments?: { filename: string; mediaType: string; content: Uint8Array }[];
	/** Send at this time instead of now. */
	sendAt?: string | null;
	/** In a conversation, the message this answers; the latest one when not given. */
	answering?: string | null;
	/**
	 * Forwarding a message of this conversation: it does not thread as a
	 * reply, the do-not-email list is checked as for a new message, and the
	 * chosen attachments of the forwarded message go with it.
	 */
	forward?: { message: string; attachments: string[] } | null;
	/** "Remind me": the conversation comes back to the inbox at this time unless a reply comes first. */
	remindAt?: string | null;
}

export class CompositionError extends Error {}

/**
 * Saves a message to send, now or later, and starts a conversation for it
 * when it is not a reply. A new message (not a reply) is refused when a
 * recipient is on the do-not-email list.
 */
export async function queueMessage(context: MailContext, composition: Composition): Promise<{ messageIdentifier: string; threadIdentifier: string; scheduled: boolean }> {
	const database = context.database;
	const at = currentTime(context);
	const stamp = at.toISOString();
	const recipients = [...composition.to, ...(composition.cc ?? []), ...(composition.bcc ?? [])];
	if (composition.to.length === 0) throw new CompositionError('Add at least one address in To.');
	if (recipients.length > recipientLimit) throw new CompositionError(`A message can go to at most ${recipientLimit} addresses.`);
	if (!context.settings.addresses.includes(composition.from.toLowerCase())) throw new CompositionError('Choose one of the project’s addresses to send from.');
	const forward = composition.threadIdentifier ? (composition.forward ?? null) : null;
	const attachments = [...(composition.attachments ?? []), ...(forward ? await forwardedAttachments(context, composition.threadIdentifier!, forward) : [])];
	const size = attachments.reduce((total, item) => total + item.content.byteLength, 0);
	if (size > attachmentLimitBytes) throw new CompositionError('The attachments are too large together; the limit is 18 MB.');

	let threadIdentifier = composition.threadIdentifier;
	let inReplyTo: string | null = null;
	let references: string | null = null;
	if (threadIdentifier && !forward) {
		const answered = await database
			.prepare(
				`SELECT message_id, reference_ids FROM mail_messages WHERE thread_identifier = ?1 AND message_id IS NOT NULL
				 AND status IN ('received', 'sent') ORDER BY identifier = ?2 DESC, COALESCE(received_at, sent_at) DESC LIMIT 1`
			)
			.bind(threadIdentifier, composition.answering ?? '')
			.first<{ message_id: string; reference_ids: string | null }>();
		if (answered) {
			inReplyTo = answered.message_id;
			references = [...(answered.reference_ids ?? '').split(/\s+/).filter(Boolean).slice(-10), answered.message_id].join(' ');
		}
	} else {
		const suppressed = await suppressedAmong(context, recipients.map((item) => item.email));
		if (suppressed.size) {
			throw new CompositionError(`These addresses are on the do-not-email list: ${[...suppressed].join(', ')}.`);
		}
	}

	const sendAt = composition.sendAt && new Date(composition.sendAt).getTime() > at.getTime() + 30_000 ? new Date(composition.sendAt).toISOString() : null;
	const messageIdentifier = crypto.randomUUID();
	const statements = [];
	if (!threadIdentifier) {
		threadIdentifier = crypto.randomUUID();
		const counterpart = composition.to[0];
		statements.push(
			database
				.prepare(
					`INSERT INTO mail_threads (identifier, subject, normalized_subject, folder, unread, project_address, counterpart_address,
					 counterpart_name, message_count, last_message_at, created_at, updated_at)
					 VALUES (?1, ?2, ?3, 'archive', 0, ?4, ?5, ?6, 0, ?7, ?7, ?7)`
				)
				.bind(threadIdentifier, composition.subject, normalizeSubject(composition.subject), composition.from.toLowerCase(), counterpart.email, counterpart.name ?? null, stamp)
		);
	}
	statements.push(
		database
			.prepare(
				`INSERT INTO mail_messages (identifier, thread_identifier, direction, status, in_reply_to, reference_ids, from_address,
				 to_list, cc_list, bcc_list, subject, text_body, snippet, sent_by, scheduled_for, carrier, created_at)
				 VALUES (?, ?, 'out', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'cloudflare', ?)`
			)
			.bind(
				messageIdentifier,
				threadIdentifier,
				sendAt ? 'scheduled' : 'sending',
				inReplyTo,
				references,
				composition.from.toLowerCase(),
				JSON.stringify(composition.to),
				JSON.stringify(composition.cc ?? []),
				JSON.stringify(composition.bcc ?? []),
				composition.subject,
				composition.text,
				snippetOf(composition.text),
				composition.personIdentifier,
				sendAt,
				stamp
			)
	);
	for (const attachment of attachments) {
		const id = crypto.randomUUID();
		const key = bucketKeys.attachment(messageIdentifier, id);
		// Held until the virus check passes; sendMessage waits for it (site/SCANNING.md).
		await storeSentFile(
			context.database,
			context.bucket,
			{ objectKey: key, purpose: 'mail-outgoing', subject: messageIdentifier, bytes: attachment.content, httpMetadata: { contentType: attachment.mediaType } },
			at
		);
		statements.push(
			database
				.prepare(
					`INSERT INTO mail_attachments (identifier, message_identifier, filename, media_type, size, inline, bucket_key) VALUES (?, ?, ?, ?, ?, 0, ?)`
				)
				.bind(id, messageIdentifier, attachment.filename, attachment.mediaType, attachment.content.byteLength, key)
		);
	}
	if (composition.remindAt) {
		statements.push(
			database
				.prepare('UPDATE mail_threads SET remind_at = ?, remind_set_at = ? WHERE identifier = ?')
				.bind(new Date(composition.remindAt).toISOString(), sendAt ?? stamp, threadIdentifier)
		);
	}
	statements.push(
		actionStatement(context, {
			personIdentifier: composition.personIdentifier,
			action: sendAt ? 'Scheduled a message' : forward ? 'Forwarded' : composition.threadIdentifier ? 'Replied' : 'Wrote a new message',
			threadIdentifier,
			note: sendAt
		})
	);
	await database.batch(statements);
	return { messageIdentifier, threadIdentifier, scheduled: sendAt !== null };
}

/** The chosen attachments of a message in this conversation, read back from the bucket to forward. */
async function forwardedAttachments(
	context: MailContext,
	threadIdentifier: string,
	forward: { message: string; attachments: string[] }
): Promise<{ filename: string; mediaType: string; content: Uint8Array }[]> {
	const chosen = [...new Set(forward.attachments)].slice(0, 50);
	if (chosen.length === 0) return [];
	const { results } = await context.database
		.prepare(
			`SELECT a.filename, a.media_type, a.bucket_key, m.direction FROM mail_attachments a JOIN mail_messages m ON m.identifier = a.message_identifier
			 WHERE m.thread_identifier = ? AND a.message_identifier = ? AND a.identifier IN (${chosen.map(() => '?').join(', ')})`
		)
		.bind(threadIdentifier, forward.message, ...chosen)
		.all<{ filename: string; media_type: string; bucket_key: string; direction: string }>();
	const found = [];
	for (const row of results) {
		// A file goes on only once the virus check has passed (site/SCANNING.md).
		const opened = await openScannedFile(context.database, context.bucket, row.bucket_key);
		if (opened.state === 'missing') throw new CompositionError(`The attachment ${row.filename} is no longer stored, so it cannot be forwarded.`);
		if (opened.state === 'held') {
			throw new CompositionError(`The attachment ${row.filename} is held until the virus check passes, so it cannot be forwarded yet. Untick it to forward the message without it.`);
		}
		const object = opened.object;
		found.push({ filename: row.filename, mediaType: row.media_type, content: new Uint8Array(await object.arrayBuffer()) });
	}
	return found;
}

interface MessageRow {
	identifier: string;
	thread_identifier: string;
	status: string;
	from_address: string;
	to_list: string;
	cc_list: string;
	bcc_list: string;
	subject: string;
	text_body: string;
	in_reply_to: string | null;
	reference_ids: string | null;
	reply_to: string | null;
	outreach_recipient_identifier: string | null;
	sent_by: string | null;
}

export interface SendOptions {
	/** Headers to add, such as List-Unsubscribe for outreach. */
	headers?: Record<string, string>;
	/** The From name; the project's sender name when not given. */
	fromName?: string;
	/** Where replies should go. */
	replyTo?: string | null;
}

/**
 * Sends one waiting message through its carrier. The row is claimed first,
 * so two runs can never send the same message twice.
 */
export async function sendMessage(
	context: MailContext,
	carriers: MailCarriers,
	messageIdentifier: string,
	options: SendOptions = {}
): Promise<{ sent: boolean; held?: boolean; error?: string }> {
	const database = context.database;
	const at = currentTime(context);
	const claim = await database
		.prepare(
			`UPDATE mail_messages SET status = 'sending', error = NULL WHERE identifier = ? AND (status = 'scheduled' OR (status = 'sending' AND sent_at IS NULL))`
		)
		.bind(messageIdentifier)
		.run();
	if ((claim.meta.changes ?? 0) === 0) return { sent: false, error: 'The message was already sent or cancelled.' };
	const row = await database.prepare('SELECT * FROM mail_messages WHERE identifier = ?').bind(messageIdentifier).first<MessageRow>();
	if (!row) return { sent: false, error: 'The message is gone.' };
	const outreach = row.outreach_recipient_identifier !== null;
	const carrier = outreach ? carriers.outreach : carriers.replies;
	const fail = async (message: string) => {
		await database.batch([
			database.prepare(`UPDATE mail_messages SET status = 'failed', error = ? WHERE identifier = ?`).bind(message, messageIdentifier),
			actionStatement(context, { personIdentifier: null, action: 'A message could not be sent', threadIdentifier: row.thread_identifier, note: message })
		]);
		return { sent: false, error: message };
	};
	if (!carrier || !context.settings.domain) {
		return fail(outreach ? 'The outreach mail service is not set up yet (site/MAIL.md, "Outreach").' : 'Sending is not switched on yet (site/MAIL.md, "Switching email on").');
	}

	const { results: attachmentRows } = await database
		.prepare('SELECT filename, media_type, content_id, bucket_key FROM mail_attachments WHERE message_identifier = ?')
		.bind(messageIdentifier)
		.all<{ filename: string; media_type: string; content_id: string | null; bucket_key: string }>();
	// Nothing goes out until every attachment has passed the virus check
	// (site/SCANNING.md). While a check is still running, the message waits as
	// scheduled and the five-minute run tries it again.
	const attachments: OutgoingAttachment[] = [];
	for (const item of attachmentRows) {
		const opened = await openScannedFile(database, context.bucket, item.bucket_key);
		if (opened.state === 'missing') return fail(`The attachment ${item.filename} is missing from storage.`);
		if (opened.state === 'held') {
			const scan = opened.scan;
			if (stillScanning(scan)) {
				await database
					.prepare(`UPDATE mail_messages SET status = 'scheduled', scheduled_for = ?, error = ? WHERE identifier = ?`)
					.bind(new Date(at.getTime() + 60_000).toISOString(), heldForVirusCheck, messageIdentifier)
					.run();
				return { sent: false, held: true, error: heldForVirusCheck };
			}
			return fail(
				scan?.status === 'flagged'
					? `The virus check found ${scan.reason ? `“${scan.reason}”` : 'something harmful'} in the attachment ${item.filename}, so the message was not sent. Remove it and send again.`
					: `The attachment ${item.filename} could not be checked for viruses, so the message was not sent. Remove it and send again.`
			);
		}
		const object = opened.object;
		attachments.push({
			filename: item.filename,
			mediaType: item.media_type,
			content: new Uint8Array(await object.arrayBuffer()),
			...(item.content_id ? { contentId: item.content_id } : {})
		});
	}
	const headers: Record<string, string> = { ...options.headers };
	if (row.in_reply_to) headers['In-Reply-To'] = `<${row.in_reply_to}>`;
	if (row.reference_ids) headers.References = row.reference_ids.split(/\s+/).filter(Boolean).map((id) => `<${id}>`).join(' ');
	const fromDomain = row.from_address.split('@')[1] ?? context.settings.domain;
	const mail: OutgoingMail = {
		from: { email: row.from_address, name: options.fromName ?? context.settings.senderName },
		to: JSON.parse(row.to_list) as MailAddress[],
		cc: JSON.parse(row.cc_list) as MailAddress[],
		bcc: JSON.parse(row.bcc_list) as MailAddress[],
		replyTo: options.replyTo ? { email: options.replyTo } : null,
		subject: row.subject,
		text: row.text_body,
		html: textToHtml(row.text_body),
		headers,
		attachments,
		messageId: newMessageId(fromDomain),
		date: at
	};

	let sentId: { messageId: string; providerMessageId: string | null };
	try {
		sentId = await carrier.send(mail);
	} catch (problem) {
		return fail(problem instanceof Error ? problem.message : String(problem));
	}

	// Keep a copy as sent, with the Message-ID the other side sees.
	const copy = buildRawMessage({ ...mail, messageId: sentId.messageId });
	const rawKey = bucketKeys.raw(messageIdentifier, at);
	await context.bucket.put(rawKey, copy, { httpMetadata: { contentType: 'message/rfc822' } });
	const stamp = at.toISOString();
	await database.batch([
		database
			.prepare(
				`UPDATE mail_messages SET status = 'sent', sent_at = ?, message_id = ?, provider_message_id = ?, carrier = ?, raw_key = ?, size = ?, reply_to = ?
				 WHERE identifier = ?`
			)
			.bind(stamp, sentId.messageId, sentId.providerMessageId, carrier.name, rawKey, copy.length, options.replyTo ?? null, messageIdentifier),
		database
			.prepare(
				`UPDATE mail_threads SET message_count = message_count + 1, last_message_at = ?1, last_outbound_at = ?1, updated_at = ?1 WHERE identifier = ?2`
			)
			.bind(stamp, row.thread_identifier),
		database
			.prepare('INSERT INTO mail_search (subject, sender, body, message_identifier, thread_identifier) VALUES (?, ?, ?, ?, ?)')
			.bind(row.subject, row.from_address, row.text_body.slice(0, 100_000), messageIdentifier, row.thread_identifier)
	]);
	return { sent: true };
}

/** Sends scheduled messages whose time has come (not outreach, which paces itself). Run by the mail tick. */
export async function sendDueMessages(context: MailContext, carriers: MailCarriers, limit = 20): Promise<number> {
	const { results } = await context.database
		.prepare(
			`SELECT identifier FROM mail_messages WHERE status = 'scheduled' AND scheduled_for <= ? AND outreach_recipient_identifier IS NULL
			 ORDER BY scheduled_for LIMIT ?`
		)
		.bind(currentTime(context).toISOString(), limit)
		.all<{ identifier: string }>();
	let sent = 0;
	for (const { identifier } of results) if ((await sendMessage(context, carriers, identifier)).sent) sent += 1;
	return sent;
}

export async function cancelScheduled(context: MailContext, personIdentifier: string, messageIdentifier: string): Promise<boolean> {
	const row = await context.database
		.prepare(`SELECT thread_identifier FROM mail_messages WHERE identifier = ? AND status IN ('scheduled', 'failed')`)
		.bind(messageIdentifier)
		.first<{ thread_identifier: string }>();
	if (!row) return false;
	await context.database.batch([
		context.database.prepare(`UPDATE mail_messages SET status = 'cancelled' WHERE identifier = ?`).bind(messageIdentifier),
		actionStatement(context, { personIdentifier, action: 'Cancelled a message', threadIdentifier: row.thread_identifier })
	]);
	return true;
}

/** Puts a failed message back to be sent, or a scheduled one to go now. */
export async function sendAgain(context: MailContext, personIdentifier: string, messageIdentifier: string): Promise<boolean> {
	const at = currentTime(context).toISOString();
	const result = await context.database
		.prepare(`UPDATE mail_messages SET status = 'scheduled', scheduled_for = ?, error = NULL WHERE identifier = ? AND status IN ('scheduled', 'failed')
			 AND outreach_recipient_identifier IS NULL`)
		.bind(at, messageIdentifier)
		.run();
	if ((result.meta.changes ?? 0) === 0) return false;
	await actionStatement(context, { personIdentifier, action: 'Sent a message again', note: messageIdentifier }).run();
	return true;
}

// ---------------------------------------------------------------------------
// Delivery reports from Cloudflare Email Service (Queues event subscription)
// ---------------------------------------------------------------------------

const deliveryOrder = ['deferred', 'delivered', 'failed', 'rejected', 'bounced', 'complained'];

/**
 * Records one Email Sending event ("Event subscriptions", event schema
 * version 1): the type, such as cf.email.sending.message.bounced, and a
 * payload with messageId, recipient, delivery and bounce details. A hard
 * bounce or a spam complaint puts the address on the do-not-email list.
 */
export async function recordDeliveryEvent(context: MailContext, event: unknown): Promise<boolean> {
	if (!event || typeof event !== 'object') return false;
	const { type, payload, metadata } = event as {
		type?: string;
		payload?: {
			messageId?: string;
			recipient?: string;
			delivery?: { status?: string; smtpResponse?: string };
			bounce?: { type?: string; reason?: string };
			rejection?: { reason?: string; detail?: string };
			failure?: { reason?: string };
			complaint?: { type?: string };
		};
		metadata?: { eventTimestamp?: string };
	};
	const kind = /message\.(delivered|deferred|bounced|failed|rejected|complained)$/.exec(type ?? '')?.[1];
	if (!kind || !payload?.messageId) return false;
	const providerId = payload.messageId.replace(/^<|>$/g, '');
	const message = await context.database
		.prepare('SELECT identifier, delivery_status FROM mail_messages WHERE provider_message_id = ?1 OR message_id = ?1 LIMIT 1')
		.bind(providerId)
		.first<{ identifier: string; delivery_status: string | null }>();
	const detail =
		payload.delivery?.smtpResponse ?? payload.bounce?.reason ?? payload.rejection?.detail ?? payload.failure?.reason ?? payload.complaint?.type ?? null;
	const occurred = metadata?.eventTimestamp ?? currentTime(context).toISOString();
	const received = currentTime(context).toISOString();
	const statements = [
		context.database
			.prepare(
				`INSERT INTO mail_delivery_events (identifier, message_identifier, provider_message_id, recipient, event_type, detail, occurred_at, received_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(crypto.randomUUID(), message?.identifier ?? null, providerId, payload.recipient?.toLowerCase() ?? null, kind, detail, occurred, received)
	];
	// A later, weaker event (a delay after delivery) does not replace a stronger one.
	if (message && deliveryOrder.indexOf(kind) >= deliveryOrder.indexOf(message.delivery_status ?? 'deferred')) {
		statements.push(
			context.database
				.prepare('UPDATE mail_messages SET delivery_status = ?, delivery_detail = ?, delivery_at = ? WHERE identifier = ?')
				.bind(kind, detail, occurred, message.identifier)
		);
	}
	await context.database.batch(statements);
	if (payload.recipient && ((kind === 'bounced' && payload.bounce?.type !== 'soft') || kind === 'complained')) {
		await suppress(context, payload.recipient, kind === 'complained' ? 'complaint' : 'hard-bounce', { source: 'Cloudflare Email Service', note: detail });
	}
	return true;
}

// ---------------------------------------------------------------------------
// The "new mail" notice and acknowledgments
// ---------------------------------------------------------------------------

/**
 * Tells the notice address that new mail is waiting, without quoting it,
 * so the message itself stays in the project's own storage.
 */
export async function sendNewMailNotice(context: MailContext, carriers: MailCarriers): Promise<boolean> {
	const { settings } = context;
	if (!carriers.replies || !settings.noticeAddress || !settings.defaultAddress) return false;
	const link = settings.siteAddress ? `${settings.siteAddress}/workspace/inbox` : 'the workspace inbox on the website';
	await carriers.replies.send({
		from: { email: settings.defaultAddress, name: `${settings.senderName} inbox` },
		to: [{ email: settings.noticeAddress }],
		subject: 'New mail in the project inbox',
		text: `New mail has arrived in the project inbox. Read it at ${link}.\n\nThis notice does not quote the message, so it stays in the project's own storage. At most one notice is sent every 30 minutes.`,
		headers: { [noticeHeader]: 'yes', 'X-Auto-Response-Suppress': 'All' },
		messageId: newMessageId(settings.domain ?? 'invalid')
	});
	return true;
}

/** Records the recipient's use of the visible "let us know you got this" link. */
export async function acknowledge(context: MailContext, messageIdentifier: string): Promise<boolean> {
	const at = currentTime(context).toISOString();
	const row = await context.database
		.prepare(`SELECT thread_identifier FROM mail_messages WHERE identifier = ? AND direction = 'out'`)
		.bind(messageIdentifier)
		.first<{ thread_identifier: string }>();
	if (!row) return false;
	await context.database.batch([
		context.database.prepare('UPDATE mail_messages SET acknowledged_at = COALESCE(acknowledged_at, ?) WHERE identifier = ?').bind(at, messageIdentifier),
		context.database
			.prepare(`UPDATE mail_threads SET remind_at = NULL, remind_set_at = NULL, unread = 1, updated_at = ? WHERE identifier = ?`)
			.bind(at, row.thread_identifier),
		actionStatement(context, { personIdentifier: null, action: 'The recipient said they got the message', threadIdentifier: row.thread_identifier })
	]);
	return true;
}

