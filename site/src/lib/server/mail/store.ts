/**
 * Reading and changing conversations in the project inbox: the lists in the
 * left column, one conversation with its messages and notes, and the
 * actions on it (read, archive, delete, file in a folder, assign, tag,
 * remind). Every change is recorded in mail_actions.
 */
import { folderDepthLimit, folders, type Folder, type InboxView, type MailAddress, type TagColor, type ThreadFolder } from '#lib/mail.ts';
import { actionStatement, currentTime, type MailContext } from './context.ts';
import { attachmentChecks, forgetAttachmentScans, type AttachmentCheck } from './scans.ts';
import { reachableCondition } from './inboxes.ts';

export interface ThreadSummary {
	identifier: string;
	subject: string;
	folder: ThreadFolder;
	/** The made folder the conversation is in, when folder is 'folder'. */
	folderIdentifier: string | null;
	unread: boolean;
	counterpartAddress: string | null;
	counterpartName: string | null;
	nationIdentifier: string | null;
	assigneeIdentifier: string | null;
	assigneeName: string | null;
	messageCount: number;
	lastMessageAt: string;
	/** "Remind me": out of the Inbox list until then, or until a reply comes. */
	remindAt: string | null;
	stopRequested: boolean;
	snippet: string;
	hasAttachments: boolean;
	scheduledFor: string | null;
	tags: MailTag[];
}

export interface MailTag {
	identifier: string;
	name: string;
	color: TagColor;
}

/** A folder the lead author made, with where it sits and how many unread conversations it holds. */
export interface MailFolder {
	identifier: string;
	name: string;
	parentIdentifier: string | null;
	/** 0 for a top-level folder, 1 inside one, and so on. */
	depth: number;
	/** The names from the top, joined: "Nations / Navajo Nation". */
	path: string;
	unread: number;
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
			return { sql: `t.folder = 'inbox' AND (t.remind_at IS NULL OR t.remind_at <= ?)`, values: [at] };
		case 'mine':
			return { sql: `t.folder = 'inbox' AND t.assignee_identifier = ? AND (t.remind_at IS NULL OR t.remind_at <= ?)`, values: [person, at] };
		case 'reminders':
			return { sql: `t.folder NOT IN ('spam', 'trash') AND t.remind_at > ?`, values: [at] };
		case 'scheduled':
			return { sql: `EXISTS (SELECT 1 FROM mail_messages s WHERE s.thread_identifier = t.identifier AND s.status = 'scheduled' AND s.held_for_undo = 0)`, values: [] };
		case 'sent':
			return { sql: `t.folder <> 'trash' AND t.last_outbound_at IS NOT NULL`, values: [] };
		default:
			return { sql: `t.folder = ?`, values: [view] };
	}
}

interface ThreadRow {
	identifier: string;
	subject: string;
	folder: ThreadFolder;
	folder_identifier: string | null;
	unread: number;
	counterpart_address: string | null;
	counterpart_name: string | null;
	nation_identifier: string | null;
	assignee_identifier: string | null;
	assignee_name: string | null;
	message_count: number;
	last_message_at: string;
	remind_at: string | null;
	stop_requested: number;
	snippet: string | null;
	has_attachments: number;
	scheduled_for: string | null;
}

/**
 * One page of conversations, newest first: a made folder's, a tag's (in any
 * folder but Spam and Deleted), or else a view's, optionally narrowed by
 * search words and to one inbox. Only conversations in the person's own
 * inboxes are ever listed (src/lib/server/mail/inboxes.ts).
 */
export async function listThreads(
	context: MailContext,
	options: {
		view: InboxView;
		personIdentifier: string;
		folder?: string | null;
		tag?: string | null;
		search?: string | null;
		/** One inbox's conversations only; null for all of the person's inboxes. */
		inbox?: string | null;
		page?: number;
	}
): Promise<{ threads: ThreadSummary[]; more: boolean }> {
	const at = currentTime(context).toISOString();
	const conditions: string[] = [reachableCondition];
	const values: (string | number)[] = [options.personIdentifier];
	if (options.inbox) {
		conditions.push('t.inbox_identifier = ?');
		values.push(options.inbox);
	}
	if (options.folder) {
		conditions.push(`t.folder = 'folder' AND t.folder_identifier = ?`);
		values.push(options.folder);
	} else if (options.tag) {
		conditions.push(`t.folder NOT IN ('spam', 'trash') AND EXISTS (SELECT 1 FROM mail_thread_tags g WHERE g.thread_identifier = t.identifier AND g.tag_identifier = ?)`);
		values.push(options.tag);
	} else {
		const view = viewCondition(options.view, options.personIdentifier, at);
		conditions.push(view.sql);
		values.push(...view.values);
	}
	const query = options.search ? searchQuery(options.search) : null;
	if (query) {
		values.push(query);
		conditions.push(`t.identifier IN (SELECT thread_identifier FROM mail_search WHERE mail_search MATCH ?)`);
	}
	const order = options.view === 'sent' && !options.folder && !options.tag ? 't.last_outbound_at' : 't.last_message_at';
	const page = Math.max(0, options.page ?? 0);
	const { results } = await context.database
		.prepare(
			`SELECT t.identifier, t.subject, t.folder, t.folder_identifier, t.unread, t.counterpart_address, t.counterpart_name, t.nation_identifier,
			 t.assignee_identifier, p.display_name AS assignee_name, t.message_count, t.last_message_at, t.remind_at,
			 t.stop_requested,
			 (SELECT m.snippet FROM mail_messages m WHERE m.thread_identifier = t.identifier AND m.status NOT IN ('draft', 'cancelled')
			  ORDER BY m.created_at DESC LIMIT 1) AS snippet,
			 EXISTS (SELECT 1 FROM mail_attachments a JOIN mail_messages m ON m.identifier = a.message_identifier
			  WHERE m.thread_identifier = t.identifier AND a.inline = 0) AS has_attachments,
			 (SELECT MIN(s.scheduled_for) FROM mail_messages s WHERE s.thread_identifier = t.identifier AND s.status = 'scheduled' AND s.held_for_undo = 0) AS scheduled_for
			 FROM mail_threads t LEFT JOIN people p ON p.identifier = t.assignee_identifier
			 WHERE ${conditions.join(' AND ')}
			 ORDER BY ${order} DESC LIMIT ${pageSize + 1} OFFSET ${page * pageSize}`
		)
		.bind(...values)
		.all<ThreadRow>();
	const rows = results.slice(0, pageSize);
	const tags = await tagsFor(
		context,
		rows.map((row) => row.identifier)
	);
	return {
		threads: rows.map((row) => ({
			identifier: row.identifier,
			subject: row.subject,
			folder: row.folder,
			folderIdentifier: row.folder_identifier,
			unread: row.unread === 1,
			counterpartAddress: row.counterpart_address,
			counterpartName: row.counterpart_name,
			nationIdentifier: row.nation_identifier,
			assigneeIdentifier: row.assignee_identifier,
			assigneeName: row.assignee_name,
			messageCount: row.message_count,
			lastMessageAt: row.last_message_at,
			remindAt: row.remind_at,
			stopRequested: row.stop_requested === 1,
			snippet: row.snippet ?? '',
			hasAttachments: row.has_attachments === 1,
			scheduledFor: row.scheduled_for,
			tags: tags.get(row.identifier) ?? []
		})),
		more: results.length > pageSize
	};
}

async function tagsFor(context: MailContext, threads: string[]): Promise<Map<string, MailTag[]>> {
	const found = new Map<string, MailTag[]>();
	if (threads.length === 0) return found;
	const { results } = await context.database
		.prepare(
			`SELECT tt.thread_identifier AS thread, g.identifier, g.name, g.color FROM mail_thread_tags tt
			 JOIN mail_tags g ON g.identifier = tt.tag_identifier
			 WHERE tt.thread_identifier IN (${threads.map(() => '?').join(', ')}) ORDER BY g.name`
		)
		.bind(...threads)
		.all<MailTag & { thread: string }>();
	for (const row of results) {
		const list = found.get(row.thread) ?? [];
		list.push({ identifier: row.identifier, name: row.name, color: row.color });
		found.set(row.thread, list);
	}
	return found;
}

/**
 * How many unread conversations each view has, for the counts in the left
 * column: in the person's inboxes, or in one of them.
 */
export async function viewCounts(context: MailContext, personIdentifier: string, inbox: string | null = null): Promise<Partial<Record<InboxView, number>>> {
	const at = currentTime(context).toISOString();
	const onlyInbox = inbox ? 'AND t.inbox_identifier = ?3' : '';
	const row = await context.database
		.prepare(
			`SELECT
			 SUM(t.folder = 'inbox' AND t.unread = 1 AND (t.remind_at IS NULL OR t.remind_at <= ?2)) AS inbox,
			 SUM(t.folder = 'inbox' AND t.unread = 1 AND t.assignee_identifier = ?1 AND (t.remind_at IS NULL OR t.remind_at <= ?2)) AS mine,
			 SUM(t.folder NOT IN ('spam', 'trash') AND t.remind_at > ?2) AS reminders,
			 SUM(t.folder = 'spam' AND t.unread = 1) AS spam
			 FROM mail_threads t
			 WHERE t.inbox_identifier IN (SELECT inbox_identifier FROM mail_inbox_members WHERE person_identifier = ?1) ${onlyInbox}`
		)
		.bind(...[personIdentifier, at, ...(inbox ? [inbox] : [])])
		.first<{ inbox: number | null; mine: number | null; reminders: number | null; spam: number | null }>();
	const scheduled = await context.database
		.prepare(
			`SELECT COUNT(DISTINCT m.thread_identifier) AS count FROM mail_messages m JOIN mail_threads t ON t.identifier = m.thread_identifier
			 WHERE m.status = 'scheduled' AND m.held_for_undo = 0
			 AND t.inbox_identifier IN (SELECT inbox_identifier FROM mail_inbox_members WHERE person_identifier = ?1) ${onlyInbox.replace('?3', '?2')}`
		)
		.bind(...[personIdentifier, ...(inbox ? [inbox] : [])])
		.first<{ count: number }>();
	return {
		inbox: row?.inbox ?? 0,
		mine: row?.mine ?? 0,
		reminders: row?.reminders ?? 0,
		spam: row?.spam ?? 0,
		scheduled: scheduled?.count ?? 0
	};
}

export async function listTags(context: MailContext): Promise<MailTag[]> {
	const { results } = await context.database.prepare('SELECT identifier, name, color FROM mail_tags ORDER BY name').all<MailTag>();
	return results;
}

/**
 * The made folders as a tree, in the order the left column shows them, with
 * unread counts: of the person's inboxes, when a person is named.
 */
export async function listFolders(context: MailContext, personIdentifier: string | null = null): Promise<MailFolder[]> {
	const { results } = await context.database
		.prepare(
			`SELECT f.identifier, f.name, f.parent_identifier AS parentIdentifier,
			 (SELECT COUNT(*) FROM mail_threads t WHERE t.folder = 'folder' AND t.folder_identifier = f.identifier AND t.unread = 1
			  AND (?1 IS NULL OR ${reachableCondition.replace('?', '?1')})) AS unread
			 FROM mail_folders f`
		)
		.bind(personIdentifier)
		.all<{ identifier: string; name: string; parentIdentifier: string | null; unread: number }>();
	const children = new Map<string | null, typeof results>();
	for (const row of results) {
		const list = children.get(row.parentIdentifier) ?? [];
		list.push(row);
		children.set(row.parentIdentifier, list);
	}
	const ordered: MailFolder[] = [];
	const visit = (parent: string | null, depth: number, path: string) => {
		const list = (children.get(parent) ?? []).sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
		for (const row of list) {
			const own = path ? `${path} / ${row.name}` : row.name;
			ordered.push({ identifier: row.identifier, name: row.name, parentIdentifier: row.parentIdentifier, depth, path: own, unread: row.unread });
			visit(row.identifier, depth + 1, own);
		}
	};
	visit(null, 0, '');
	return ordered;
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
	/** Whether the message came from a mailing list that says how to unsubscribe. */
	fromList: boolean;
	/** Whether a copy of the whole message is kept, so it can be exported. */
	hasCopy: boolean;
	automatic: boolean;
	carrier: string | null;
	sentByName: string | null;
	scheduledFor: string | null;
	/** While a message waits out the pause before it goes (undo send), when the pause ends. */
	undoUntil: string | null;
	sentAt: string | null;
	receivedAt: string | null;
	deliveryStatus: string | null;
	deliveryDetail: string | null;
	deliveryAt: string | null;
	acknowledgedAt: string | null;
	error: string | null;
	createdAt: string;
	messageId: string | null;
	/** check is the virus check of a received attachment, null for one the project sent. */
	attachments: { identifier: string; filename: string; mediaType: string; size: number; inline: boolean; check: AttachmentCheck | null }[];
}

export interface ThreadDetail extends ThreadSummary {
	projectAddress: string | null;
	/** The inbox the conversation is in (src/lib/server/mail/inboxes.ts). */
	inboxIdentifier: string | null;
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

/** A conversation with its messages, or null when it is gone or in an inbox the person is not on. */
export async function getThread(context: MailContext, identifier: string, personIdentifier: string): Promise<ThreadDetail | null> {
	const database = context.database;
	const thread = await database
		.prepare(
			`SELECT t.*, p.display_name AS assignee_name FROM mail_threads t LEFT JOIN people p ON p.identifier = t.assignee_identifier
			 WHERE t.identifier = ? AND ${reachableCondition}`
		)
		.bind(identifier, personIdentifier)
		.first<ThreadRow & { project_address: string | null; inbox_identifier: string | null }>();
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
			`SELECT a.identifier, a.message_identifier, a.filename, a.media_type, a.size, a.inline, a.bucket_key, m.direction FROM mail_attachments a
			 JOIN mail_messages m ON m.identifier = a.message_identifier WHERE m.thread_identifier = ? ORDER BY a.filename`
		)
		.bind(identifier)
		.all<{ identifier: string; message_identifier: string; filename: string; media_type: string; size: number; inline: number; bucket_key: string; direction: string }>();
	const checks = await attachmentChecks(
		context,
		attachments.map((item) => ({ identifier: item.identifier, key: item.bucket_key, received: item.direction === 'in' }))
	);
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
	const tags = await tagsFor(context, [identifier]);
	const summary = listThreadSummary(thread, tags.get(identifier) ?? []);
	void personIdentifier;
	return {
		...summary,
		projectAddress: thread.project_address,
		inboxIdentifier: thread.inbox_identifier,
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
			fromList: row.direction === 'in' && Boolean(row.list_unsubscribe),
			hasCopy: row.raw_key !== null,
			automatic: row.automatic === 1,
			carrier: (row.carrier as string | null) ?? null,
			sentByName: (row.sent_by_name as string | null) ?? null,
			scheduledFor: (row.scheduled_for as string | null) ?? null,
			undoUntil: row.status === 'scheduled' && row.held_for_undo === 1 ? ((row.scheduled_for as string | null) ?? null) : null,
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
				.map((item) => ({
					identifier: item.identifier,
					filename: item.filename,
					mediaType: item.media_type,
					size: item.size,
					inline: item.inline === 1,
					check: checks.get(item.identifier) ?? null
				}))
		})),
		notes,
		actions,
		outreach: outreach ?? null
	};
}

function listThreadSummary(row: ThreadRow, tags: MailTag[]): ThreadSummary {
	return {
		identifier: row.identifier,
		subject: row.subject,
		folder: row.folder,
		folderIdentifier: row.folder_identifier,
		unread: row.unread === 1,
		counterpartAddress: row.counterpart_address,
		counterpartName: row.counterpart_name,
		nationIdentifier: row.nation_identifier,
		assigneeIdentifier: row.assignee_identifier,
		assigneeName: row.assignee_name,
		messageCount: row.message_count,
		lastMessageAt: row.last_message_at,
		remindAt: row.remind_at,
		stopRequested: row.stop_requested === 1,
		snippet: '',
		hasAttachments: false,
		scheduledFor: null,
		tags
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

const folderActions: Record<Folder, string> = { inbox: 'Moved to the inbox', archive: 'Archived', spam: 'Marked as spam', trash: 'Deleted' };

/** Whether a value names one of the four built-in folders. */
export function isBuiltInFolder(value: string | null | undefined): value is Folder {
	return folders.includes(value as Folder);
}

/**
 * Moves a conversation to a built-in folder or a made one (by its
 * identifier). Returns false when the made folder does not exist.
 */
export async function moveToFolder(context: MailContext, personIdentifier: string, threadIdentifier: string, place: string): Promise<boolean> {
	if (isBuiltInFolder(place)) {
		// Archiving keeps a reminder; moving to the inbox, Spam or Deleted ends it, since the conversation is then where it belongs.
		const ends = place === 'archive' ? '' : ', remind_at = NULL, remind_set_at = NULL';
		await change(context, personIdentifier, threadIdentifier, `folder = ?, folder_identifier = NULL${ends}`, [place], folderActions[place]);
		return true;
	}
	const folder = await context.database.prepare('SELECT name FROM mail_folders WHERE identifier = ?').bind(place).first<{ name: string }>();
	if (!folder) return false;
	await change(context, personIdentifier, threadIdentifier, `folder = 'folder', folder_identifier = ?`, [place], 'Filed', folder.name);
	return true;
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

export async function setTag(
	context: MailContext,
	personIdentifier: string | null,
	threadIdentifier: string,
	tagIdentifier: string,
	on: boolean
): Promise<void> {
	const tag = await context.database.prepare('SELECT name FROM mail_tags WHERE identifier = ?').bind(tagIdentifier).first<{ name: string }>();
	if (!tag) return;
	await context.database.batch([
		on
			? context.database
					.prepare('INSERT OR IGNORE INTO mail_thread_tags (thread_identifier, tag_identifier) VALUES (?, ?)')
					.bind(threadIdentifier, tagIdentifier)
			: context.database
					.prepare('DELETE FROM mail_thread_tags WHERE thread_identifier = ? AND tag_identifier = ?')
					.bind(threadIdentifier, tagIdentifier),
		actionStatement(context, { personIdentifier, action: on ? 'Tagged' : 'Tag removed', threadIdentifier, note: tag.name })
	]);
}

/** What the list's checkboxes can do to several conversations at once. */
export type BulkOperation =
	| { kind: 'move'; place: string }
	| { kind: 'read'; read: boolean }
	| { kind: 'tag'; tag: string; on: boolean };

/** Applies one operation to each chosen conversation (at most a page of them). Returns how many changed. */
export async function changeMany(context: MailContext, personIdentifier: string, threads: string[], operation: BulkOperation): Promise<number> {
	const chosen = [...new Set(threads)].slice(0, 100);
	let changed = 0;
	for (const thread of chosen) {
		const exists = await context.database
			.prepare(`SELECT 1 AS found FROM mail_threads t WHERE t.identifier = ? AND ${reachableCondition}`)
			.bind(thread, personIdentifier)
			.first();
		if (!exists) continue;
		if (operation.kind === 'move') {
			if (!(await moveToFolder(context, personIdentifier, thread, operation.place))) return changed;
		} else if (operation.kind === 'read') {
			await markRead(context, personIdentifier, thread, operation.read);
		} else {
			await setTag(context, personIdentifier, thread, operation.tag, operation.on);
		}
		changed += 1;
	}
	return changed;
}

/**
 * "Remind me": the conversation leaves the Inbox list until the time, then
 * comes back to the inbox as unread (bringBackReminders). A reply that
 * arrives before then brings it back at once and ends the reminder
 * (src/lib/server/mail/inbound.ts). Null ends the reminder now.
 */
export async function setReminder(context: MailContext, personIdentifier: string, threadIdentifier: string, at: string | null): Promise<void> {
	const stamp = currentTime(context).toISOString();
	await change(
		context,
		personIdentifier,
		threadIdentifier,
		'remind_at = ?, remind_set_at = ?',
		[at, at ? stamp : null],
		at ? 'Reminder set' : 'Reminder ended',
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

// ---------------------------------------------------------------------------
// Tags and folders
// ---------------------------------------------------------------------------

export class OrganizeError extends Error {}

/** Makes a tag. Throws OrganizeError when one already has the name. */
export async function createTag(context: MailContext, personIdentifier: string, name: string, color: TagColor): Promise<string> {
	const clash = await context.database.prepare('SELECT 1 AS found FROM mail_tags WHERE lower(name) = lower(?)').bind(name).first();
	if (clash) throw new OrganizeError(`There is already a tag called “${name}”.`);
	const identifier = crypto.randomUUID();
	await context.database.batch([
		context.database
			.prepare('INSERT INTO mail_tags (identifier, name, color, created_at) VALUES (?, ?, ?, ?)')
			.bind(identifier, name, color, currentTime(context).toISOString()),
		actionStatement(context, { personIdentifier, action: 'Made a tag', note: name })
	]);
	return identifier;
}

export async function updateTag(context: MailContext, personIdentifier: string, tagIdentifier: string, name: string, color: TagColor): Promise<void> {
	const clash = await context.database
		.prepare('SELECT 1 AS found FROM mail_tags WHERE lower(name) = lower(?) AND identifier <> ?')
		.bind(name, tagIdentifier)
		.first();
	if (clash) throw new OrganizeError(`There is already a tag called “${name}”.`);
	await context.database.batch([
		context.database.prepare('UPDATE mail_tags SET name = ?, color = ? WHERE identifier = ?').bind(name, color, tagIdentifier),
		actionStatement(context, { personIdentifier, action: 'Changed a tag', note: name })
	]);
}

/** Removes a tag from every conversation and deletes it. Rules that added it simply stop adding it. */
export async function deleteTag(context: MailContext, personIdentifier: string, tagIdentifier: string): Promise<void> {
	const tag = await context.database.prepare('SELECT name FROM mail_tags WHERE identifier = ?').bind(tagIdentifier).first<{ name: string }>();
	if (!tag) return;
	await context.database.batch([
		context.database.prepare('DELETE FROM mail_tags WHERE identifier = ?').bind(tagIdentifier),
		actionStatement(context, { personIdentifier, action: 'Deleted a tag', note: tag.name })
	]);
}

async function folderDepth(context: MailContext, identifier: string | null): Promise<number> {
	let depth = 0;
	let current = identifier;
	while (current && depth <= folderDepthLimit) {
		const row = await context.database
			.prepare('SELECT parent_identifier AS parent FROM mail_folders WHERE identifier = ?')
			.bind(current)
			.first<{ parent: string | null }>();
		if (!row) break;
		depth += 1;
		current = row.parent;
	}
	return depth;
}

/** Makes a folder, at the top or inside another. Throws OrganizeError for a clash or a folder too deep. */
export async function createFolder(context: MailContext, personIdentifier: string, name: string, parentIdentifier: string | null): Promise<string> {
	if (parentIdentifier) {
		const parent = await context.database.prepare('SELECT 1 AS found FROM mail_folders WHERE identifier = ?').bind(parentIdentifier).first();
		if (!parent) throw new OrganizeError('The folder to put it in is gone.');
		if ((await folderDepth(context, parentIdentifier)) >= folderDepthLimit) {
			throw new OrganizeError(`Folders can sit at most ${folderDepthLimit} deep.`);
		}
	}
	const clash = await context.database
		.prepare(`SELECT 1 AS found FROM mail_folders WHERE COALESCE(parent_identifier, '') = ? AND lower(name) = lower(?)`)
		.bind(parentIdentifier ?? '', name)
		.first();
	if (clash) throw new OrganizeError(`There is already a folder called “${name}” there.`);
	const identifier = crypto.randomUUID();
	await context.database.batch([
		context.database
			.prepare('INSERT INTO mail_folders (identifier, name, parent_identifier, created_at) VALUES (?, ?, ?, ?)')
			.bind(identifier, name, parentIdentifier, currentTime(context).toISOString()),
		actionStatement(context, { personIdentifier, action: 'Made a folder', note: name })
	]);
	return identifier;
}

export async function renameFolder(context: MailContext, personIdentifier: string, folderIdentifier: string, name: string): Promise<void> {
	const folder = await context.database
		.prepare('SELECT parent_identifier AS parent FROM mail_folders WHERE identifier = ?')
		.bind(folderIdentifier)
		.first<{ parent: string | null }>();
	if (!folder) throw new OrganizeError('That folder is gone.');
	const clash = await context.database
		.prepare(`SELECT 1 AS found FROM mail_folders WHERE COALESCE(parent_identifier, '') = ? AND lower(name) = lower(?) AND identifier <> ?`)
		.bind(folder.parent ?? '', name, folderIdentifier)
		.first();
	if (clash) throw new OrganizeError(`There is already a folder called “${name}” there.`);
	await context.database.batch([
		context.database.prepare('UPDATE mail_folders SET name = ? WHERE identifier = ?').bind(name, folderIdentifier),
		actionStatement(context, { personIdentifier, action: 'Renamed a folder', note: name })
	]);
}

/** The folder and every folder inside it, deepest last. */
async function folderAndInside(context: MailContext, folderIdentifier: string): Promise<string[]> {
	const found = [folderIdentifier];
	for (let index = 0; index < found.length && found.length < 500; index += 1) {
		const { results } = await context.database
			.prepare('SELECT identifier FROM mail_folders WHERE parent_identifier = ?')
			.bind(found[index])
			.all<{ identifier: string }>();
		found.push(...results.map((row) => row.identifier));
	}
	return found;
}

/**
 * Deletes a folder and the folders inside it. Their conversations go back
 * to the inbox, never to Deleted, and rules that filed mail there stop
 * moving it (src/lib/server/mail/rules.ts skips a missing folder).
 */
export async function deleteFolder(context: MailContext, personIdentifier: string, folderIdentifier: string): Promise<number> {
	const folder = await context.database.prepare('SELECT name FROM mail_folders WHERE identifier = ?').bind(folderIdentifier).first<{ name: string }>();
	if (!folder) return 0;
	const all = await folderAndInside(context, folderIdentifier);
	const at = currentTime(context).toISOString();
	const marks = all.map(() => '?').join(', ');
	const moved = await context.database
		.prepare(`UPDATE mail_threads SET folder = 'inbox', folder_identifier = NULL, updated_at = ? WHERE folder = 'folder' AND folder_identifier IN (${marks})`)
		.bind(at, ...all)
		.run();
	await context.database.batch([
		context.database.prepare('DELETE FROM mail_folders WHERE identifier = ?').bind(folderIdentifier),
		actionStatement(context, { personIdentifier, action: 'Deleted a folder', note: `${folder.name}; its conversations went back to the inbox` })
	]);
	return moved.meta.changes ?? 0;
}

/**
 * Brings conversations whose reminder has come back to the inbox, as
 * unread, wherever they were filed (but not out of Spam or Deleted). Run by
 * the mail tick.
 */
export async function bringBackReminders(context: MailContext): Promise<number> {
	const at = currentTime(context).toISOString();
	const { results } = await context.database
		.prepare(`SELECT identifier FROM mail_threads WHERE remind_at IS NOT NULL AND remind_at <= ? AND folder NOT IN ('spam', 'trash') LIMIT 100`)
		.bind(at)
		.all<{ identifier: string }>();
	if (results.length === 0) return 0;
	await context.database.batch(
		results.flatMap((row) => [
			context.database
				.prepare(
					`UPDATE mail_threads SET remind_at = NULL, remind_set_at = NULL, unread = 1, folder = 'inbox', folder_identifier = NULL, updated_at = ? WHERE identifier = ?`
				)
				.bind(at, row.identifier),
			actionStatement(context, { personIdentifier: null, action: 'Back in the inbox: the reminder came due', threadIdentifier: row.identifier })
		])
	);
	return results.length;
}

/**
 * Deletes conversations that have been in Deleted for 30 days, and those
 * whose inbox is gone (a personal inbox goes with its owner's account), with
 * their files in the bucket. Run by the mail tick, a few at a time.
 */
export async function purgeDeleted(context: MailContext): Promise<number> {
	const before = new Date(currentTime(context).getTime() - 30 * 86_400_000).toISOString();
	const { results: threads } = await context.database
		.prepare(`SELECT identifier FROM mail_threads WHERE (folder = 'trash' AND updated_at < ?) OR inbox_identifier IS NULL LIMIT 20`)
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
		await forgetAttachmentScans(context, keys.map((row) => row.key));
		await context.database.batch([
			context.database.prepare('DELETE FROM mail_search WHERE thread_identifier = ?').bind(identifier),
			context.database.prepare('UPDATE outreach_recipients SET thread_identifier = NULL, message_identifier = NULL WHERE thread_identifier = ?').bind(identifier),
			context.database.prepare('DELETE FROM mail_threads WHERE identifier = ?').bind(identifier),
			actionStatement(context, { personIdentifier: null, action: 'Deleted for good after 30 days in Deleted', threadIdentifier: identifier })
		]);
	}
	return threads.length;
}

/** One attachment's row, for the download route, if it is in one of the person's inboxes. */
export async function getAttachment(context: MailContext, identifier: string, personIdentifier: string) {
	return context.database
		.prepare(
			`SELECT a.filename, a.media_type AS mediaType, a.size, a.bucket_key AS bucketKey, m.direction = 'in' AS received FROM mail_attachments a
			 JOIN mail_messages m ON m.identifier = a.message_identifier JOIN mail_threads t ON t.identifier = m.thread_identifier
			 WHERE a.identifier = ? AND ${reachableCondition}`
		)
		.bind(identifier, personIdentifier)
		.first<{ filename: string; mediaType: string; size: number; bucketKey: string; received: number }>();
}

/** The bucket key of a message's HTML, for the sandboxed view, if it is in one of the person's inboxes. */
export async function getMessageHtmlKey(context: MailContext, identifier: string, personIdentifier: string): Promise<string | null> {
	const row = await context.database
		.prepare(
			`SELECT m.html_key AS key FROM mail_messages m JOIN mail_threads t ON t.identifier = m.thread_identifier WHERE m.identifier = ? AND ${reachableCondition}`
		)
		.bind(identifier, personIdentifier)
		.first<{ key: string | null }>();
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
