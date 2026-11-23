/**
 * The project's inboxes (site/MAIL.md, "Inboxes"). Each project address has
 * an inbox. A shared inbox (contact@, requests@) is read by everyone on its
 * list; a personal inbox (trevor@) only by the person it belongs to, and
 * not by anyone who manages the inbox either. Mail to an address no inbox
 * has goes to the one catch-all inbox, which is always shared.
 *
 * Every page that shows a conversation, a message or a file from one asks
 * here first (`mayOpenThread`, `reachableInboxes`), so nobody can open mail
 * from an inbox they are not on, even with its link.
 *
 * The tables are in migrations/20261123T1757_add_mail_inboxes.sql.
 */
import { actionStatement, currentTime, type MailContext } from './context.ts';

export class InboxError extends Error {}

export type InboxKind = 'shared' | 'personal';

export interface Inbox {
	identifier: string;
	localPart: string;
	/** The whole address, such as contact@example.org, or null while email is off. */
	address: string | null;
	name: string;
	kind: InboxKind;
	ownerIdentifier: string | null;
	catchAll: boolean;
}

export interface ManagedInbox extends Inbox {
	ownerName: string | null;
	members: { identifier: string; name: string }[];
	conversationCount: number;
	unread: number;
}

interface InboxRow {
	identifier: string;
	local_part: string;
	name: string;
	kind: InboxKind;
	owner_identifier: string | null;
	catch_all: number;
}

/** The roles that may be given an inbox or put on one. */
export const inboxRoles = ['lead-author', 'editor', 'co-author', 'advisor'] as const;

/** Local parts the inbox needs for itself. */
const reservedLocalParts = new Set(['unsubscribe']);

function inboxFromRow(context: MailContext, row: InboxRow): Inbox {
	return {
		identifier: row.identifier,
		localPart: row.local_part,
		address: context.settings.domain ? `${row.local_part}@${context.settings.domain}` : null,
		name: row.name,
		kind: row.kind,
		ownerIdentifier: row.owner_identifier,
		catchAll: row.catch_all === 1
	};
}

const inboxColumns = 'i.identifier, i.local_part, i.name, i.kind, i.owner_identifier, i.catch_all';
// Shared inboxes first, then personal ones; the catch-all first of all.
const inboxOrder = `ORDER BY i.catch_all DESC, i.kind = 'personal', i.name COLLATE NOCASE`;

/** Every inbox. */
export async function listInboxes(context: MailContext): Promise<Inbox[]> {
	const { results } = await context.database.prepare(`SELECT ${inboxColumns} FROM mail_inboxes i ${inboxOrder}`).all<InboxRow>();
	return results.map((row) => inboxFromRow(context, row));
}

/** The inboxes one person is on. */
export async function reachableInboxes(context: MailContext, personIdentifier: string): Promise<Inbox[]> {
	const { results } = await context.database
		.prepare(
			`SELECT ${inboxColumns} FROM mail_inboxes i JOIN mail_inbox_members m ON m.inbox_identifier = i.identifier
			 WHERE m.person_identifier = ? ${inboxOrder}`
		)
		.bind(personIdentifier)
		.all<InboxRow>();
	return results.map((row) => inboxFromRow(context, row));
}

/**
 * A condition on a conversation (as `t`) that it is in an inbox the person
 * is on. The caller binds the person's identifier where the `?` is.
 */
export const reachableCondition = `t.inbox_identifier IN (SELECT inbox_identifier FROM mail_inbox_members WHERE person_identifier = ?)`;

/** Whether the person may open a conversation: it exists, and its inbox is one they are on. */
export async function mayOpenThread(context: MailContext, personIdentifier: string, threadIdentifier: string): Promise<boolean> {
	const row = await context.database
		.prepare(`SELECT 1 AS found FROM mail_threads t WHERE t.identifier = ? AND ${reachableCondition}`)
		.bind(threadIdentifier, personIdentifier)
		.first();
	return row !== null;
}

/** Whether the person is on at least one inbox. */
export async function hasAnyInbox(context: Pick<MailContext, 'database'>, personIdentifier: string): Promise<boolean> {
	const row = await context.database.prepare('SELECT 1 AS found FROM mail_inbox_members WHERE person_identifier = ? LIMIT 1').bind(personIdentifier).first();
	return row !== null;
}

/** The catch-all inbox. There is always one; the migration makes it and it cannot be deleted. */
export async function catchAllInbox(context: MailContext): Promise<Inbox | null> {
	const row = await context.database.prepare(`SELECT ${inboxColumns} FROM mail_inboxes i WHERE i.catch_all = 1`).first<InboxRow>();
	return row ? inboxFromRow(context, row) : null;
}

/** The part of an address an inbox goes by: before the @ and any "+tag", in lower case. */
function localPartOf(address: string): { localPart: string; domain: string } | null {
	const match = /^([^@\s]+)@([^@\s]+)$/.exec(address.trim().toLowerCase());
	if (!match) return null;
	return { localPart: match[1].split('+')[0], domain: match[2] };
}

/** The inbox that has this address, if any. "trevor+news@" is Trevor's. */
export async function inboxForAddress(context: MailContext, address: string): Promise<Inbox | null> {
	const parts = localPartOf(address);
	if (!parts || !context.settings.domain || parts.domain !== context.settings.domain) return null;
	const row = await context.database.prepare(`SELECT ${inboxColumns} FROM mail_inboxes i WHERE i.local_part = ?`).bind(parts.localPart).first<InboxRow>();
	return row ? inboxFromRow(context, row) : null;
}

/** Where mail to an address goes: its own inbox, or else the catch-all. */
export async function inboxForArrival(context: MailContext, address: string | null): Promise<Inbox | null> {
	return (address ? await inboxForAddress(context, address) : null) ?? (await catchAllInbox(context));
}

/**
 * The addresses someone may send from: those of the inboxes they are on,
 * or, for mail the inbox sends by itself (no person), any inbox's.
 */
export async function sendingAddresses(context: MailContext, personIdentifier: string | null): Promise<string[]> {
	const inboxes = personIdentifier ? await reachableInboxes(context, personIdentifier) : await listInboxes(context);
	return inboxes.flatMap((inbox) => (inbox.address ? [inbox.address] : []));
}

/** The address a conversation's own replies come from: its inbox's address. */
export async function threadInboxAddress(context: MailContext, threadIdentifier: string): Promise<Inbox | null> {
	const row = await context.database
		.prepare(`SELECT ${inboxColumns} FROM mail_threads t JOIN mail_inboxes i ON i.identifier = t.inbox_identifier WHERE t.identifier = ?`)
		.bind(threadIdentifier)
		.first<InboxRow>();
	return row ? inboxFromRow(context, row) : null;
}

// ---------------------------------------------------------------------------
// Managing inboxes (Inbox settings, for whoever manages the inbox)
// ---------------------------------------------------------------------------

/**
 * Every inbox with who is on it and how many conversations it has. The
 * counts are all anyone managing inboxes sees of a personal inbox.
 */
export async function inboxesForManaging(context: MailContext): Promise<ManagedInbox[]> {
	const [inboxes, owners, members, counts] = await Promise.all([
		listInboxes(context),
		context.database
			.prepare('SELECT i.identifier, p.display_name AS name FROM mail_inboxes i JOIN people p ON p.identifier = i.owner_identifier')
			.all<{ identifier: string; name: string }>(),
		context.database
			.prepare(
				`SELECT m.inbox_identifier, p.identifier, p.display_name AS name FROM mail_inbox_members m
				 JOIN people p ON p.identifier = m.person_identifier ORDER BY p.display_name COLLATE NOCASE`
			)
			.all<{ inbox_identifier: string; identifier: string; name: string }>(),
		context.database
			.prepare('SELECT inbox_identifier, COUNT(*) AS count, SUM(unread) AS unread FROM mail_threads WHERE inbox_identifier IS NOT NULL GROUP BY inbox_identifier')
			.all<{ inbox_identifier: string; count: number; unread: number }>()
	]);
	return inboxes.map((inbox) => ({
		...inbox,
		ownerName: owners.results.find((row) => row.identifier === inbox.identifier)?.name ?? null,
		members: members.results.filter((row) => row.inbox_identifier === inbox.identifier).map(({ identifier, name }) => ({ identifier, name })),
		conversationCount: counts.results.find((row) => row.inbox_identifier === inbox.identifier)?.count ?? 0,
		unread: counts.results.find((row) => row.inbox_identifier === inbox.identifier)?.unread ?? 0
	}));
}

/** The people who may be given an inbox or put on one. */
export async function inboxCandidates(context: MailContext): Promise<{ identifier: string; name: string }[]> {
	const { results } = await context.database
		.prepare(
			`SELECT identifier, display_name AS name FROM people WHERE status = 'active' AND role IN (${inboxRoles.map(() => '?').join(', ')})
			 ORDER BY display_name COLLATE NOCASE`
		)
		.bind(...inboxRoles)
		.all<{ identifier: string; name: string }>();
	return results;
}

async function candidate(context: MailContext, personIdentifier: string): Promise<{ name: string }> {
	const person = (await inboxCandidates(context)).find((row) => row.identifier === personIdentifier);
	if (!person) throw new InboxError('Choose someone on the project team.');
	return person;
}

function cleanLocalPart(value: string): string {
	const localPart = value.trim().toLowerCase().replace(/@.*$/, '');
	if (!/^[a-z0-9._-]{1,64}$/.test(localPart)) throw new InboxError('Use letters, numbers, dots, dashes or underscores before the @, such as "contact" or "trevor".');
	if (reservedLocalParts.has(localPart)) throw new InboxError(`"${localPart}@" is kept for the inbox's own use.`);
	return localPart;
}

function cleanName(value: string): string {
	const name = value.replace(/\s+/g, ' ').trim();
	if (!name || name.length > 80) throw new InboxError('Give the inbox a name of at most 80 characters.');
	return name;
}

/** Makes an inbox. A personal one belongs to `ownerIdentifier`; a shared one starts with the person making it on it. */
export async function createInbox(
	context: MailContext,
	personIdentifier: string,
	input: { localPart: string; name: string; kind: InboxKind; ownerIdentifier?: string | null }
): Promise<string> {
	const localPart = cleanLocalPart(input.localPart);
	const name = cleanName(input.name);
	const clash = await context.database.prepare('SELECT 1 AS found FROM mail_inboxes WHERE local_part = ?').bind(localPart).first();
	if (clash) throw new InboxError(`There is already an inbox for ${localPart}@.`);
	const owner = input.kind === 'personal' ? (input.ownerIdentifier ?? null) : null;
	if (input.kind === 'personal') {
		if (!owner) throw new InboxError('Choose whose inbox it is.');
		await candidate(context, owner);
	}
	const identifier = crypto.randomUUID();
	const at = currentTime(context).toISOString();
	await context.database.batch([
		context.database
			.prepare(
				`INSERT INTO mail_inboxes (identifier, local_part, name, kind, owner_identifier, catch_all, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
			)
			.bind(identifier, localPart, name, input.kind, owner, at, at),
		context.database
			.prepare('INSERT INTO mail_inbox_members (inbox_identifier, person_identifier, added_at) VALUES (?, ?, ?)')
			.bind(identifier, owner ?? personIdentifier, at),
		actionStatement(context, { personIdentifier, action: `Made ${input.kind === 'personal' ? 'a personal' : 'a shared'} inbox`, note: `${localPart}@` })
	]);
	return identifier;
}

async function inboxRow(context: MailContext, inboxIdentifier: string): Promise<InboxRow> {
	const row = await context.database.prepare(`SELECT ${inboxColumns} FROM mail_inboxes i WHERE i.identifier = ?`).bind(inboxIdentifier).first<InboxRow>();
	if (!row) throw new InboxError('That inbox is gone.');
	return row;
}

export async function renameInbox(context: MailContext, personIdentifier: string, inboxIdentifier: string, name: string): Promise<void> {
	const row = await inboxRow(context, inboxIdentifier);
	const clean = cleanName(name);
	const at = currentTime(context).toISOString();
	await context.database.batch([
		context.database.prepare('UPDATE mail_inboxes SET name = ?, updated_at = ? WHERE identifier = ?').bind(clean, at, inboxIdentifier),
		actionStatement(context, { personIdentifier, action: 'Renamed an inbox', note: `${row.local_part}@: ${clean}` })
	]);
}

/** Puts someone on a shared inbox. A personal inbox is only ever its owner's. */
export async function addInboxMember(context: MailContext, personIdentifier: string, inboxIdentifier: string, memberIdentifier: string): Promise<void> {
	const row = await inboxRow(context, inboxIdentifier);
	if (row.kind === 'personal') throw new InboxError('A personal inbox is only for the person it belongs to.');
	const member = await candidate(context, memberIdentifier);
	const at = currentTime(context).toISOString();
	await context.database.batch([
		context.database
			.prepare('INSERT INTO mail_inbox_members (inbox_identifier, person_identifier, added_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING')
			.bind(inboxIdentifier, memberIdentifier, at),
		actionStatement(context, { personIdentifier, action: 'Added someone to an inbox', note: `${member.name}: ${row.local_part}@` })
	]);
}

/** Takes someone off a shared inbox. The last person cannot be taken off, so the inbox is never unread by anyone. */
export async function removeInboxMember(context: MailContext, personIdentifier: string, inboxIdentifier: string, memberIdentifier: string): Promise<void> {
	const row = await inboxRow(context, inboxIdentifier);
	if (row.kind === 'personal') throw new InboxError('A personal inbox is only for the person it belongs to.');
	const { results } = await context.database
		.prepare('SELECT person_identifier FROM mail_inbox_members WHERE inbox_identifier = ?')
		.bind(inboxIdentifier)
		.all<{ person_identifier: string }>();
	if (!results.some((member) => member.person_identifier === memberIdentifier)) return;
	if (results.length === 1) throw new InboxError('An inbox needs at least one person on it.');
	await context.database.batch([
		context.database.prepare('DELETE FROM mail_inbox_members WHERE inbox_identifier = ? AND person_identifier = ?').bind(inboxIdentifier, memberIdentifier),
		context.database
			.prepare(
				`UPDATE mail_threads SET assignee_identifier = NULL WHERE inbox_identifier = ? AND assignee_identifier = ?`
			)
			.bind(inboxIdentifier, memberIdentifier),
		actionStatement(context, { personIdentifier, action: 'Took someone off an inbox', note: `${row.local_part}@` })
	]);
}

/** Makes a shared inbox the one that gets mail for addresses no inbox has. */
export async function makeCatchAll(context: MailContext, personIdentifier: string, inboxIdentifier: string): Promise<void> {
	const row = await inboxRow(context, inboxIdentifier);
	if (row.kind !== 'shared') throw new InboxError('Only a shared inbox can get mail for other addresses.');
	const at = currentTime(context).toISOString();
	await context.database.batch([
		context.database.prepare('UPDATE mail_inboxes SET catch_all = 0, updated_at = ? WHERE catch_all = 1').bind(at),
		context.database.prepare('UPDATE mail_inboxes SET catch_all = 1, updated_at = ? WHERE identifier = ?').bind(at, inboxIdentifier),
		actionStatement(context, { personIdentifier, action: 'Chose where other mail goes', note: `${row.local_part}@` })
	]);
}

/**
 * Deletes an inbox that has no conversations left. The catch-all cannot be
 * deleted. Mail to its address goes to the catch-all from then on.
 */
export async function deleteInbox(context: MailContext, personIdentifier: string, inboxIdentifier: string): Promise<void> {
	const row = await inboxRow(context, inboxIdentifier);
	if (row.catch_all === 1) throw new InboxError('Choose another inbox for other mail first; this one gets it now.');
	const count = await context.database
		.prepare('SELECT COUNT(*) AS count FROM mail_threads WHERE inbox_identifier = ?')
		.bind(inboxIdentifier)
		.first<{ count: number }>();
	if (count && count.count > 0) {
		throw new InboxError(
			`It still has ${count.count} conversation${count.count === 1 ? '' : 's'}. ${row.kind === 'personal' ? 'The person it belongs to' : 'Someone on it'} has to delete them first, and Deleted is emptied after 30 days.`
		);
	}
	await context.database.batch([
		context.database.prepare('DELETE FROM mail_inboxes WHERE identifier = ?').bind(inboxIdentifier),
		actionStatement(context, { personIdentifier, action: 'Deleted an inbox', note: `${row.local_part}@` })
	]);
}

/** The people on a conversation's inbox, who may be assigned it. */
export async function threadPeople(context: MailContext, threadIdentifier: string): Promise<{ identifier: string; name: string }[]> {
	const { results } = await context.database
		.prepare(
			`SELECT p.identifier, p.display_name AS name FROM mail_threads t
			 JOIN mail_inbox_members m ON m.inbox_identifier = t.inbox_identifier JOIN people p ON p.identifier = m.person_identifier
			 WHERE t.identifier = ? AND p.status = 'active' ORDER BY p.display_name COLLATE NOCASE`
		)
		.bind(threadIdentifier)
		.all<{ identifier: string; name: string }>();
	return results;
}

/** What the reply box needs: the addresses the person may send from, every inbox's address (for Reply all), and the one to start with. */
export async function replyAddresses(context: MailContext, personIdentifier: string, inboxIdentifier: string | null) {
	const [all, mine] = await Promise.all([listInboxes(context), reachableInboxes(context, personIdentifier)]);
	const sendable = mine.flatMap((inbox) => (inbox.address ? [inbox.address] : []));
	const own = mine.find((inbox) => inbox.identifier === inboxIdentifier)?.address ?? null;
	return {
		sendable,
		projectAddresses: all.flatMap((inbox) => (inbox.address ? [inbox.address] : [])),
		from: own ?? sendable[0] ?? ''
	};
}
