import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types/index.ts';
import { newIdentifier, now } from './identifiers.ts';

/**
 * What an entry in the activity log is about. 'document' entries come from
 * the website editor (saved, restored and submitted versions); 'profile'
 * entries from contributor profiles. Entries are never changed or deleted,
 * and are sealed into a hash chain (activity-seals.ts).
 */
export const eventTargets = ['person', 'request', 'review', 'grant', 'document', 'profile'] as const;
export type EventTarget = (typeof eventTargets)[number];

export interface EventInput {
	/** Empty for actions by a requester or by the site itself. */
	personIdentifier: string | null;
	action: string;
	targetKind: EventTarget;
	targetIdentifier: string;
	note?: string | null;
}

/**
 * A statement that records who did what. Returned, not run, so it can be
 * sent in the same batch as the change it describes: D1 runs a batch as one
 * transaction, so a change is never saved without its record.
 */
export function eventStatement(database: D1Database, event: EventInput): D1PreparedStatement {
	return database
		.prepare(
			`INSERT INTO events (identifier, person_identifier, action, target_kind, target_identifier, note, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(
			newIdentifier(),
			event.personIdentifier,
			event.action,
			event.targetKind,
			event.targetIdentifier,
			event.note ?? null,
			now()
		);
}

export interface EventRow {
	identifier: string;
	action: string;
	note: string | null;
	createdAt: string;
	personName: string | null;
}

/** The history of one person, request or review, oldest first. */
export async function eventsFor(
	database: D1Database,
	targetKind: EventTarget,
	targetIdentifier: string
): Promise<EventRow[]> {
	const result = await database
		.prepare(
			`SELECT events.identifier, events.action, events.note, events.created_at AS createdAt,
			        people.display_name AS personName
			 FROM events LEFT JOIN people ON people.identifier = events.person_identifier
			 WHERE target_kind = ? AND target_identifier = ?
			 ORDER BY events.sequence`
		)
		.bind(targetKind, targetIdentifier)
		.all<EventRow>();
	return result.results;
}

export interface ActivityRow {
	sequence: number;
	action: string;
	note: string | null;
	createdAt: string;
	targetKind: EventTarget;
	targetIdentifier: string;
	actorName: string | null;
	/** The person's name when the entry is about a person. */
	targetName: string | null;
}

/** A page of the whole activity log, newest first, for the lead author. */
export async function activityPage(
	database: D1Database,
	options: { before?: number; targetKind?: EventTarget; personIdentifier?: string; limit?: number }
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
