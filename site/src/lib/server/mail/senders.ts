/**
 * Who a conversation is with, and what the inbox can do about them
 * (site/MAIL.md, "Blocking, unsubscribing and exporting"): the sender's card
 * from the address book with their earlier conversations, blocking an
 * address or a whole domain, and unsubscribing from a mailing list.
 *
 * Blocked mail is still received and kept, in Spam, so nothing is lost if a
 * block was a mistake; it starts no conversation in the inbox, sends no
 * notice and gets no away message.
 */
import type { MailAddress } from '#lib/mail.ts';
import { actionStatement, currentTime, type MailCarriers, type MailContext } from './context.ts';
import { reachableCondition, threadInboxAddress } from './inboxes.ts';
import { newMessageIdentifier } from './mime.ts';

export class SenderError extends Error {}

// ---------------------------------------------------------------------------
// The sender's card
// ---------------------------------------------------------------------------

export interface SenderCard {
	address: string;
	/** The address book's entry for this address, when there is one. */
	contact: {
		identifier: string;
		kind: 'person' | 'organization';
		name: string;
		role: string | null;
		organization: string | null;
		nationIdentifier: string | null;
		/** The contact's other emails and phones in use. */
		otherWays: { method: 'email' | 'phone'; value: string; label: string }[];
		/** Where the address book says it read this address, and when it last checked. */
		source: string;
		verifiedOn: string;
	} | null;
	/** Earlier conversations with this address, newest first. */
	conversations: { identifier: string; subject: string; lastMessageAt: string; folder: string }[];
	conversationCount: number;
	/** The block that covers this address (the address or its domain), if any. */
	blockedBy: string | null;
}

/**
 * The card for the other side of a conversation, as one person sees it: the
 * address book entry only for someone who may read the private address book,
 * and earlier conversations only from inboxes they are on. The address book
 * may not be in the database yet (migration 0012), so a missing table means
 * no entry.
 */
export async function senderCard(
	context: MailContext,
	address: string,
	thisThread: string,
	viewer: { personIdentifier: string; seesAddressBook: boolean }
): Promise<SenderCard> {
	const email = address.toLowerCase();
	let contact: SenderCard['contact'] = null;
	try {
		// The address book is the lead author's alone (src/lib/permissions.ts, manage-address-book).
		const row = !viewer.seesAddressBook
			? null
			: await context.database
			.prepare(
				`SELECT c.identifier, c.kind, c.name, c.role, COALESCE(c.nation_identifier, o.nation_identifier) AS nation_identifier,
				 o.name AS organization, m.source_label, m.verified_on FROM contact_methods m
				 JOIN contacts c ON c.identifier = m.contact_identifier LEFT JOIN contacts o ON o.identifier = c.organization_identifier
				 WHERE m.method = 'email' AND m.value = ? ORDER BY m.status = 'current' DESC, m.preferred DESC LIMIT 1`
			)
			.bind(email)
			.first<{
				identifier: string;
				kind: 'person' | 'organization';
				name: string;
				role: string | null;
				nation_identifier: string | null;
				organization: string | null;
				source_label: string;
				verified_on: string;
			}>();
		if (row) {
			const { results } = await context.database
				.prepare(
					`SELECT method, value, label FROM contact_methods WHERE contact_identifier = ? AND status = 'current' AND value <> ?
					 ORDER BY method, preferred DESC, value LIMIT 12`
				)
				.bind(row.identifier, email)
				.all<{ method: 'email' | 'phone'; value: string; label: string }>();
			contact = {
				identifier: row.identifier,
				kind: row.kind,
				name: row.name,
				role: row.role,
				organization: row.kind === 'person' ? row.organization : null,
				nationIdentifier: row.nation_identifier,
				otherWays: results,
				source: row.source_label,
				verifiedOn: row.verified_on
			};
		}
	} catch (problem) {
		if (!/no such table/i.test(String(problem))) throw problem;
	}
	const { results: conversations } = await context.database
		.prepare(
			`SELECT t.identifier, t.subject, t.last_message_at AS lastMessageAt, t.folder FROM mail_threads t
			 WHERE t.counterpart_address = ? AND t.identifier <> ? AND t.folder <> 'trash' AND ${reachableCondition}
			 ORDER BY t.last_message_at DESC LIMIT 6`
		)
		.bind(email, thisThread, viewer.personIdentifier)
		.all<{ identifier: string; subject: string; lastMessageAt: string; folder: string }>();
	const count = await context.database
		.prepare(
			`SELECT COUNT(*) AS count FROM mail_threads t WHERE t.counterpart_address = ? AND t.identifier <> ? AND t.folder <> 'trash' AND ${reachableCondition}`
		)
		.bind(email, thisThread, viewer.personIdentifier)
		.first<{ count: number }>();
	return { address: email, contact, conversations, conversationCount: count?.count ?? 0, blockedBy: await blockedPattern(context, email) };
}

// ---------------------------------------------------------------------------
// Blocking
// ---------------------------------------------------------------------------

/** The domain block for an address: @ and the part after it. */
export function domainPattern(address: string): string {
	return `@${address.toLowerCase().split('@').pop() ?? ''}`;
}

/** The block that covers this address, by the address itself or its domain, or null. */
export async function blockedPattern(context: MailContext, address: string): Promise<string | null> {
	const email = address.toLowerCase();
	const row = await context.database
		.prepare('SELECT pattern FROM mail_blocked_senders WHERE pattern IN (?, ?) ORDER BY pattern = ? DESC LIMIT 1')
		.bind(email, domainPattern(email), email)
		.first<{ pattern: string }>();
	return row?.pattern ?? null;
}

export interface BlockedSender {
	pattern: string;
	note: string | null;
	blockedByName: string | null;
	blockedAt: string;
}

export async function listBlocked(context: MailContext): Promise<BlockedSender[]> {
	const { results } = await context.database
		.prepare(
			`SELECT b.pattern, b.note, p.display_name AS blockedByName, b.blocked_at AS blockedAt FROM mail_blocked_senders b
			 LEFT JOIN people p ON p.identifier = b.blocked_by ORDER BY b.blocked_at DESC`
		)
		.all<BlockedSender>();
	return results;
}

/**
 * Blocks an address, or a whole domain written as @example.com. The
 * project's own addresses and domain cannot be blocked. With a conversation
 * named, that conversation goes to Spam too.
 */
export async function blockSender(
	context: MailContext,
	personIdentifier: string,
	pattern: string,
	options: { note?: string | null; threadIdentifier?: string | null } = {}
): Promise<string> {
	const clean = pattern.trim().toLowerCase();
	const valid = /^@[a-z0-9.-]+\.[a-z]{2,}$/.test(clean) || /^[^\s@]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(clean);
	if (!valid) throw new SenderError('Write an address, such as someone@example.com, or a domain with an @ in front, such as @example.com.');
	const domain = context.settings.domain;
	if (domain && (clean === `@${domain}` || clean.endsWith(`@${domain}`))) {
		throw new SenderError('The project’s own addresses cannot be blocked.');
	}
	const at = currentTime(context).toISOString();
	const statements = [
		context.database
			.prepare(
				`INSERT INTO mail_blocked_senders (pattern, note, blocked_by, blocked_at) VALUES (?1, ?2, ?3, ?4)
				 ON CONFLICT (pattern) DO UPDATE SET note = COALESCE(?2, note)`
			)
			.bind(clean, options.note?.trim() || null, personIdentifier, at),
		actionStatement(context, { personIdentifier, action: 'Blocked a sender', threadIdentifier: options.threadIdentifier ?? null, note: clean })
	];
	if (options.threadIdentifier) {
		statements.push(
			context.database
				.prepare(
					`UPDATE mail_threads SET folder = 'spam', folder_identifier = NULL, remind_at = NULL, remind_set_at = NULL, updated_at = ? WHERE identifier = ?`
				)
				.bind(at, options.threadIdentifier)
		);
	}
	await context.database.batch(statements);
	return clean;
}

export async function unblockSender(context: MailContext, personIdentifier: string, pattern: string): Promise<boolean> {
	const removed = await context.database.prepare('DELETE FROM mail_blocked_senders WHERE pattern = ?').bind(pattern.toLowerCase()).run();
	if ((removed.meta.changes ?? 0) === 0) return false;
	await actionStatement(context, { personIdentifier, action: 'Unblocked a sender', note: pattern.toLowerCase() }).run();
	return true;
}

// ---------------------------------------------------------------------------
// Unsubscribing from a mailing list
// ---------------------------------------------------------------------------

export interface UnsubscribeWays {
	/** An https address that unsubscribes when sent a POST (RFC 8058, one click). */
	oneClick: string | null;
	/** An address to write to, with the subject and body the list asks for (RFC 2369). */
	mail: { to: string; subject: string; body: string } | null;
	/** An https page to open, when the list offers nothing that works without a person. */
	page: string | null;
}

/** The ways a message's List-Unsubscribe headers offer (RFC 2369 and RFC 8058). */
export function unsubscribeWays(header: string | null, post: string | null): UnsubscribeWays {
	const ways: UnsubscribeWays = { oneClick: null, mail: null, page: null };
	if (!header) return ways;
	const oneClick = post !== null && /List-Unsubscribe\s*=\s*One-Click/i.test(post);
	for (const [, value] of header.matchAll(/<\s*([^>\s]+)\s*>/g)) {
		if (/^https:\/\//i.test(value)) {
			if (oneClick && !ways.oneClick) ways.oneClick = value;
			else if (!ways.page) ways.page = value;
		} else if (/^mailto:/i.test(value) && !ways.mail) {
			const [address, query = ''] = value.slice(7).split('?');
			const parameters = new URLSearchParams(query);
			const to = decodeURIComponent(address).trim().toLowerCase();
			if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
				ways.mail = { to, subject: parameters.get('subject') ?? 'unsubscribe', body: parameters.get('body') ?? 'unsubscribe' };
			}
		}
	}
	return ways;
}

/**
 * Unsubscribes the project from the list a message came from: by the
 * one-click address when there is one, else by writing to the list's
 * unsubscribe address. When only a web page is offered, nothing is sent and
 * the page is returned for a person to open. The conversation is archived
 * either way, since the person asked to stop reading it.
 */
export async function unsubscribe(
	context: MailContext,
	carriers: MailCarriers,
	personIdentifier: string,
	messageIdentifier: string,
	fetcher: typeof fetch = fetch
): Promise<{ how: 'one-click' | 'mail' | 'page'; page?: string }> {
	const row = await context.database
		.prepare(
			`SELECT m.thread_identifier, m.list_unsubscribe, m.list_unsubscribe_post, t.project_address FROM mail_messages m
			 JOIN mail_threads t ON t.identifier = m.thread_identifier WHERE m.identifier = ? AND m.direction = 'in'`
		)
		.bind(messageIdentifier)
		.first<{ thread_identifier: string; list_unsubscribe: string | null; list_unsubscribe_post: string | null; project_address: string | null }>();
	if (!row) throw new SenderError('That message is not in the inbox.');
	const ways = unsubscribeWays(row.list_unsubscribe, row.list_unsubscribe_post);
	let how: 'one-click' | 'mail' | 'page';
	if (ways.oneClick) {
		const response = await fetcher(ways.oneClick, {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: 'List-Unsubscribe=One-Click',
			redirect: 'manual',
			signal: AbortSignal.timeout(10_000)
		}).catch((problem: unknown) => {
			throw new SenderError(`The list’s unsubscribe address did not answer (${problem instanceof Error ? problem.message : String(problem)}).`);
		});
		if (response.status >= 400) throw new SenderError(`The list’s unsubscribe address refused (status ${response.status}). Try its web page instead.`);
		how = 'one-click';
	} else if (ways.mail) {
		// From the address of the inbox the list wrote to.
		const from = (await threadInboxAddress(context, row.thread_identifier))?.address;
		if (!carriers.replies || !from || !context.settings.domain) throw new SenderError('Sending is not switched on yet, so the unsubscribe message cannot go.');
		const to: MailAddress = { email: ways.mail.to };
		await carriers.replies.send({
			from: { email: from, name: context.settings.senderName },
			to: [to],
			subject: ways.mail.subject,
			text: ways.mail.body,
			headers: { 'Auto-Submitted': 'auto-generated' },
			messageId: newMessageIdentifier(context.settings.domain)
		});
		how = 'mail';
	} else if (ways.page) {
		how = 'page';
	} else {
		throw new SenderError('This message does not say how to unsubscribe. Block the sender instead.');
	}
	const at = currentTime(context).toISOString();
	await context.database.batch([
		context.database
			.prepare(`UPDATE mail_threads SET folder = 'archive', folder_identifier = NULL, unread = 0, updated_at = ? WHERE identifier = ?`)
			.bind(at, row.thread_identifier),
		actionStatement(context, {
			personIdentifier,
			action: how === 'page' ? 'Opened a list’s unsubscribe page' : 'Unsubscribed from a mailing list',
			threadIdentifier: row.thread_identifier,
			note: how === 'one-click' ? ways.oneClick : how === 'mail' ? ways.mail!.to : ways.page
		})
	]);
	return how === 'page' ? { how, page: ways.page! } : { how };
}
