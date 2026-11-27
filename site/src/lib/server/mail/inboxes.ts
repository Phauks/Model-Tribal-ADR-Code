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
 * An inbox can have more addresses than its main one (info@ and hello@
 * beside contact@). Mail to any of them files into the inbox, and a reply
 * goes from the address the mail was sent to. Each person on an inbox
 * chooses their own new-mail alerts for it (src/lib/server/mail/alerts.ts).
 *
 * The tables are in migrations/20261123T1757_add_mail_inboxes.sql and
 * migrations/20261127T0342_add_mail_inbox_addresses_and_alerts.sql.
 */
import { actionStatement, currentTime, type MailContext } from './context.ts';

export class InboxError extends Error {}

export type InboxKind = 'shared' | 'personal';

export interface Inbox {
	identifier: string;
	localPart: string;
	/** The whole address, such as contact@example.org, or null while email is off. */
	address: string | null;
	/** Its extra addresses' local parts, such as "info" and "hello", in the order they were added. */
	aliases: string[];
	/** Every whole address of the inbox, the main one first; empty while email is off. */
	addresses: string[];
	name: string;
	kind: InboxKind;
	ownerIdentifier: string | null;
	catchAll: boolean;
}

/** How someone hears about an inbox's new mail: at once, in a daily summary, or not at all. */
export const alertLevels = ['now', 'daily', 'none'] as const;
export type AlertLevel = (typeof alertLevels)[number];

export interface ManagedInbox extends Inbox {
	ownerName: string | null;
	members: { identifier: string; name: string; alerts: AlertLevel }[];
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

function inboxFromRow(context: MailContext, row: InboxRow, aliases: string[] = []): Inbox {
	const domain = context.settings.domain;
	return {
		identifier: row.identifier,
		localPart: row.local_part,
		address: domain ? `${row.local_part}@${domain}` : null,
		aliases,
		addresses: domain ? [row.local_part, ...aliases].map((localPart) => `${localPart}@${domain}`) : [],
		name: row.name,
		kind: row.kind,
		ownerIdentifier: row.owner_identifier,
		catchAll: row.catch_all === 1
	};
}

const inboxColumns = 'i.identifier, i.local_part, i.name, i.kind, i.owner_identifier, i.catch_all';
// Shared inboxes first, then personal ones; the catch-all first of all.
const inboxOrder = `ORDER BY i.catch_all DESC, i.kind = 'personal', i.name COLLATE NOCASE`;

/** Every inbox's extra addresses, by inbox. */
async function aliasesByInbox(context: MailContext, inboxIdentifier?: string): Promise<Map<string, string[]>> {
	const statement = inboxIdentifier
		? context.database.prepare('SELECT inbox_identifier, local_part FROM mail_inbox_addresses WHERE inbox_identifier = ? ORDER BY added_at, local_part').bind(inboxIdentifier)
		: context.database.prepare('SELECT inbox_identifier, local_part FROM mail_inbox_addresses ORDER BY added_at, local_part');
	const { results } = await statement.all<{ inbox_identifier: string; local_part: string }>();
	const byInbox = new Map<string, string[]>();
	for (const row of results) byInbox.set(row.inbox_identifier, [...(byInbox.get(row.inbox_identifier) ?? []), row.local_part]);
	return byInbox;
}

async function inboxesFromRows(context: MailContext, rows: InboxRow[]): Promise<Inbox[]> {
	if (rows.length === 0) return [];
	const aliases = await aliasesByInbox(context, rows.length === 1 ? rows[0].identifier : undefined);
	return rows.map((row) => inboxFromRow(context, row, aliases.get(row.identifier) ?? []));
}

async function inboxFromOptionalRow(context: MailContext, row: InboxRow | null): Promise<Inbox | null> {
	return row ? (await inboxesFromRows(context, [row]))[0] : null;
}

/** Every inbox. */
export async function listInboxes(context: MailContext): Promise<Inbox[]> {
	const { results } = await context.database.prepare(`SELECT ${inboxColumns} FROM mail_inboxes i ${inboxOrder}`).all<InboxRow>();
	return inboxesFromRows(context, results);
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
	return inboxesFromRows(context, results);
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
	return inboxFromOptionalRow(context, row);
}

/** The part of an address an inbox goes by: before the @ and any "+tag", in lower case. */
function localPartOf(address: string): { localPart: string; domain: string } | null {
	const match = /^([^@\s]+)@([^@\s]+)$/.exec(address.trim().toLowerCase());
	if (!match) return null;
	return { localPart: match[1].split('+')[0], domain: match[2] };
}

/** The project address's local part ("trevor" for Trevor+News@example.org), or null for an address that is not the project's. */
function projectLocalPart(context: MailContext, address: string): string | null {
	const parts = localPartOf(address);
	return parts && context.settings.domain && parts.domain === context.settings.domain ? parts.localPart : null;
}

/** The inbox that has this address, as its main address or an extra one, if any. "trevor+news@" is Trevor's. */
export async function inboxForAddress(context: MailContext, address: string): Promise<Inbox | null> {
	const localPart = projectLocalPart(context, address);
	if (!localPart) return null;
	const row = await context.database
		.prepare(
			`SELECT ${inboxColumns} FROM mail_inboxes i
			 WHERE i.local_part = ?1 OR i.identifier = (SELECT inbox_identifier FROM mail_inbox_addresses WHERE local_part = ?1)`
		)
		.bind(localPart)
		.first<InboxRow>();
	return inboxFromOptionalRow(context, row);
}

/**
 * The address a reply in an inbox goes from: the one of the inbox's
 * addresses the mail was sent to (info@ for mail to info@), or else the
 * inbox's main address.
 */
export function replyFrom(context: MailContext, inbox: Inbox, projectAddress: string | null): string | null {
	const localPart = projectAddress ? projectLocalPart(context, projectAddress) : null;
	const matched = localPart ? inbox.addresses.find((address) => address.startsWith(`${localPart}@`)) : undefined;
	return matched ?? inbox.address;
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
	return inboxes.flatMap((inbox) => inbox.addresses);
}

/**
 * A conversation's inbox, with `address` set to the address its own replies
 * come from: the inbox address the conversation is with (an extra address
 * such as info@ when the mail went there), or else the inbox's main address.
 */
export async function threadInboxAddress(context: MailContext, threadIdentifier: string): Promise<Inbox | null> {
	const row = await context.database
		.prepare(`SELECT ${inboxColumns}, t.project_address FROM mail_threads t JOIN mail_inboxes i ON i.identifier = t.inbox_identifier WHERE t.identifier = ?`)
		.bind(threadIdentifier)
		.first<InboxRow & { project_address: string | null }>();
	const inbox = await inboxFromOptionalRow(context, row);
	return inbox && row ? { ...inbox, address: replyFrom(context, inbox, row.project_address) } : null;
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
				`SELECT m.inbox_identifier, p.identifier, p.display_name AS name, m.alerts FROM mail_inbox_members m
				 JOIN people p ON p.identifier = m.person_identifier ORDER BY p.display_name COLLATE NOCASE`
			)
			.all<{ inbox_identifier: string; identifier: string; name: string; alerts: AlertLevel }>(),
		context.database
			.prepare('SELECT inbox_identifier, COUNT(*) AS count, SUM(unread) AS unread FROM mail_threads WHERE inbox_identifier IS NOT NULL GROUP BY inbox_identifier')
			.all<{ inbox_identifier: string; count: number; unread: number }>()
	]);
	return inboxes.map((inbox) => ({
		...inbox,
		ownerName: owners.results.find((row) => row.identifier === inbox.identifier)?.name ?? null,
		members: members.results.filter((row) => row.inbox_identifier === inbox.identifier).map(({ identifier, name, alerts }) => ({ identifier, name, alerts })),
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
	await refuseTakenAddress(context, localPart);
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

/** Refuses an address that is already an inbox's, as its main address or an extra one. */
async function refuseTakenAddress(context: MailContext, localPart: string): Promise<void> {
	const taken = await context.database
		.prepare(
			`SELECT i.name FROM mail_inboxes i
			 WHERE i.local_part = ?1 OR i.identifier = (SELECT inbox_identifier FROM mail_inbox_addresses WHERE local_part = ?1)`
		)
		.bind(localPart)
		.first<{ name: string }>();
	if (taken) throw new InboxError(`${localPart}@ is already an address of the ${taken.name} inbox.`);
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

/** Gives an inbox another address. Mail to it files into the inbox, and replies to that mail go from it. */
export async function addInboxAddress(context: MailContext, personIdentifier: string, inboxIdentifier: string, value: string): Promise<string> {
	const row = await inboxRow(context, inboxIdentifier);
	const localPart = cleanLocalPart(value);
	await refuseTakenAddress(context, localPart);
	const at = currentTime(context).toISOString();
	await context.database.batch([
		context.database.prepare('INSERT INTO mail_inbox_addresses (local_part, inbox_identifier, added_at) VALUES (?, ?, ?)').bind(localPart, inboxIdentifier, at),
		actionStatement(context, { personIdentifier, action: 'Gave an inbox another address', note: `${localPart}@ for ${row.local_part}@` })
	]);
	return localPart;
}

/**
 * Takes an extra address off an inbox. Mail to it then goes to the inbox
 * that gets other mail. The main address stays: deleting the inbox is the
 * way to give it up.
 */
export async function removeInboxAddress(context: MailContext, personIdentifier: string, inboxIdentifier: string, value: string): Promise<void> {
	const row = await inboxRow(context, inboxIdentifier);
	const localPart = value.trim().toLowerCase().replace(/@.*$/, '');
	if (localPart === row.local_part) throw new InboxError(`${localPart}@ is the inbox’s main address. Delete the inbox to give it up.`);
	const result = await context.database.batch([
		context.database.prepare('DELETE FROM mail_inbox_addresses WHERE inbox_identifier = ? AND local_part = ?').bind(inboxIdentifier, localPart),
		actionStatement(context, { personIdentifier, action: 'Took an address off an inbox', note: `${localPart}@ from ${row.local_part}@` })
	]);
	if (((result[0] as { meta?: { changes?: number } }).meta?.changes ?? 0) === 0) throw new InboxError(`${localPart}@ is not an address of this inbox.`);
}

/**
 * Sets how one person hears about one inbox's new mail. Only they set it,
 * and only for an inbox they are on. Choosing the daily summary starts its
 * day now, so the first one comes about a day later.
 */
export async function setInboxAlerts(context: MailContext, personIdentifier: string, inboxIdentifier: string, level: string): Promise<AlertLevel> {
	if (!(alertLevels as readonly string[]).includes(level)) throw new InboxError('Choose at once, a daily summary or no alerts.');
	const at = currentTime(context).toISOString();
	const result = await context.database
		.prepare(
			`UPDATE mail_inbox_members SET alerts = ?1, summarized_at = CASE WHEN ?1 = 'daily' AND alerts <> 'daily' THEN ?2 ELSE summarized_at END
			 WHERE inbox_identifier = ?3 AND person_identifier = ?4`
		)
		.bind(level, at, inboxIdentifier, personIdentifier)
		.run();
	if ((result.meta.changes ?? 0) === 0) throw new InboxError('You are not on that inbox.');
	return level as AlertLevel;
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
		context.database.prepare('DELETE FROM mail_inbox_addresses WHERE inbox_identifier = ?').bind(inboxIdentifier),
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

/**
 * What the reply box needs: the addresses the person may send from, every
 * inbox's addresses (for Reply all), and the one to start with: the inbox
 * address the conversation is with, such as info@, or else the inbox's main
 * address.
 */
export async function replyAddresses(context: MailContext, personIdentifier: string, inboxIdentifier: string | null, projectAddress: string | null = null) {
	const [all, mine] = await Promise.all([listInboxes(context), reachableInboxes(context, personIdentifier)]);
	const sendable = mine.flatMap((inbox) => inbox.addresses);
	const inbox = mine.find((item) => item.identifier === inboxIdentifier);
	const own = inbox ? replyFrom(context, inbox, projectAddress) : null;
	return {
		sendable,
		projectAddresses: all.flatMap((item) => item.addresses),
		from: own ?? sendable[0] ?? ''
	};
}
