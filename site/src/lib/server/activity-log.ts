import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types/index.ts';
import { newIdentifier, now } from './identifiers.ts';

/**
 * What an entry in the activity log is about. 'document' entries come from
 * the website editor (saved, restored and submitted versions); 'profile'
 * entries from contributor profiles. Entries are never changed or deleted,
 * and are sealed into a hash chain (activity-seals.ts).
 */
export const activityTargets = ['person', 'request', 'review', 'grant', 'document', 'profile', 'upload'] as const;
export type ActivityTarget = (typeof activityTargets)[number];

export interface ActivityInput {
	/** Empty for actions by a requester or by the site itself. */
	personIdentifier: string | null;
	action: string;
	targetKind: ActivityTarget;
	targetIdentifier: string;
	note?: string | null;
}

/**
 * A statement that records who did what. Returned, not run, so it can be
 * sent in the same batch as the change it describes: D1 runs a batch as one
 * transaction, so a change is never saved without its record.
 */
export function activityStatement(database: D1Database, entry: ActivityInput): D1PreparedStatement {
	// The activity log lives in the D1 table that keeps its older name, `events` (with `event_seals`), so the deployed Worker and the database never disagree.
	return database
		.prepare(
			`INSERT INTO events (identifier, person_identifier, action, target_kind, target_identifier, note, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(
			newIdentifier(),
			entry.personIdentifier,
			entry.action,
			entry.targetKind,
			entry.targetIdentifier,
			entry.note ?? null,
			now()
		);
}

export interface ActivityHistoryRow {
	identifier: string;
	action: string;
	note: string | null;
	createdAt: string;
	personName: string | null;
}

/** The history of one person, request or review, oldest first. */
export async function activityHistoryFor(
	database: D1Database,
	targetKind: ActivityTarget,
	targetIdentifier: string
): Promise<ActivityHistoryRow[]> {
	const result = await database
		.prepare(
			`SELECT events.identifier, events.action, events.note, events.created_at AS createdAt,
			        people.display_name AS personName
			 FROM events LEFT JOIN people ON people.identifier = events.person_identifier
			 WHERE target_kind = ? AND target_identifier = ?
			 ORDER BY events.sequence`
		)
		.bind(targetKind, targetIdentifier)
		.all<ActivityHistoryRow>();
	return result.results;
}

export interface ActivityRow {
	sequence: number;
	action: string;
	note: string | null;
	createdAt: string;
	targetKind: ActivityTarget;
	targetIdentifier: string;
	actorName: string | null;
	/** The person's name when the entry is about a person. */
	targetName: string | null;
}

/** A page of the whole activity log, newest first, for the lead author. */
export async function activityPage(
	database: D1Database,
	options: { before?: number; targetKind?: ActivityTarget; personIdentifier?: string; limit?: number }
): Promise<ActivityRow[]> {
	const result = await database
		.prepare(
			`SELECT events.sequence, events.action, events.note, events.created_at AS createdAt,
			        events.target_kind AS targetKind, events.target_identifier AS targetIdentifier,
			        actor.display_name AS actorName, target.display_name AS targetName
			 FROM events
			 LEFT JOIN people AS actor ON actor.identifier = events.person_identifier
			 LEFT JOIN people AS target
			   ON events.target_kind = 'person' AND target.identifier = events.target_identifier
			 WHERE (?1 IS NULL OR events.sequence < ?1)
			   AND (?2 IS NULL OR events.target_kind = ?2)
			   AND (?3 IS NULL OR events.person_identifier = ?3
			        OR (events.target_kind = 'person' AND events.target_identifier = ?3))
			 ORDER BY events.sequence DESC LIMIT ?4`
		)
		.bind(
			options.before ?? null,
			options.targetKind ?? null,
			options.personIdentifier ?? null,
			options.limit ?? 100
		)
		.all<ActivityRow>();
	return result.results;
}

/** The action recorded when someone tries a change they are not allowed to make. */
export const refusedAction = 'Refused: tried a change without permission';

const exportColumns = `events.sequence, events.identifier, events.person_identifier AS personIdentifier,
	        events.action, events.target_kind AS targetKind, events.target_identifier AS targetIdentifier,
	        events.note, events.created_at AS createdAt, event_seals.hash AS seal`;

/**
 * The whole activity log with its seals as JSON Lines, one entry per line, oldest first. It is read and sent a page at a time, so a long log never has to fit in memory as one string. It covers the entries there when it starts; entries added while it is being sent wait for the next copy. An empty log is a single empty line, as it always was.
 */
export function activityLogLines(database: D1Database, pageSize = 500): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();
	let last: number | undefined;
	let newest = 0;
	let sentAny = false;
	return new ReadableStream<Uint8Array>({
		async pull(controller) {
			if (last === undefined) {
				const top = await database
					.prepare('SELECT MAX(sequence) AS newest FROM events')
					.first<{ newest: number | null }>();
				newest = top?.newest ?? 0;
				last = 0;
			}
			const page = await database
				.prepare(
					`SELECT ${exportColumns}
					 FROM events LEFT JOIN event_seals ON event_seals.sequence = events.sequence
					 WHERE events.sequence > ? AND events.sequence <= ?
					 ORDER BY events.sequence LIMIT ?`
				)
				.bind(last, newest, pageSize)
				.all<{ sequence: number }>();
			if (page.results.length === 0) {
				if (!sentAny) controller.enqueue(encoder.encode('\n'));
				controller.close();
				return;
			}
			sentAny = true;
			last = page.results[page.results.length - 1].sequence;
			controller.enqueue(encoder.encode(page.results.map((row) => JSON.stringify(row) + '\n').join('')));
		}
	});
}
