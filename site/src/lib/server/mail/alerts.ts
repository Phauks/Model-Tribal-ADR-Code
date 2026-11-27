/**
 * New-mail alerts (site/MAIL.md, "New-mail alerts"). Each person on an
 * inbox chooses, for that inbox, how they hear about its new mail: at once
 * (an alert as mail arrives, at most one every 30 minutes), in a daily
 * summary, or not at all. Alerts go to the email the person signs in with,
 * never to one of the project's own addresses, and never quote the mail, so
 * the message stays in the project's own storage.
 *
 * At-once alerts follow each filed message (src/lib/server/mail/arrivals.ts);
 * daily summaries ride the hourly scheduled run (src/routes/mail/scheduled).
 * The choices are columns of mail_inbox_members
 * (migrations/20261127T0342_add_mail_inbox_addresses_and_alerts.sql).
 */
import { currentTime, type MailCarriers, type MailContext } from './context.ts';
import { noticeHeader } from './inbound.ts';
import { newMessageIdentifier } from './mime.ts';
import { isProjectAddress } from './settings.ts';

/** At most one at-once alert per person and inbox in this long. */
export const alertGapMinutes = 30;

/** A daily summary runs once this long after the last. A little under a day, so the hourly run does not slip an hour each day. */
const summaryGapMilliseconds = 23.5 * 60 * 60_000;

interface Recipient {
	person_identifier: string;
	email: string;
	inbox_identifier: string;
	inbox_name: string;
	local_part: string;
}

function inboxLink(context: MailContext, inboxIdentifier: string): string {
	const site = context.settings.siteAddress;
	return site ? `${site}/workspace/inbox?inbox=${encodeURIComponent(inboxIdentifier)}` : 'the workspace inbox on the website';
}

function settingsLink(context: MailContext): string {
	const site = context.settings.siteAddress;
	return site ? `${site}/workspace/inbox/settings` : 'Inbox settings on the website';
}

async function sendAlert(context: MailContext, carriers: MailCarriers, recipient: Recipient, subject: string, lines: string[]): Promise<void> {
	const domain = context.settings.domain!;
	await carriers.replies!.send({
		from: { email: `${recipient.local_part}@${domain}`, name: `${context.settings.senderName} inbox` },
		to: [{ email: recipient.email }],
		subject,
		text: lines.join('\n'),
		headers: { [noticeHeader]: 'yes', 'X-Auto-Response-Suppress': 'All' },
		messageId: newMessageIdentifier(domain)
	});
}

/**
 * Sends the at-once alerts for mail just filed in an inbox: one to each
 * person on it who chose "At once" and has had no alert for it in the last
 * 30 minutes. Returns how many were sent.
 */
export async function sendArrivalAlerts(context: MailContext, carriers: MailCarriers, inboxIdentifier: string): Promise<number> {
	if (!carriers.replies || !context.settings.domain) return 0;
	const at = currentTime(context);
	const since = new Date(at.getTime() - alertGapMinutes * 60_000).toISOString();
	const { results } = await context.database
		.prepare(
			`SELECT m.person_identifier, p.email, i.identifier AS inbox_identifier, i.name AS inbox_name, i.local_part
			 FROM mail_inbox_members m JOIN people p ON p.identifier = m.person_identifier JOIN mail_inboxes i ON i.identifier = m.inbox_identifier
			 WHERE m.inbox_identifier = ? AND m.alerts = 'now' AND p.status = 'active' AND (m.alerted_at IS NULL OR m.alerted_at <= ?)`
		)
		.bind(inboxIdentifier, since)
		.all<Recipient>();
	let sent = 0;
	for (const recipient of results) {
		if (isProjectAddress(context.settings, recipient.email)) continue;
		// Claim the alert first, so two messages arriving at once send one alert.
		const claimed = await context.database
			.prepare(
				`UPDATE mail_inbox_members SET alerted_at = ?1
				 WHERE inbox_identifier = ?2 AND person_identifier = ?3 AND alerts = 'now' AND (alerted_at IS NULL OR alerted_at <= ?4)`
			)
			.bind(at.toISOString(), recipient.inbox_identifier, recipient.person_identifier, since)
			.run();
		if ((claimed.meta.changes ?? 0) === 0) continue;
		try {
			await sendAlert(context, carriers, recipient, `New mail in ${recipient.inbox_name}`, [
				`New mail has arrived in the ${recipient.inbox_name} inbox (${recipient.local_part}@${context.settings.domain}). Read it at ${inboxLink(context, recipient.inbox_identifier)}.`,
				'',
				`This alert does not quote the message, so it stays in the project's own storage. You get at most one alert for this inbox every ${alertGapMinutes} minutes.`,
				`Change how you hear about new mail: ${settingsLink(context)}`
			]);
			sent += 1;
		} catch (problem) {
			console.error('A new-mail alert failed', problem);
		}
	}
	return sent;
}

/**
 * Sends the daily summaries that are due: for each person and inbox set to
 * "Daily summary" whose last summary ran about a day ago (or never), how
 * many messages arrived since and how many conversations are unread. A day
 * with no new mail sends nothing but still counts as that day's summary.
 */
export async function sendDailySummaries(context: MailContext, carriers: MailCarriers, limit = 100): Promise<{ sent: number; failed: number }> {
	if (!carriers.replies || !context.settings.domain) return { sent: 0, failed: 0 };
	const at = currentTime(context);
	const due = new Date(at.getTime() - summaryGapMilliseconds).toISOString();
	const dayAgo = new Date(at.getTime() - 24 * 60 * 60_000).toISOString();
	const { results } = await context.database
		.prepare(
			`SELECT m.person_identifier, p.email, i.identifier AS inbox_identifier, i.name AS inbox_name, i.local_part,
				COALESCE(m.summarized_at, ?1) AS since
			 FROM mail_inbox_members m JOIN people p ON p.identifier = m.person_identifier JOIN mail_inboxes i ON i.identifier = m.inbox_identifier
			 WHERE m.alerts = 'daily' AND p.status = 'active' AND (m.summarized_at IS NULL OR m.summarized_at <= ?2)
			 LIMIT ?3`
		)
		.bind(dayAgo, due, limit)
		.all<Recipient & { since: string }>();
	let sent = 0;
	let failed = 0;
	for (const recipient of results) {
		const counts = await context.database
			.prepare(
				`SELECT
					(SELECT COUNT(*) FROM mail_messages m JOIN mail_threads t ON t.identifier = m.thread_identifier
					 WHERE t.inbox_identifier = ?1 AND m.direction = 'in' AND m.spam_reason IS NULL AND m.automatic = 0
						AND t.folder <> 'spam' AND m.received_at > ?2) AS arrived,
					(SELECT COUNT(*) FROM mail_threads t WHERE t.inbox_identifier = ?1 AND t.unread = 1 AND t.folder IN ('inbox', 'folder')) AS unread`
			)
			.bind(recipient.inbox_identifier, recipient.since)
			.first<{ arrived: number; unread: number }>();
		await context.database
			.prepare('UPDATE mail_inbox_members SET summarized_at = ? WHERE inbox_identifier = ? AND person_identifier = ?')
			.bind(at.toISOString(), recipient.inbox_identifier, recipient.person_identifier)
			.run();
		const arrived = counts?.arrived ?? 0;
		const unread = counts?.unread ?? 0;
		if (arrived === 0 || isProjectAddress(context.settings, recipient.email)) continue;
		try {
			await sendAlert(context, carriers, recipient, `Daily summary: ${recipient.inbox_name}`, [
				`${arrived === 1 ? 'One message' : `${arrived} messages`} arrived in the ${recipient.inbox_name} inbox (${recipient.local_part}@${context.settings.domain}) since the last summary. ${unread === 0 ? 'No conversations there are unread.' : unread === 1 ? 'One conversation there is unread.' : `${unread} conversations there are unread.`}`,
				`Read them at ${inboxLink(context, recipient.inbox_identifier)}.`,
				'',
				"This summary does not quote any message, so the mail stays in the project's own storage.",
				`Change how you hear about new mail: ${settingsLink(context)}`
			]);
			sent += 1;
		} catch (problem) {
			failed += 1;
			console.error('A daily mail summary failed', problem);
		}
	}
	return { sent, failed };
}
