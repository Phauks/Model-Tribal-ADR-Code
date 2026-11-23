/**
 * Storage for the project's review of what nations publish on their own
 * pages (decision record 0041, "Stage 3"; migration 0022). The rules are in
 * src/lib/nation-page-review.ts. Every step is also written to the activity
 * log under the nation's page, beside the team's own changes.
 */
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { describeChange, pageLogTarget } from '../nation-page-changes.ts';
import type { ReviewOutcome } from '../nation-page-review.ts';
import { eventStatement } from './events.ts';
import { newIdentifier, now } from './identifiers.ts';
import { changeColumns, changeTables, fromStored, type ChangeRow, type StoredChange } from './nation-page-changes.ts';
import type { SignedInPerson } from './people.ts';

/** Published changes the project has not looked at yet, oldest first. Changes still waiting to go live are included. */
export async function reviewQueue(database: D1Database): Promise<ChangeRow[]> {
	const result = await database
		.prepare(
			`SELECT ${changeColumns} FROM ${changeTables}
			 LEFT JOIN nation_page_reviews ON nation_page_reviews.change_identifier = nation_page_changes.identifier
			 WHERE nation_page_changes.status = 'published' AND nation_page_reviews.change_identifier IS NULL
			 ORDER BY nation_page_changes.published_at, nation_page_changes.rowid`
		)
		.all<StoredChange>();
	return result.results.map(fromStored);
}

/** How many changes wait for the project, and how many of them were published before this time. */
export async function reviewCounts(database: D1Database, dueBefore: string): Promise<{ waiting: number; overdue: number }> {
	const row = await database
		.prepare(
			`SELECT COUNT(*) AS waiting, SUM(CASE WHEN nation_page_changes.published_at <= ? THEN 1 ELSE 0 END) AS overdue
			 FROM nation_page_changes
			 LEFT JOIN nation_page_reviews ON nation_page_reviews.change_identifier = nation_page_changes.identifier
			 WHERE nation_page_changes.status = 'published' AND nation_page_reviews.change_identifier IS NULL`
		)
		.bind(dueBefore)
		.first<{ waiting: number; overdue: number | null }>();
	return { waiting: row?.waiting ?? 0, overdue: row?.overdue ?? 0 };
}

export interface ReviewRow {
	change: ChangeRow;
	outcome: ReviewOutcome;
	note: string | null;
	reviewedByName: string | null;
	reviewedAt: string;
}

/** What the project has looked at lately, newest first. */
export async function recentReviews(database: D1Database, limit = 30): Promise<ReviewRow[]> {
	const result = await database
		.prepare(
			`SELECT ${changeColumns}, nation_page_reviews.outcome AS reviewOutcome, nation_page_reviews.note AS reviewNote,
			        reviewer.display_name AS reviewedByName, nation_page_reviews.reviewed_at AS reviewedAt
			 FROM ${changeTables}
			 JOIN nation_page_reviews ON nation_page_reviews.change_identifier = nation_page_changes.identifier
			 LEFT JOIN people AS reviewer ON reviewer.identifier = nation_page_reviews.reviewed_by
			 ORDER BY nation_page_reviews.reviewed_at DESC LIMIT ?`
		)
		.bind(limit)
		.all<StoredChange & { reviewOutcome: ReviewOutcome; reviewNote: string | null; reviewedByName: string | null; reviewedAt: string }>();
	return result.results.map(({ reviewOutcome, reviewNote, reviewedByName, reviewedAt, ...stored }) => ({
		change: fromStored(stored),
		outcome: reviewOutcome,
		note: reviewNote,
		reviewedByName,
		reviewedAt
	}));
}

function reviewStatement(database: D1Database, change: ChangeRow, outcome: ReviewOutcome, note: string | null, person: SignedInPerson, time: string) {
	return database
		.prepare(
			`INSERT INTO nation_page_reviews (change_identifier, nation_identifier, outcome, note, reviewed_by, reviewed_at)
			 VALUES (?, ?, ?, ?, ?, ?)`
		)
		.bind(change.identifier, change.nationIdentifier, outcome, note, person.identifier, time);
}

function logStatement(database: D1Database, person: SignedInPerson, nationIdentifier: string, action: string, note: string | null) {
	return eventStatement(database, {
		personIdentifier: person.identifier,
		action,
		targetKind: 'document',
		targetIdentifier: pageLogTarget(nationIdentifier),
		note
	});
}

/** The project read the change and leaves it as it is. */
export async function markRead(database: D1Database, change: ChangeRow, person: SignedInPerson, note: string | null, time = now()): Promise<void> {
	await database.batch([
		reviewStatement(database, change, 'read', note, person, time),
		logStatement(database, person, change.nationIdentifier, `Read by the project: ${describeChange(change.kind, change.content)}`, note)
	]);
}

/**
 * The project takes a published change off the page. The page goes back to
 * the version before it; the change stays in the team's private history.
 */
export async function undoChange(database: D1Database, change: ChangeRow, person: SignedInPerson, note: string | null, time = now()): Promise<void> {
	await database.batch([
		database
			.prepare(
				`UPDATE nation_page_changes SET status = 'discarded', discarded_by = ?, discarded_at = ?
				 WHERE identifier = ? AND status = 'published'`
			)
			.bind(person.identifier, time, change.identifier),
		reviewStatement(database, change, 'undone', note, person, time),
		logStatement(database, person, change.nationIdentifier, `Undone by the project: ${describeChange(change.kind, change.content)}`, note)
	]);
}

export interface PauseRow {
	identifier: string;
	nationIdentifier: string;
	question: string;
	pausedByName: string | null;
	pausedAt: string;
	answer: string | null;
	answeredByName: string | null;
	answeredAt: string | null;
}

const pauseQuery = `SELECT nation_page_pauses.identifier, nation_page_pauses.nation_identifier AS nationIdentifier,
	nation_page_pauses.question, pauser.display_name AS pausedByName, nation_page_pauses.paused_at AS pausedAt,
	nation_page_pauses.answer, answerer.display_name AS answeredByName, nation_page_pauses.answered_at AS answeredAt
	FROM nation_page_pauses
	LEFT JOIN people AS pauser ON pauser.identifier = nation_page_pauses.paused_by
	LEFT JOIN people AS answerer ON answerer.identifier = nation_page_pauses.answered_by
	WHERE nation_page_pauses.resumed_at IS NULL`;

/** The pause in force on a nation's page, if any. */
export async function currentPause(database: D1Database, nationIdentifier: string): Promise<PauseRow | undefined> {
	const row = await database.prepare(`${pauseQuery} AND nation_page_pauses.nation_identifier = ?`).bind(nationIdentifier).first<PauseRow>();
	return row ?? undefined;
}

/** Every pause in force, oldest first. */
export async function currentPauses(database: D1Database): Promise<PauseRow[]> {
	const result = await database.prepare(`${pauseQuery} ORDER BY nation_page_pauses.paused_at`).all<PauseRow>();
	return result.results;
}

/** Pauses a nation's publishing and asks its team a question. Returns false when a pause is already in force. */
export async function pausePublishing(
	database: D1Database,
	nationIdentifier: string,
	question: string,
	person: SignedInPerson,
	time = now()
): Promise<boolean> {
	if (await currentPause(database, nationIdentifier)) return false;
	await database.batch([
		database
			.prepare(
				`INSERT INTO nation_page_pauses (identifier, nation_identifier, question, paused_by, paused_at)
				 VALUES (?, ?, ?, ?, ?)`
			)
			.bind(newIdentifier(), nationIdentifier, question, person.identifier, time),
		logStatement(database, person, nationIdentifier, 'Publishing paused by the project', question)
	]);
	return true;
}

/** The team answers the project's question. A later answer replaces an earlier one. */
export async function answerPause(database: D1Database, pause: PauseRow, answer: string, person: SignedInPerson, time = now()): Promise<void> {
	await database.batch([
		database
			.prepare(
				`UPDATE nation_page_pauses SET answer = ?, answered_by = ?, answered_at = ?
				 WHERE identifier = ? AND resumed_at IS NULL`
			)
			.bind(answer, person.identifier, time, pause.identifier),
		logStatement(database, person, pause.nationIdentifier, 'The team answered the project', answer)
	]);
}

export async function resumePublishing(database: D1Database, pause: PauseRow, person: SignedInPerson, time = now()): Promise<void> {
	await database.batch([
		database
			.prepare(`UPDATE nation_page_pauses SET resumed_by = ?, resumed_at = ? WHERE identifier = ? AND resumed_at IS NULL`)
			.bind(person.identifier, time, pause.identifier),
		logStatement(database, person, pause.nationIdentifier, 'Publishing resumed by the project', null)
	]);
}

/** The nation's changes the project undid, with the project's note, so the team's history can say so. */
export async function undoneChanges(database: D1Database, nationIdentifier: string): Promise<Map<string, string | null>> {
	const result = await database
		.prepare(`SELECT change_identifier AS changeIdentifier, note FROM nation_page_reviews WHERE nation_identifier = ? AND outcome = 'undone'`)
		.bind(nationIdentifier)
		.all<{ changeIdentifier: string; note: string | null }>();
	return new Map(result.results.map((row) => [row.changeIdentifier, row.note]));
}
