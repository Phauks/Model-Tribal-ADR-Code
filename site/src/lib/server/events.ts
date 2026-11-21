import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types/index.ts';
import { newIdentifier, now } from './identifiers.ts';

export type EventTarget = 'person' | 'request' | 'review';

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
			 ORDER BY events.created_at`
		)
		.bind(targetKind, targetIdentifier)
		.all<EventRow>();
	return result.results;
}
