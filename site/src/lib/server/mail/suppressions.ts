/**
 * The do-not-email list (mail_suppressions) and what follows from it in the
 * address book. An address goes on the list when its owner unsubscribes or
 * asks not to be written to, when a message to it bounces for good, or when
 * its owner marks a message as spam. Nothing takes an address off the list
 * by itself; the lead author can, on the Outreach page.
 *
 * The address book (contacts and contact_methods, migration 0012) may not be
 * in the database yet while it is being built, so changes to it are tried
 * and skipped when its tables are missing.
 */
import { actionStatement, currentTime, type MailContext } from './context.ts';

export type SuppressionReason = 'unsubscribed' | 'asked' | 'complaint' | 'hard-bounce' | 'manual';

export const suppressionLabels: Record<SuppressionReason, string> = {
	unsubscribed: 'Used the unsubscribe link or address',
	asked: 'Asked in a reply not to be written to',
	complaint: 'Marked a message as spam',
	'hard-bounce': 'Mail to the address bounced',
	manual: 'Added by hand'
};

export async function isSuppressed(context: MailContext, email: string): Promise<boolean> {
	const row = await context.database
		.prepare('SELECT 1 AS found FROM mail_suppressions WHERE email = ?')
		.bind(email.toLowerCase())
		.first<{ found: number }>();
	return row !== null;
}

/** Which of these addresses are on the list. */
export async function suppressedAmong(context: MailContext, emails: string[]): Promise<Set<string>> {
	const found = new Set<string>();
	const lower = [...new Set(emails.map((email) => email.toLowerCase()))];
	for (let start = 0; start < lower.length; start += 50) {
		const part = lower.slice(start, start + 50);
		const { results } = await context.database
			.prepare(`SELECT email FROM mail_suppressions WHERE email IN (${part.map(() => '?').join(', ')})`)
			.bind(...part)
			.all<{ email: string }>();
		for (const row of results) found.add(row.email);
	}
	return found;
}

/**
 * Puts an address on the list, stops any outreach still waiting for it, and,
 * for a bounce, marks the address bounced in the address book.
 */
export async function suppress(
	context: MailContext,
	email: string,
	reason: SuppressionReason,
	details: { source?: string | null; note?: string | null; personIdentifier?: string | null } = {}
): Promise<void> {
	const address = email.toLowerCase();
	const at = currentTime(context).toISOString();
	const recipientStatus = reason === 'hard-bounce' ? 'bounced' : 'unsubscribed';
	await context.database.batch([
		context.database
			.prepare(
				`INSERT INTO mail_suppressions (email, reason, source, note, created_at) VALUES (?, ?, ?, ?, ?)
				 ON CONFLICT (email) DO NOTHING`
			)
			.bind(address, reason, details.source ?? null, details.note ?? null, at),
		context.database
			.prepare(`UPDATE outreach_recipients SET status = ?, skip_reason = ? WHERE email = ? AND status = 'queued'`)
			.bind(recipientStatus, suppressionLabels[reason], address),
		actionStatement(context, {
			personIdentifier: details.personIdentifier ?? null,
			action: 'Added to the do-not-email list',
			note: `${address}: ${suppressionLabels[reason]}`
		})
	]);
	if (reason === 'hard-bounce') await markBouncedInAddressBook(context, address);
}

export async function liftSuppression(context: MailContext, email: string, personIdentifier: string): Promise<void> {
	await context.database.batch([
		context.database.prepare('DELETE FROM mail_suppressions WHERE email = ?').bind(email.toLowerCase()),
		actionStatement(context, { personIdentifier, action: 'Removed from the do-not-email list', note: email.toLowerCase() })
	]);
}

export async function listSuppressions(context: MailContext) {
	const { results } = await context.database
		.prepare('SELECT email, reason, source, note, created_at AS createdAt FROM mail_suppressions ORDER BY created_at DESC LIMIT 500')
		.all<{ email: string; reason: SuppressionReason; source: string | null; note: string | null; createdAt: string }>();
	return results;
}

/**
 * Marks the address bounced wherever the address book lists it, recording
 * the change as the address book does (contact_changes, with the row as it
 * was). Skipped when the address book's tables are not there yet.
 */
export async function markBouncedInAddressBook(context: MailContext, email: string): Promise<number> {
	try {
		const { results } = await context.database
			.prepare(`SELECT * FROM contact_methods WHERE method = 'email' AND value = ? AND status = 'current'`)
			.bind(email.toLowerCase())
			.all<Record<string, unknown> & { identifier: string; contact_identifier: string }>();
		if (results.length === 0) return 0;
		const at = currentTime(context).toISOString();
		await context.database.batch(
			results.flatMap((row) => [
				context.database
					.prepare(`UPDATE contact_methods SET status = 'bounced', preferred = 0, updated_at = ?, updated_by = NULL WHERE identifier = ?`)
					.bind(at, row.identifier),
				context.database
					.prepare(
						`INSERT INTO contact_changes (identifier, contact_identifier, method_identifier, change, before, person_identifier, created_at)
						 VALUES (?, ?, ?, 'Marked bounced', ?, NULL, ?)`
					)
					.bind(crypto.randomUUID(), row.contact_identifier, row.identifier, JSON.stringify(row), at)
			])
		);
		return results.length;
	} catch (problem) {
		if (/no such table/i.test(String(problem))) return 0;
		throw problem;
	}
}
