/**
 * Writing mail in the project inbox (site/MAIL.md, "Writing"): a signature
 * for each of the inbox's addresses, saved replies, drafts that save
 * themselves, the pause before a message goes so it can be pulled back
 * (undo send), and the away message.
 *
 * The tables are in migrations/20261123T0510_add_mail_writing.sql. Signatures, saved
 * replies, the pause and the away message belong to the whole inbox, so
 * only someone who manages it changes them; drafts belong to the person
 * writing.
 */
import { replySubject, signatureBlock, unknownFields, type MailAddress } from '#lib/mail.ts';
import { actionStatement, currentTime, type MailCarriers, type MailContext } from './context.ts';
import { queueMessage, sendMessage } from './outbound.ts';
import { isProjectAddress } from './settings.ts';
import { isSuppressed } from './suppressions.ts';

export class WritingError extends Error {}

// ---------------------------------------------------------------------------
// Signatures
// ---------------------------------------------------------------------------

export const signatureLimit = 2000;

/** The signature of each of the inbox's addresses that has one. */
export async function listSignatures(context: MailContext): Promise<Record<string, string>> {
	const { results } = await context.database.prepare('SELECT address, body FROM mail_signatures').all<{ address: string; body: string }>();
	const signatures: Record<string, string> = {};
	for (const row of results) if (context.settings.addresses.includes(row.address)) signatures[row.address] = row.body;
	return signatures;
}

/** Saves the signature of one address; an empty one takes it away. */
export async function saveSignature(context: MailContext, personIdentifier: string, address: string, body: string): Promise<void> {
	const lower = address.toLowerCase();
	if (!context.settings.addresses.includes(lower)) throw new WritingError('Choose one of the inbox’s addresses.');
	const text = cleanBody(body).replace(/^-- ?\n/, '');
	if (text.length > signatureLimit) throw new WritingError(`A signature can be at most ${signatureLimit} characters.`);
	const at = currentTime(context).toISOString();
	await context.database.batch([
		text
			? context.database
					.prepare(
						`INSERT INTO mail_signatures (address, body, updated_by, updated_at) VALUES (?1, ?2, ?3, ?4)
						 ON CONFLICT (address) DO UPDATE SET body = ?2, updated_by = ?3, updated_at = ?4`
					)
					.bind(lower, text, personIdentifier, at)
			: context.database.prepare('DELETE FROM mail_signatures WHERE address = ?').bind(lower),
		actionStatement(context, { personIdentifier, action: text ? 'Changed a signature' : 'Took away a signature', note: lower })
	]);
}

function cleanBody(body: string): string {
	return body.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trim();
}

// ---------------------------------------------------------------------------
// Saved replies
// ---------------------------------------------------------------------------

export interface SavedReply {
	identifier: string;
	name: string;
	body: string;
	updatedAt: string;
}

export const savedReplyLimit = 20_000;

export async function listSavedReplies(context: MailContext): Promise<SavedReply[]> {
	const { results } = await context.database
		.prepare('SELECT identifier, name, body, updated_at AS updatedAt FROM mail_saved_replies ORDER BY name COLLATE NOCASE')
		.all<SavedReply>();
	return results;
}

/** Makes a saved reply, or changes one when an identifier is given. Returns its identifier. */
export async function saveSavedReply(
	context: MailContext,
	personIdentifier: string,
	reply: { identifier?: string | null; name: string; body: string }
): Promise<string> {
	const name = reply.name.replace(/\s+/g, ' ').trim().slice(0, 80);
	const body = cleanBody(reply.body);
	if (!name) throw new WritingError('Give the saved reply a name.');
	if (!body) throw new WritingError('Write the saved reply’s words.');
	if (body.length > savedReplyLimit) throw new WritingError('A saved reply can be at most 20,000 characters.');
	const unknown = unknownFields(body);
	if (unknown.length) throw new WritingError(`The site does not know these fields: ${unknown.map((key) => `{{ ${key} }}`).join(', ')}.`);
	const clash = await context.database
		.prepare('SELECT identifier FROM mail_saved_replies WHERE name = ? COLLATE NOCASE AND identifier <> ?')
		.bind(name, reply.identifier ?? '')
		.first<{ identifier: string }>();
	if (clash) throw new WritingError(`There is already a saved reply called “${name}”.`);
	const at = currentTime(context).toISOString();
	if (reply.identifier) {
		const changed = await context.database
			.prepare('UPDATE mail_saved_replies SET name = ?, body = ?, updated_at = ? WHERE identifier = ?')
			.bind(name, body, at, reply.identifier)
			.run();
		if ((changed.meta.changes ?? 0) === 0) throw new WritingError('That saved reply is gone.');
		await actionStatement(context, { personIdentifier, action: 'Changed a saved reply', note: name }).run();
		return reply.identifier;
	}
	const identifier = crypto.randomUUID();
	await context.database.batch([
		context.database
			.prepare('INSERT INTO mail_saved_replies (identifier, name, body, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
			.bind(identifier, name, body, personIdentifier, at, at),
		actionStatement(context, { personIdentifier, action: 'Made a saved reply', note: name })
	]);
	return identifier;
}

export async function deleteSavedReply(context: MailContext, personIdentifier: string, identifier: string): Promise<void> {
	const row = await context.database.prepare('SELECT name FROM mail_saved_replies WHERE identifier = ?').bind(identifier).first<{ name: string }>();
	if (!row) return;
	await context.database.batch([
		context.database.prepare('DELETE FROM mail_saved_replies WHERE identifier = ?').bind(identifier),
		actionStatement(context, { personIdentifier, action: 'Deleted a saved reply', note: row.name })
	]);
}

// ---------------------------------------------------------------------------
// The pause before a message goes (undo send)
// ---------------------------------------------------------------------------

/**
 * The choices for the pause, in seconds. The longest stays well inside the
 * time a Worker may keep working after it has answered (Cloudflare,
 * "waitUntil": 30 seconds), so the message goes on time; the five-minute
 * tick sends it if that ever fails.
 */
export const undoChoices = [0, 5, 10, 20] as const;
export const defaultUndoSeconds = 10;

async function preference(context: MailContext, key: string): Promise<string | null> {
	const row = await context.database.prepare('SELECT value FROM mail_preferences WHERE key = ?').bind(key).first<{ value: string }>();
	return row?.value ?? null;
}

function preferenceStatement(context: MailContext, personIdentifier: string, key: string, value: string) {
	return context.database
		.prepare(
			`INSERT INTO mail_preferences (key, value, updated_by, updated_at) VALUES (?1, ?2, ?3, ?4)
			 ON CONFLICT (key) DO UPDATE SET value = ?2, updated_by = ?3, updated_at = ?4`
		)
		.bind(key, value, personIdentifier, currentTime(context).toISOString());
}

export async function getUndoSeconds(context: MailContext): Promise<number> {
	const saved = await preference(context, 'undo-seconds');
	const value = Number(saved);
	return saved !== null && (undoChoices as readonly number[]).includes(value) ? value : defaultUndoSeconds;
}

export async function setUndoSeconds(context: MailContext, personIdentifier: string, seconds: number): Promise<void> {
	if (!(undoChoices as readonly number[]).includes(seconds)) throw new WritingError('Choose one of the offered pauses.');
	await context.database.batch([
		preferenceStatement(context, personIdentifier, 'undo-seconds', String(seconds)),
		actionStatement(context, { personIdentifier, action: 'Changed the pause before mail goes', note: `${seconds} seconds` })
	]);
}

// ---------------------------------------------------------------------------
// Drafts
// ---------------------------------------------------------------------------

export interface DraftFields {
	from: string;
	to: string;
	cc: string;
	bcc: string;
	subject: string;
	text: string;
	/** In a conversation: reply, reply to all or forward, and the message it answers. */
	mode: 'reply' | 'all' | 'forward' | null;
	message: string | null;
}

export interface Draft {
	identifier: string;
	threadIdentifier: string | null;
	fields: DraftFields;
	updatedAt: string;
}

export interface DraftSummary extends Draft {
	/** The conversation's subject, for a reply's draft. */
	threadSubject: string | null;
}

const fieldLimits: Record<keyof Omit<DraftFields, 'mode' | 'message'>, number> = {
	from: 200,
	to: 4000,
	cc: 4000,
	bcc: 4000,
	subject: 500,
	text: 200_000
};

/** The fields of a draft as sent by the page, cut to size; anything else is left out. */
export function draftFieldsFrom(value: unknown): DraftFields {
	const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
	const text = (key: keyof typeof fieldLimits) => (typeof source[key] === 'string' ? (source[key] as string).slice(0, fieldLimits[key]) : '');
	const mode = source.mode === 'reply' || source.mode === 'all' || source.mode === 'forward' ? source.mode : null;
	const message = typeof source.message === 'string' && /^[\w-]{1,100}$/.test(source.message) ? source.message : null;
	return { from: text('from'), to: text('to'), cc: text('cc'), bcc: text('bcc'), subject: text('subject'), text: text('text'), mode, message };
}

function draftOf(row: { identifier: string; thread_identifier: string | null; fields: string; updated_at: string }): Draft {
	let fields: unknown = {};
	try {
		fields = JSON.parse(row.fields);
	} catch {
		// A damaged draft opens empty.
	}
	return { identifier: row.identifier, threadIdentifier: row.thread_identifier, fields: draftFieldsFrom(fields), updatedAt: row.updated_at };
}

/**
 * Saves what the person has written so far. A reply's draft is one for each
 * person and conversation, so it is found again from the conversation; a
 * new message's draft is found by its identifier.
 */
export async function saveDraft(
	context: MailContext,
	personIdentifier: string,
	draft: { identifier?: string | null; threadIdentifier: string | null; fields: DraftFields }
): Promise<{ identifier: string; updatedAt: string }> {
	const at = currentTime(context).toISOString();
	const fields = JSON.stringify(draft.fields);
	if (draft.threadIdentifier) {
		const thread = await context.database.prepare('SELECT 1 AS found FROM mail_threads WHERE identifier = ?').bind(draft.threadIdentifier).first();
		if (!thread) throw new WritingError('This conversation is no longer in the inbox.');
		const identifier = crypto.randomUUID();
		const row = await context.database
			.prepare(
				`INSERT INTO mail_drafts (identifier, person_identifier, thread_identifier, fields, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)
				 ON CONFLICT (person_identifier, thread_identifier) WHERE thread_identifier IS NOT NULL DO UPDATE SET fields = ?4, updated_at = ?5
				 RETURNING identifier`
			)
			.bind(identifier, personIdentifier, draft.threadIdentifier, fields, at)
			.first<{ identifier: string }>();
		return { identifier: row?.identifier ?? identifier, updatedAt: at };
	}
	if (draft.identifier) {
		const changed = await context.database
			.prepare('UPDATE mail_drafts SET fields = ?, updated_at = ? WHERE identifier = ? AND person_identifier = ? AND thread_identifier IS NULL')
			.bind(fields, at, draft.identifier, personIdentifier)
			.run();
		if ((changed.meta.changes ?? 0) > 0) return { identifier: draft.identifier, updatedAt: at };
	}
	const identifier = crypto.randomUUID();
	await context.database
		.prepare('INSERT INTO mail_drafts (identifier, person_identifier, thread_identifier, fields, updated_at) VALUES (?, ?, NULL, ?, ?)')
		.bind(identifier, personIdentifier, fields, at)
		.run();
	return { identifier, updatedAt: at };
}

export async function getDraft(context: MailContext, personIdentifier: string, identifier: string): Promise<Draft | null> {
	const row = await context.database
		.prepare('SELECT identifier, thread_identifier, fields, updated_at FROM mail_drafts WHERE identifier = ? AND person_identifier = ?')
		.bind(identifier, personIdentifier)
		.first<{ identifier: string; thread_identifier: string | null; fields: string; updated_at: string }>();
	return row ? draftOf(row) : null;
}

export async function draftForThread(context: MailContext, personIdentifier: string, threadIdentifier: string): Promise<Draft | null> {
	const row = await context.database
		.prepare('SELECT identifier, thread_identifier, fields, updated_at FROM mail_drafts WHERE person_identifier = ? AND thread_identifier = ?')
		.bind(personIdentifier, threadIdentifier)
		.first<{ identifier: string; thread_identifier: string | null; fields: string; updated_at: string }>();
	return row ? draftOf(row) : null;
}

export async function listDrafts(context: MailContext, personIdentifier: string): Promise<DraftSummary[]> {
	const { results } = await context.database
		.prepare(
			`SELECT d.identifier, d.thread_identifier, d.fields, d.updated_at, t.subject AS thread_subject FROM mail_drafts d
			 LEFT JOIN mail_threads t ON t.identifier = d.thread_identifier WHERE d.person_identifier = ? ORDER BY d.updated_at DESC LIMIT 200`
		)
		.bind(personIdentifier)
		.all<{ identifier: string; thread_identifier: string | null; fields: string; updated_at: string; thread_subject: string | null }>();
	return results.map((row) => ({ ...draftOf(row), threadSubject: row.thread_subject }));
}

export async function countDrafts(context: MailContext, personIdentifier: string): Promise<number> {
	const row = await context.database
		.prepare('SELECT COUNT(*) AS count FROM mail_drafts WHERE person_identifier = ?')
		.bind(personIdentifier)
		.first<{ count: number }>();
	return row?.count ?? 0;
}

/** Throws a draft away: by its identifier, or a conversation's draft by the conversation. */
export async function deleteDraft(context: MailContext, personIdentifier: string, which: { identifier?: string | null; threadIdentifier?: string | null }): Promise<void> {
	if (which.identifier) {
		await context.database.prepare('DELETE FROM mail_drafts WHERE identifier = ? AND person_identifier = ?').bind(which.identifier, personIdentifier).run();
	}
	if (which.threadIdentifier) {
		await context.database
			.prepare('DELETE FROM mail_drafts WHERE thread_identifier = ? AND person_identifier = ?')
			.bind(which.threadIdentifier, personIdentifier)
			.run();
	}
}

// ---------------------------------------------------------------------------
// Undo send
// ---------------------------------------------------------------------------

/**
 * Pulls back a message during the pause before it goes, and puts it back in
 * a draft. A new message's conversation is removed with it, since nothing
 * else is in it. Attachments are not kept in drafts. Returns the draft and
 * the conversation it belongs to (null when the conversation was removed),
 * or null when the message has already gone.
 */
export async function undoSend(
	context: MailContext,
	personIdentifier: string,
	messageIdentifier: string
): Promise<{ draftIdentifier: string; threadIdentifier: string | null; hadAttachments: boolean } | null> {
	const database = context.database;
	const row = await database
		.prepare(
			`SELECT thread_identifier, from_address, to_list, cc_list, bcc_list, subject, text_body, in_reply_to FROM mail_messages
			 WHERE identifier = ? AND status = 'scheduled' AND held_for_undo = 1`
		)
		.bind(messageIdentifier)
		.first<{ thread_identifier: string; from_address: string; to_list: string; cc_list: string; bcc_list: string; subject: string; text_body: string; in_reply_to: string | null }>();
	if (!row) return null;
	// Claim it first, so the end of the pause cannot send it while it is being pulled back.
	const claimed = await database
		.prepare(`UPDATE mail_messages SET status = 'cancelled', held_for_undo = 0 WHERE identifier = ? AND status = 'scheduled' AND held_for_undo = 1`)
		.bind(messageIdentifier)
		.run();
	if ((claimed.meta.changes ?? 0) === 0) return null;

	const others = await database
		.prepare(`SELECT COUNT(*) AS count FROM mail_messages WHERE thread_identifier = ? AND identifier <> ? AND status <> 'cancelled'`)
		.bind(row.thread_identifier, messageIdentifier)
		.first<{ count: number }>();
	const { results: files } = await database
		.prepare('SELECT bucket_key FROM mail_attachments WHERE message_identifier = ?')
		.bind(messageIdentifier)
		.all<{ bucket_key: string }>();
	const answered = row.in_reply_to
		? await database
				.prepare('SELECT identifier FROM mail_messages WHERE thread_identifier = ? AND message_id = ?')
				.bind(row.thread_identifier, row.in_reply_to)
				.first<{ identifier: string }>()
		: null;
	const list = (value: string) => (JSON.parse(value) as MailAddress[]).map((item) => item.email).join(', ');
	const keepsThread = (others?.count ?? 0) > 0;
	const fields: DraftFields = {
		from: row.from_address,
		to: list(row.to_list),
		cc: list(row.cc_list),
		bcc: list(row.bcc_list),
		subject: row.subject,
		text: row.text_body,
		mode: keepsThread ? (row.in_reply_to ? 'reply' : 'forward') : null,
		message: answered?.identifier ?? null
	};
	const draft = await saveDraft(context, personIdentifier, { threadIdentifier: keepsThread ? row.thread_identifier : null, fields });
	if (files.length) await context.bucket.delete(files.map((file) => file.bucket_key));
	const statements = [database.prepare('DELETE FROM mail_attachments WHERE message_identifier = ?').bind(messageIdentifier)];
	if (keepsThread) {
		statements.push(actionStatement(context, { personIdentifier, action: 'Undid sending a message', threadIdentifier: row.thread_identifier }));
	} else {
		statements.push(
			database.prepare('DELETE FROM mail_threads WHERE identifier = ?').bind(row.thread_identifier),
			actionStatement(context, { personIdentifier, action: 'Undid sending a new message', note: row.subject })
		);
	}
	await database.batch(statements);
	return { draftIdentifier: draft.identifier, threadIdentifier: keepsThread ? row.thread_identifier : null, hadAttachments: files.length > 0 };
}

// ---------------------------------------------------------------------------
// The away message
// ---------------------------------------------------------------------------

export interface AwayMessage {
	on: boolean;
	/** When it starts and stops, as UTC; either may be open. */
	from: string | null;
	until: string | null;
	subject: string;
	text: string;
	/** When it was last switched on; each sender gets it once from then. */
	since: string | null;
}

export const noAway: AwayMessage = { on: false, from: null, until: null, subject: '', text: '', since: null };

export async function getAway(context: MailContext): Promise<AwayMessage> {
	const value = await preference(context, 'away');
	if (!value) return noAway;
	try {
		const parsed = JSON.parse(value) as Partial<AwayMessage>;
		return {
			on: parsed.on === true,
			from: typeof parsed.from === 'string' ? parsed.from : null,
			until: typeof parsed.until === 'string' ? parsed.until : null,
			subject: typeof parsed.subject === 'string' ? parsed.subject : '',
			text: typeof parsed.text === 'string' ? parsed.text : '',
			since: typeof parsed.since === 'string' ? parsed.since : null
		};
	} catch {
		return noAway;
	}
}

/** Whether the away message answers mail arriving now. */
export function awayAnswers(away: AwayMessage, at: Date): boolean {
	if (!away.on || !away.text.trim()) return false;
	if (away.from && at.getTime() < new Date(away.from).getTime()) return false;
	if (away.until && at.getTime() >= new Date(away.until).getTime()) return false;
	return true;
}

/**
 * Saves the away message. Switching it on (or changing its words) starts a
 * new round, so everyone who writes gets it once again.
 */
export async function saveAway(context: MailContext, personIdentifier: string, away: Omit<AwayMessage, 'since'>): Promise<void> {
	const text = cleanBody(away.text);
	if (away.on && !text) throw new WritingError('Write the away message before switching it on.');
	if (text.length > savedReplyLimit) throw new WritingError('The away message can be at most 20,000 characters.');
	if (away.from && away.until && new Date(away.until).getTime() <= new Date(away.from).getTime()) {
		throw new WritingError('The end has to come after the start.');
	}
	const before = await getAway(context);
	const newRound = away.on && (!before.on || before.text !== text);
	const saved: AwayMessage = {
		on: away.on,
		from: away.from,
		until: away.until,
		subject: away.subject.replace(/\s+/g, ' ').trim().slice(0, 200),
		text,
		since: away.on ? (newRound ? currentTime(context).toISOString() : before.since) : null
	};
	const statements = [
		preferenceStatement(context, personIdentifier, 'away', JSON.stringify(saved)),
		actionStatement(context, { personIdentifier, action: away.on ? 'Switched the away message on' : 'Switched the away message off' })
	];
	if (newRound || !away.on) statements.push(context.database.prepare('DELETE FROM mail_away_replies'));
	await context.database.batch(statements);
}

/** Senders that never get an away message: machines and bounce addresses. */
const machineSenders = /^(no-?reply|do-?not-?reply|mailer-daemon|postmaster|bounces?|notifications?)([+._-]|@)/i;

/**
 * Answers a message that just arrived with the away message, when it is on
 * and the sender has not had it yet this round. Never for Spam, automatic
 * replies, mailing lists, machines, the project's own addresses, or
 * addresses on the do-not-email list (RFC 3834, section 2). Returns whether
 * it was sent.
 */
export async function sendAwayReply(
	context: MailContext,
	carriers: MailCarriers,
	arrival: { threadIdentifier: string; messageIdentifier: string }
): Promise<boolean> {
	const at = currentTime(context);
	const away = await getAway(context);
	if (!awayAnswers(away, at) || !carriers.replies) return false;
	const message = await context.database
		.prepare(
			`SELECT m.from_address, m.from_name, m.reply_to, m.subject, t.project_address FROM mail_messages m
			 JOIN mail_threads t ON t.identifier = m.thread_identifier WHERE m.identifier = ? AND m.direction = 'in'`
		)
		.bind(arrival.messageIdentifier)
		.first<{ from_address: string; from_name: string | null; reply_to: string | null; subject: string; project_address: string | null }>();
	if (!message) return false;
	const recipient = (message.reply_to ?? message.from_address).toLowerCase();
	if (machineSenders.test(recipient) || isProjectAddress(context.settings, recipient)) return false;
	if (await isSuppressed(context, recipient)) return false;
	// Record the sender first, so a second message arriving at the same moment does not get a second answer.
	const recorded = await context.database
		.prepare(
			`INSERT INTO mail_away_replies (address, sent_at) VALUES (?1, ?2)
			 ON CONFLICT (address) DO UPDATE SET sent_at = ?2 WHERE mail_away_replies.sent_at < ?3`
		)
		.bind(recipient, at.toISOString(), away.since ?? '')
		.run();
	if ((recorded.meta.changes ?? 0) === 0) return false;

	const from =
		message.project_address && context.settings.addresses.includes(message.project_address) ? message.project_address : context.settings.defaultAddress;
	if (!from) return false;
	const signatures = await listSignatures(context);
	const queued = await queueMessage(context, {
		personIdentifier: null,
		automatic: true,
		threadIdentifier: arrival.threadIdentifier,
		answering: arrival.messageIdentifier,
		from,
		to: [{ email: recipient, name: message.reply_to ? null : message.from_name }],
		subject: away.subject || replySubject(message.subject),
		text: `${away.text}${signatureBlock(signatures[from] ?? '')}`
	});
	const sent = await sendMessage(context, carriers, queued.messageIdentifier, {
		headers: { 'Auto-Submitted': 'auto-replied', 'X-Auto-Response-Suppress': 'All' }
	});
	return sent.sent;
}
