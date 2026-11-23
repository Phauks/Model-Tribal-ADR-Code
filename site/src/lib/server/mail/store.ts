/**
 * Reading and changing conversations in the project inbox: the lists in the
 * left column, one conversation with its messages and notes, and the
 * actions on it (read, archive, delete, assign, label, snooze, follow up).
 * Every change is recorded in mail_actions.
 */
import type { Folder, InboxView, LabelColor, MailAddress } from '#lib/mail.ts';
import { actionStatement, currentTime, type MailContext } from './context.ts';

export interface ThreadSummary {
	identifier: string;
	subject: string;
	folder: Folder;
	unread: boolean;
	counterpartAddress: string | null;
	counterpartName: string | null;
	nationIdentifier: string | null;
	assigneeIdentifier: string | null;
	assigneeName: string | null;
	messageCount: number;
	lastMessageAt: string;
	snoozedUntil: string | null;
	followUpAt: string | null;
	stopRequested: boolean;
	snippet: string;
	hasAttachments: boolean;
	scheduledFor: string | null;
	labels: { identifier: string; name: string; color: LabelColor }[];
}

export interface MailLabel {
	identifier: string;
	name: string;
	color: LabelColor;
}

const pageSize = 50;

/**
 * Words typed into the search box as an FTS5 query: each word quoted, so
 * punctuation in an address or a name cannot change the query's meaning,
 * and the last word matched as a prefix while it is being typed.
 */
export function searchQuery(text: string): string | null {
	const words = text
		.normalize('NFC')
		.split(/\s+/)
		.map((word) => word.replace(/"/g, '').trim())
		.filter((word) => word.length > 0)
		.slice(0, 12);
	if (words.length === 0) return null;
	return words.map((word, index) => `"${word}"${index === words.length - 1 ? '*' : ''}`).join(' ');
}

function viewCondition(view: InboxView, person: string, at: string): { sql: string; values: string[] } {
	switch (view) {
		case 'inbox':
			return { sql: `t.folder = 'inbox' AND (t.snoozed_until IS NULL OR t.snoozed_until <= ?)`, values: [at] };
		case 'mine':
			return { sql: `t.folder = 'inbox' AND t.assignee_identifier = ?`, values: [person] };
		case 'follow-up':
			return { sql: `t.folder <> 'trash' AND t.follow_up_at IS NOT NULL AND t.follow_up_at <= ?`, values: [at] };
		case 'snoozed':
			return { sql: `t.folder = 'inbox' AND t.snoozed_until > ?`, values: [at] };
		case 'scheduled':
			return { sql: `EXISTS (SELECT 1 FROM mail_messages s WHERE s.thread_identifier = t.identifier AND s.status = 'scheduled')`, values: [] };
		case 'sent':
			return { sql: `t.folder <> 'trash' AND t.last_outbound_at IS NOT NULL`, values: [] };
		default:
			return { sql: `t.folder = ?`, values: [view] };
	}
}

interface ThreadRow {
	identifier: string;
	subject: string;
	folder: Folder;
	unread: number;
	counterpart_address: string | null;
	counterpart_name: string | null;
	nation_identifier: string | null;
	assignee_identifier: string | null;
	assignee_name: string | null;
	message_count: number;
	last_message_at: string;
	snoozed_until: string | null;
	follow_up_at: string | null;
	stop_requested: number;
	snippet: string | null;
	has_attachments: number;
	scheduled_for: string | null;
}

/** One page of a view, newest first, optionally narrowed by a label or search words. */
export async function listThreads(
	context: MailContext,
	options: { view: InboxView; personIdentifier: string; label?: string | null; search?: string | null; page?: number }
): Promise<{ threads: ThreadSummary[]; more: boolean }> {
	const at = currentTime(context).toISOString();
	const view = viewCondition(options.view, options.personIdentifier, at);
	const conditions = [view.sql];
	const values: (string | number)[] = [...view.values];
	if (options.label) {
		values.push(options.label);
		conditions.push(`EXISTS (SELECT 1 FROM mail_thread_labels l WHERE l.thread_identifier = t.identifier AND l.label_identifier = ?)`);
	}
	const query = options.search ? searchQuery(options.search) : null;
	if (query) {
		values.push(query);
		conditions.push(`t.identifier IN (SELECT thread_identifier FROM mail_search WHERE mail_search MATCH ?)`);
	}
	const order = options.view === 'sent' ? 't.last_outbound_at' : 't.last_message_at';
	const page = Math.max(0, options.page ?? 0);
	const { results } = await context.database
		.prepare(
			`SELECT t.identifier, t.subject, t.folder, t.unread, t.counterpart_address, t.counterpart_name, t.nation_identifier,
			 t.assignee_identifier, p.display_name AS assignee_name, t.message_count, t.last_message_at, t.snoozed_until,
			 t.follow_up_at, t.stop_requested,
			 (SELECT m.snippet FROM mail_messages m WHERE m.thread_identifier = t.identifier AND m.status NOT IN ('draft', 'cancelled')
			  ORDER BY m.created_at DESC LIMIT 1) AS snippet,
			 EXISTS (SELECT 1 FROM mail_attachments a JOIN mail_messages m ON m.identifier = a.message_identifier
			  WHERE m.thread_identifier = t.identifier AND a.inline = 0) AS has_attachments,
			 (SELECT MIN(s.scheduled_for) FROM mail_messages s WHERE s.thread_identifier = t.identifier AND s.status = 'scheduled') AS scheduled_for
			 FROM mail_threads t LEFT JOIN people p ON p.identifier = t.assignee_identifier
			 WHERE ${conditions.join(' AND ')}
			 ORDER BY ${order} DESC LIMIT ${pageSize + 1} OFFSET ${page * pageSize}`
		)
		.bind(...values)
		.all<ThreadRow>();
	const rows = results.slice(0, pageSize);
	const labels = await labelsFor(
		context,
		rows.map((row) => row.identifier)
	);
	return {
		threads: rows.map((row) => ({
			identifier: row.identifier,
			subject: row.subject,
			folder: row.folder,
			unread: row.unread === 1,
			counterpartAddress: row.counterpart_address,
			counterpartName: row.counterpart_name,
			nationIdentifier: row.nation_identifier,
			assigneeIdentifier: row.assignee_identifier,
			assigneeName: row.assignee_name,
			messageCount: row.message_count,
			lastMessageAt: row.last_message_at,
			snoozedUntil: row.snoozed_until,
			followUpAt: row.follow_up_at,
			stopRequested: row.stop_requested === 1,
			snippet: row.snippet ?? '',
			hasAttachments: row.has_attachments === 1,
			scheduledFor: row.scheduled_for,
			labels: labels.get(row.identifier) ?? []
		})),
		more: results.length > pageSize
	};
}

async function labelsFor(context: MailContext, threads: string[]): Promise<Map<string, MailLabel[]>> {
	const found = new Map<string, MailLabel[]>();
	if (threads.length === 0) return found;
	const { results } = await context.database
		.prepare(
			`SELECT tl.thread_identifier AS thread, l.identifier, l.name, l.color FROM mail_thread_labels tl
			 JOIN mail_labels l ON l.identifier = tl.label_identifier
			 WHERE tl.thread_identifier IN (${threads.map(() => '?').join(', ')}) ORDER BY l.name`
		)
		.bind(...threads)
		.all<MailLabel & { thread: string }>();
	for (const row of results) {
		const list = found.get(row.thread) ?? [];
		list.push({ identifier: row.identifier, name: row.name, color: row.color });
		found.set(row.thread, list);
	}
	return found;
}

/** How many unread conversations each view has, for the counts in the left column. */
export async function viewCounts(context: MailContext, personIdentifier: string): Promise<Partial<Record<InboxView, number>>> {
	const at = currentTime(context).toISOString();
	const row = await context.database
		.prepare(
			`SELECT
			 SUM(folder = 'inbox' AND unread = 1 AND (snoozed_until IS NULL OR snoozed_until <= ?2)) AS inbox,
			 SUM(folder = 'inbox' AND unread = 1 AND assignee_identifier = ?1) AS mine,
			 SUM(folder <> 'trash' AND follow_up_at IS NOT NULL AND follow_up_at <= ?2) AS followUp,
			 SUM(folder = 'inbox' AND snoozed_until > ?2) AS snoozed,
			 SUM(folder = 'spam' AND unread = 1) AS spam
			 FROM mail_threads`
		)
		.bind(personIdentifier, at)
		.first<{ inbox: number | null; mine: number | null; followUp: number | null; snoozed: number | null; spam: number | null }>();
	const scheduled = await context.database
		.prepare(`SELECT COUNT(DISTINCT thread_identifier) AS count FROM mail_messages WHERE status = 'scheduled'`)
		.first<{ count: number }>();
	return {
		inbox: row?.inbox ?? 0,
		mine: row?.mine ?? 0,
		'follow-up': row?.followUp ?? 0,
		snoozed: row?.snoozed ?? 0,
		spam: row?.spam ?? 0,
		scheduled: scheduled?.count ?? 0
	};
}

export async function listLabels(context: MailContext): Promise<MailLabel[]> {
	const { results } = await context.database.prepare('SELECT identifier, name, color FROM mail_labels ORDER BY name').all<MailLabel>();
	return results;
}

export interface MessageDetail {
	identifier: string;
	direction: 'in' | 'out';
	status: string;
	from: MailAddress;
	to: MailAddress[];
	cc: MailAddress[];
	bcc: MailAddress[];
	replyTo: string | null;
	subject: string;
	text: string;
	hasHtml: boolean;
	spamReason: string | null;
	automatic: boolean;
	carrier: string | null;
	sentByName: string | null;
	scheduledFor: string | null;
	sentAt: string | null;
	receivedAt: string | null;
	deliveryStatus: string | null;
	deliveryDetail: string | null;
	deliveryAt: string | null;
	acknowledgedAt: string | null;
	error: string | null;
	createdAt: string;
	messageId: string | null;
	attachments: { identifier: string; filename: string; mediaType: string; size: number; inline: boolean }[];
}

export interface ThreadDetail extends ThreadSummary {
	projectAddress: string | null;
	messages: MessageDetail[];
	notes: { identifier: string; body: string; personName: string | null; createdAt: string }[];
	actions: { action: string; personName: string | null; note: string | null; createdAt: string }[];
	outreach: { batchIdentifier: string; batchName: string; status: string } | null;
}

function parseList(value: string | null): MailAddress[] {
	try {
		const list = JSON.parse(value ?? '[]') as MailAddress[];
		return Array.isArray(list) ? list : [];
	} catch {
		return [];
	}
}

export async function getThread(context: MailContext, identifier: string, personIdentifier: string): Promise<ThreadDetail | null> {
	const database = context.database;
	const thread = await database
		.prepare(
			`SELECT t.*, p.display_name AS assignee_name FROM mail_threads t LEFT JOIN people p ON p.identifier = t.assignee_identifier
			 WHERE t.identifier = ?`
		)
		.bind(identifier)
		.first<ThreadRow & { project_address: string | null }>();
	if (!thread) return null;
	const { results: messages } = await database
		.prepare(
			`SELECT m.*, p.display_name AS sent_by_name FROM mail_messages m LEFT JOIN people p ON p.identifier = m.sent_by
			 WHERE m.thread_identifier = ? AND m.status <> 'cancelled' ORDER BY COALESCE(m.sent_at, m.received_at, m.scheduled_for, m.created_at), m.created_at`
		)
		.bind(identifier)
		.all<Record<string, string | number | null>>();
	const { results: attachments } = await database
		.prepare(
			`SELECT a.identifier, a.message_identifier, a.filename, a.media_type, a.size, a.inline FROM mail_attachments a
			 JOIN mail_messages m ON m.identifier = a.message_identifier WHERE m.thread_identifier = ? ORDER BY a.filename`
		)
		.bind(identifier)
		.all<{ identifier: string; message_identifier: string; filename: string; media_type: string; size: number; inline: number }>();
	const { results: notes } = await database
		.prepare(
			`SELECT n.identifier, n.body, p.display_name AS personName, n.created_at AS createdAt FROM mail_notes n
			 LEFT JOIN people p ON p.identifier = n.person_identifier WHERE n.thread_identifier = ? ORDER BY n.created_at`
		)
		.bind(identifier)
		.all<{ identifier: string; body: string; personName: string | null; createdAt: string }>();
	const { results: actions } = await database
		.prepare(
			`SELECT a.action, p.display_name AS personName, a.note, a.created_at AS createdAt FROM mail_actions a
			 LEFT JOIN people p ON p.identifier = a.person_identifier WHERE a.thread_identifier = ? ORDER BY a.created_at DESC LIMIT 30`
		)
		.bind(identifier)
		.all<{ action: string; personName: string | null; note: string | null; createdAt: string }>();
	const outreach = await database
		.prepare(
			`SELECT r.batch_identifier AS batchIdentifier, b.name AS batchName, r.status FROM outreach_recipients r
			 JOIN outreach_batches b ON b.identifier = r.batch_identifier WHERE r.thread_identifier = ? LIMIT 1`
		)
		.bind(identifier)
		.first<{ batchIdentifier: string; batchName: string; status: string }>();
	const labels = await labelsFor(context, [identifier]);
	const summary = (await listThreadSummary(thread, labels.get(identifier) ?? []));
	void personIdentifier;
	return {
		...summary,
		projectAddress: thread.project_address,
		messages: messages.map((row) => ({
			identifier: String(row.identifier),
			direction: row.direction as 'in' | 'out',
			status: String(row.status),
			from: { email: String(row.from_address), name: (row.from_name as string | null) ?? null },
			to: parseList(row.to_list as string),
			cc: parseList(row.cc_list as string),
			bcc: parseList(row.bcc_list as string),
			replyTo: (row.reply_to as string | null) ?? null,
			subject: String(row.subject),
			text: String(row.text_body ?? ''),
			hasHtml: row.html_key !== null,
			spamReason: (row.spam_reason as string | null) ?? null,
			automatic: row.automatic === 1,
			carrier: (row.carrier as string | null) ?? null,
			sentByName: (row.sent_by_name as string | null) ?? null,
			scheduledFor: (row.scheduled_for as string | null) ?? null,
			sentAt: (row.sent_at as string | null) ?? null,
			receivedAt: (row.received_at as string | null) ?? null,
			deliveryStatus: (row.delivery_status as string | null) ?? null,
			deliveryDetail: (row.delivery_detail as string | null) ?? null,
			deliveryAt: (row.delivery_at as string | null) ?? null,
			acknowledgedAt: (row.acknowledged_at as string | null) ?? null,
			error: (row.error as string | null) ?? null,
			createdAt: String(row.created_at),
			messageId: (row.message_id as string | null) ?? null,
			attachments: attachments
				.filter((item) => item.message_identifier === row.identifier)
				.map((item) => ({ identifier: item.identifier, filename: item.filename, mediaType: item.media_type, size: item.size, inline: item.inline === 1 }))
		})),
		notes,
		actions,
		outreach: outreach ?? null
	};
}

async function listThreadSummary(row: ThreadRow, labels: MailLabel[]): Promise<ThreadSummary> {
	return {
		identifier: row.identifier,
		subject: row.subject,
		folder: row.folder,
		unread: row.unread === 1,
		counterpartAddress: row.counterpart_address,
		counterpartName: row.counterpart_name,
		nationIdentifier: row.nation_identifier,
		assigneeIdentifier: row.assignee_identifier,
		assigneeName: row.assignee_name,
		messageCount: row.message_count,
		lastMessageAt: row.last_message_at,
		snoozedUntil: row.snoozed_until,
		followUpAt: row.follow_up_at,
		stopRequested: row.stop_requested === 1,
		snippet: '',
		hasAttachments: false,
		scheduledFor: null,
		labels
	};
}

// ---------------------------------------------------------------------------
// Actions on a conversation
// ---------------------------------------------------------------------------

async function change(
	context: MailContext,
	personIdentifier: string,
	threadIdentifier: string,
	sql: string,
	values: (string | number | null)[],
	action: string,
	note: string | null = null
): Promise<void> {
	const at = currentTime(context).toISOString();
	await context.database.batch([
		context.database.prepare(`UPDATE mail_threads SET ${sql}, updated_at = ? WHERE identifier = ?`).bind(...values, at, threadIdentifier),
		actionStatement(context, { personIdentifier, action, threadIdentifier, note })
	]);
}

export async function markRead(context: MailContext, personIdentifier: string, threadIdentifier: string, read: boolean): Promise<void> {
	await change(context, personIdentifier, threadIdentifier, 'unread = ?', [read ? 0 : 1], read ? 'Read' : 'Marked unread');
}

export async function moveToFolder(context: MailContext, personIdentifier: string, threadIdentifier: string, folder: Folder): Promise<void> {
	const names: Record<Folder, string> = { inbox: 'Moved to the inbox', archive: 'Archived', spam: 'Marked as spam', trash: 'Deleted' };
	await change(context, personIdentifier, threadIdentifier, 'folder = ?, snoozed_until = NULL', [folder], names[folder]);
}

export async function assign(
	context: MailContext,
	personIdentifier: string,
	threadIdentifier: string,
	assignee: string | null,
	assigneeName: string | null
): Promise<void> {
	await change(context, personIdentifier, threadIdentifier, 'assignee_identifier = ?', [assignee], assignee ? 'Assigned' : 'Unassigned', assigneeName);
}

export async function setLabel(
	context: MailContext,
	personIdentifier: string,
	threadIdentifier: string,
	labelIdentifier: string,
	on: boolean
): Promise<void> {
	const label = await context.database.prepare('SELECT name FROM mail_labels WHERE identifier = ?').bind(labelIdentifier).first<{ name: string }>();
	if (!label) return;
	await context.database.batch([
		on
			? context.database
					.prepare('INSERT OR IGNORE INTO mail_thread_labels (thread_identifier, label_identifier) VALUES (?, ?)')
					.bind(threadIdentifier, labelIdentifier)
			: context.database
					.prepare('DELETE FROM mail_thread_labels WHERE thread_identifier = ? AND label_identifier = ?')
					.bind(threadIdentifier, labelIdentifier),
		actionStatement(context, { personIdentifier, action: on ? 'Labeled' : 'Label removed', threadIdentifier, note: label.name })
	]);
}

export async function snooze(context: MailContext, personIdentifier: string, threadIdentifier: string, until: string | null): Promise<void> {
	await change(
		context,
		personIdentifier,
		threadIdentifier,
		`snoozed_until = ?, folder = 'inbox'`,
		[until],
		until ? 'Snoozed' : 'Snooze ended',
		until
	);
}

/** "Remind me if no reply by": a reply that arrives after now clears it (src/lib/server/mail/inbound.ts). */
export async function setFollowUp(context: MailContext, personIdentifier: string, threadIdentifier: string, at: string | null): Promise<void> {
	const stamp = currentTime(context).toISOString();
	await change(
		context,
		personIdentifier,
		threadIdentifier,
		'follow_up_at = ?, follow_up_set_at = ?',
		[at, at ? stamp : null],
		at ? 'Reminder set' : 'Reminder cleared',
		at
	);
}

export async function addNote(context: MailContext, personIdentifier: string, threadIdentifier: string, body: string): Promise<void> {
	const at = currentTime(context).toISOString();
	await context.database.batch([
		context.database
			.prepare('INSERT INTO mail_notes (identifier, thread_identifier, person_identifier, body, created_at) VALUES (?, ?, ?, ?, ?)')
			.bind(crypto.randomUUID(), threadIdentifier, personIdentifier, body, at),
		actionStatement(context, { personIdentifier, action: 'Added a note', threadIdentifier })
	]);
}

export async function clearStopRequest(context: MailContext, personIdentifier: string, threadIdentifier: string, confirmed: boolean): Promise<void> {
	await change(
		context,
		personIdentifier,
		threadIdentifier,
		'stop_requested = 0',
		[],
		confirmed ? 'Confirmed the request not to be emailed' : 'Dismissed the stop flag'
	);
}

export async function createLabel(context: MailContext, personIdentifier: string, name: string, color: LabelColor): Promise<void> {
	await context.database.batch([
		context.database
			.prepare('INSERT INTO mail_labels (identifier, name, color, created_at) VALUES (?, ?, ?, ?) ON CONFLICT (name) DO NOTHING')
			.bind(crypto.randomUUID(), name, color, currentTime(context).toISOString()),
		actionStatement(context, { personIdentifier, action: 'Made a label', note: name })
	]);
}

export async function deleteLabel(context: MailContext, personIdentifier: string, labelIdentifier: string): Promise<void> {
	await context.database.batch([
		context.database.prepare('DELETE FROM mail_labels WHERE identifier = ?').bind(labelIdentifier),
		actionStatement(context, { personIdentifier, action: 'Removed a label', note: labelIdentifier })
	]);
}

/** Shows snoozed conversations again once their time comes, as unread. Run by the mail tick. */
export async function wakeSnoozed(context: MailContext): Promise<number> {
	const at = currentTime(context).toISOString();
	const result = await context.database
		.prepare(`UPDATE mail_threads SET snoozed_until = NULL, unread = 1, updated_at = ?1 WHERE snoozed_until IS NOT NULL AND snoozed_until <= ?1`)
		.bind(at)
		.run();
	return result.meta.changes ?? 0;
}

/**
 * Deletes conversations that have been in Deleted for 30 days, with their
 * files in the bucket. Run by the mail tick, a few at a time.
 */
export async function purgeDeleted(context: MailContext): Promise<number> {
	const before = new Date(currentTime(context).getTime() - 30 * 86_400_000).toISOString();
	const { results: threads } = await context.database
		.prepare(`SELECT identifier FROM mail_threads WHERE folder = 'trash' AND updated_at < ? LIMIT 20`)
		.bind(before)
		.all<{ identifier: string }>();
	for (const { identifier } of threads) {
		const { results: keys } = await context.database
			.prepare(
				`SELECT raw_key AS key FROM mail_messages WHERE thread_identifier = ?1 AND raw_key IS NOT NULL
				 UNION ALL SELECT html_key FROM mail_messages WHERE thread_identifier = ?1 AND html_key IS NOT NULL
				 UNION ALL SELECT a.bucket_key FROM mail_attachments a JOIN mail_messages m ON m.identifier = a.message_identifier WHERE m.thread_identifier = ?1`
			)
			.bind(identifier)
			.all<{ key: string }>();
		if (keys.length) await context.bucket.delete(keys.map((row) => row.key));
		await context.database.batch([
			context.database.prepare('DELETE FROM mail_search WHERE thread_identifier = ?').bind(identifier),
			context.database.prepare('UPDATE outreach_recipients SET thread_identifier = NULL, message_identifier = NULL WHERE thread_identifier = ?').bind(identifier),
			context.database.prepare('DELETE FROM mail_threads WHERE identifier = ?').bind(identifier),
			actionStatement(context, { personIdentifier: null, action: 'Deleted for good after 30 days in Deleted', threadIdentifier: identifier })
		]);
	}
	return threads.length;
}

/** One attachment's row, for the download route. */
export async function getAttachment(context: MailContext, identifier: string) {
	return context.database
		.prepare('SELECT filename, media_type AS mediaType, size, bucket_key AS bucketKey FROM mail_attachments WHERE identifier = ?')
		.bind(identifier)
		.first<{ filename: string; mediaType: string; size: number; bucketKey: string }>();
}

/** The bucket key of a message's HTML, for the sandboxed view. */
export async function getMessageHtmlKey(context: MailContext, identifier: string): Promise<string | null> {
	const row = await context.database.prepare('SELECT html_key AS key FROM mail_messages WHERE identifier = ?').bind(identifier).first<{ key: string | null }>();
	return row?.key ?? null;
}

/** The people who can be assigned a conversation: those who can read the inbox. */
export async function assignablePeople(context: MailContext, roles: readonly string[]) {
	const { results } = await context.database
		.prepare(
			`SELECT identifier, display_name AS name FROM people WHERE status = 'active' AND role IN (${roles.map(() => '?').join(', ')}) ORDER BY display_name`
		)
		.bind(...roles)
		.all<{ identifier: string; name: string }>();
	return results;
}
