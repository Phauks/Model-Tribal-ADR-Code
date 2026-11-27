/**
 * Keeping arriving mail safe until it is filed (site/MAIL.md, "When
 * something fails"). The Worker's email handler first writes each message
 * whole to the mail bucket under mail/incoming/, with its envelope, and only
 * then files it. If filing fails (the database busy, a bug, a deploy at the
 * wrong moment), the copy stays, the message is still accepted, and the mail
 * run every five minutes tries again with longer waits. After the last try,
 * the inbox lists it for someone who manages mail to try again by hand.
 */
import { actionStatement, currentTime, type MailCarriers, type MailContext } from './context.ts';
import { receiveMail, type ArrivalResult } from './inbound.ts';
import { sendArrivalAlerts } from './alerts.ts';
import { sendAwayReply } from './writing.ts';

/** Where an arriving message waits until it is filed. */
export const incomingPrefix = 'mail/incoming/';

export function incomingKey(identifier: string): string {
	return `${incomingPrefix}${identifier}.eml`;
}

/** Minutes to wait before each new try: about a day in all, then a person is asked. */
export const arrivalRetryMinutes = [5, 15, 60, 240, 720] as const;

/** A message is left to the email handler this long before the mail run picks it up, so the two do not file it at once. */
const handlerGraceMilliseconds = 2 * 60_000;

/** Keeps an arriving message whole, with its envelope, before anything else is done with it. */
export async function keepArrival(context: MailContext, arriving: { from: string; to: string; raw: ArrayBuffer | Uint8Array }): Promise<string> {
	const key = incomingKey(crypto.randomUUID());
	await context.bucket.put(key, arriving.raw, {
		httpMetadata: { contentType: 'message/rfc822' },
		customMetadata: { from: arriving.from.slice(0, 500), to: arriving.to.slice(0, 500) }
	});
	return key;
}

/**
 * Files a kept message and lets it go from mail/incoming/. Returns null when
 * the copy is gone, which happens when another run filed it first. A message
 * the inbox refuses (no inbox takes its address) stays, for the caller to
 * refuse or record; dropArrival lets it go.
 */
export async function fileArrival(context: MailContext, key: string): Promise<ArrivalResult | null> {
	const object = await context.bucket.get(key);
	if (!object) return null;
	const raw = await object.arrayBuffer();
	const result = await receiveMail(context, { from: object.customMetadata?.from ?? '', to: object.customMetadata?.to ?? '', raw });
	if (result.outcome !== 'rejected') await dropArrival(context, key);
	return result;
}

/** Lets a kept message go once it is filed or refused. */
export async function dropArrival(context: MailContext, key: string): Promise<void> {
	await context.bucket.delete(key);
	await context.database.prepare('DELETE FROM mail_arrival_problems WHERE object_key = ?').bind(key).run();
}

/** What follows a filed message: the new-mail alerts and the away message. A failure of either is logged; the message is filed. */
export async function afterArrival(context: MailContext, carriers: MailCarriers, result: ArrivalResult | null): Promise<void> {
	if (result?.outcome !== 'filed') return;
	if (result.notify) await sendArrivalAlerts(context, carriers, result.inboxIdentifier).catch((problem) => console.error('The new-mail alerts failed', problem));
	if (result.answerable) await sendAwayReply(context, carriers, result).catch((problem) => console.error('The away message failed', problem));
}

/** Records a failed try and when to try next; after the last, the message waits for a person. */
async function recordProblem(context: MailContext, key: string, problem: unknown): Promise<void> {
	const at = currentTime(context);
	const reason = (problem instanceof Error ? problem.message : String(problem)).slice(0, 500);
	const row = await context.database.prepare('SELECT attempts FROM mail_arrival_problems WHERE object_key = ?').bind(key).first<{ attempts: number }>();
	const attempts = (row?.attempts ?? 0) + 1;
	const wait = arrivalRetryMinutes[attempts - 1];
	const next = wait === undefined ? null : new Date(at.getTime() + wait * 60_000).toISOString();
	const statements = [
		context.database
			.prepare(
				`INSERT INTO mail_arrival_problems (object_key, attempts, last_error, first_failed_at, next_try_at, gave_up_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
				 ON CONFLICT (object_key) DO UPDATE SET attempts = ?2, last_error = ?3, next_try_at = ?5, gave_up_at = ?6`
			)
			.bind(key, attempts, reason, at.toISOString(), next, next ? null : at.toISOString())
	];
	if (!next) statements.push(actionStatement(context, { personIdentifier: null, action: 'A message could not be filed', note: reason }));
	await context.database.batch(statements);
}

/**
 * Files messages still waiting in mail/incoming/: those whose first filing
 * failed, and any the email handler did not finish. Run by the mail run.
 */
export async function fileWaitingArrivals(context: MailContext, carriers: MailCarriers, limit = 20): Promise<{ filed: number; failed: number }> {
	const now = currentTime(context);
	const listed = await context.bucket.list({ prefix: incomingPrefix, limit: 100, include: ['customMetadata'] });
	const old = listed.objects.filter((object) => now.getTime() - new Date(object.uploaded).getTime() >= handlerGraceMilliseconds);
	if (old.length === 0) return { filed: 0, failed: 0 };
	const { results: problems } = await context.database
		.prepare(`SELECT object_key, next_try_at, gave_up_at FROM mail_arrival_problems WHERE object_key LIKE ?`)
		.bind(`${incomingPrefix}%`)
		.all<{ object_key: string; next_try_at: string | null; gave_up_at: string | null }>();
	const waiting = new Map(problems.map((row) => [row.object_key, row]));
	let filed = 0;
	let failed = 0;
	for (const object of old) {
		if (filed + failed >= limit) break;
		const problem = waiting.get(object.key);
		if (problem?.gave_up_at || (problem?.next_try_at && new Date(problem.next_try_at).getTime() > now.getTime())) continue;
		try {
			const result = await fileArrival(context, object.key);
			// Too late to refuse it to the sender, so it waits for a person, like a message that could not be filed.
			if (result?.outcome === 'rejected') throw new Error(result.reason);
			await afterArrival(context, carriers, result);
			filed += 1;
		} catch (failure) {
			await recordProblem(context, object.key, failure);
			failed += 1;
		}
	}
	return { filed, failed };
}

/** Records the email handler's own failed try, so the mail run waits before the next. */
export async function arrivalFailed(context: MailContext, key: string, problem: unknown): Promise<void> {
	await recordProblem(context, key, problem).catch((failure) => console.error('Could not record a failed filing', failure));
}

/** Messages that could not be filed after every try, for the inbox to list. */
export async function stuckArrivals(context: MailContext): Promise<{ key: string; attempts: number; lastError: string; firstFailedAt: string; envelopeTo: string | null }[]> {
	const { results } = await context.database
		.prepare('SELECT object_key, attempts, last_error, first_failed_at FROM mail_arrival_problems WHERE gave_up_at IS NOT NULL ORDER BY first_failed_at LIMIT 50')
		.all<{ object_key: string; attempts: number; last_error: string; first_failed_at: string }>();
	const found = [];
	for (const row of results) {
		const head = await context.bucket.head(row.object_key);
		if (!head) {
			await context.database.prepare('DELETE FROM mail_arrival_problems WHERE object_key = ?').bind(row.object_key).run();
			continue;
		}
		found.push({ key: row.object_key, attempts: row.attempts, lastError: row.last_error, firstFailedAt: row.first_failed_at, envelopeTo: head.customMetadata?.to ?? null });
	}
	return found;
}

/** Puts every message that could not be filed back in line, to be tried at the next mail run. */
export async function tryStuckArrivalsAgain(context: MailContext, personIdentifier: string): Promise<number> {
	const result = await context.database.batch([
		context.database.prepare(`UPDATE mail_arrival_problems SET gave_up_at = NULL, next_try_at = NULL, attempts = 1 WHERE gave_up_at IS NOT NULL`),
		actionStatement(context, { personIdentifier, action: 'Asked to file stuck messages again' })
	]);
	return result[0].meta.changes ?? 0;
}
