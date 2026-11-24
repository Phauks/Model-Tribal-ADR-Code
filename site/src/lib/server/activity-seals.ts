/**
 * Tamper evidence for the activity log (site/COLLABORATION.md, "Activity
 * log"). Every entry gets a seal: the SHA-256 hash of the entry together
 * with the seal of the entry before it, a hash chain. Changing, removing or
 * reordering a sealed entry breaks every seal after it, which `checkSeals`
 * finds. The database itself also refuses to change or delete entries and
 * seals (migrations/0002_permission_tiers.sql).
 *
 * What this does not do: someone who can run any SQL on the database (that
 * is, someone with the Cloudflare account) could drop those rules and write a
 * new, consistent chain. Comparing the latest seal with a copy kept somewhere
 * else catches that; the Activity page shows the latest seal for that reason.
 * OWASP recommends both protecting log integrity and detecting tampering
 * (OWASP Logging Cheat Sheet, "Protection"; NIST SP 800-92, section 4.2).
 */
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { now } from './identifiers.ts';

interface EventForSeal {
	sequence: number;
	identifier: string;
	personIdentifier: string | null;
	action: string;
	targetKind: string;
	targetIdentifier: string;
	note: string | null;
	createdAt: string;
}

const eventColumns = `sequence, identifier, person_identifier AS personIdentifier, action,
	target_kind AS targetKind, target_identifier AS targetIdentifier, note, created_at AS createdAt`;

/** The chain starts from this value, so the first seal is computed like every other. */
export const chainStart = '0'.repeat(64);

/** The seal of an entry: SHA-256 of the previous seal and the entry's fields, in hexadecimal. */
export async function sealOf(previous: string, entry: EventForSeal): Promise<string> {
	const canonical = JSON.stringify([
		previous,
		entry.sequence,
		entry.identifier,
		entry.personIdentifier,
		entry.action,
		entry.targetKind,
		entry.targetIdentifier,
		entry.note,
		entry.createdAt
	]);
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Seals entries that have none yet, oldest first, up to `limit`. Safe to run
 * at the same time from two requests: both compute the same seals, and
 * "INSERT OR IGNORE" keeps the first.
 */
export async function sealNewEntries(database: D1Database, limit = 500): Promise<number> {
	const last = await database
		.prepare('SELECT sequence, hash FROM event_seals ORDER BY sequence DESC LIMIT 1')
		.first<{ sequence: number; hash: string }>();
	const entries = await database
		.prepare(`SELECT ${eventColumns} FROM events WHERE sequence > ? ORDER BY sequence LIMIT ?`)
		.bind(last?.sequence ?? 0, limit)
		.all<EventForSeal>();
	if (entries.results.length === 0) return 0;

	let previous = last?.hash ?? chainStart;
	const time = now();
	const statements = [];
	for (const entry of entries.results) {
		previous = await sealOf(previous, entry);
		statements.push(
			database
				.prepare('INSERT OR IGNORE INTO event_seals (sequence, hash, sealed_at) VALUES (?, ?, ?)')
				.bind(entry.sequence, previous, time)
		);
	}
	await database.batch(statements);
	return statements.length;
}

export type SealCheck =
	| { intact: true; checked: number; unsealed: number; latestSeal: string | null; latestSequence: number }
	| {
			intact: false;
			checked: number;
			/** The first entry whose seal does not match, or that is missing. */
			brokenAt: number;
			problem: 'changed' | 'missing-entry' | 'missing-seal';
	  };

/** A point in the chain already checked: an entry and its seal. */
interface ChainPoint {
	sequence: number;
	hash: string;
}

const startOfChain: ChainPoint = { sequence: 0, hash: chainStart };

/**
 * Recomputes the whole chain and compares it with the stored seals. Reads in
 * pages, so a long log does not need to fit in memory at once.
 */
export function checkSeals(database: D1Database, pageSize = 1000): Promise<SealCheck> {
	return checkSealsFrom(database, startOfChain, pageSize);
}

/**
 * Checks the chain after `start`, an entry whose seal is already known to be right. Every sealed entry up to `start` counts as checked, so the result is the one checking the whole chain would give when nothing up to `start` has changed.
 */
async function checkSealsFrom(database: D1Database, start: ChainPoint, pageSize: number): Promise<SealCheck> {
	let previous = start.hash;
	let expectedSequence = start.sequence;
	let checked = start.sequence;
	let latestSeal: string | null = start.sequence > 0 ? start.hash : null;
	for (;;) {
		const page = await database
			.prepare(
				`SELECT event_seals.sequence AS sealSequence, event_seals.hash, events.sequence,
				        events.identifier, events.person_identifier AS personIdentifier, events.action,
				        events.target_kind AS targetKind, events.target_identifier AS targetIdentifier,
				        events.note, events.created_at AS createdAt
				 FROM event_seals LEFT JOIN events ON events.sequence = event_seals.sequence
				 WHERE event_seals.sequence > ? ORDER BY event_seals.sequence LIMIT ?`
			)
			.bind(expectedSequence, pageSize)
			.all<EventForSeal & { sealSequence: number; hash: string }>();
		if (page.results.length === 0) break;
		for (const row of page.results) {
			// Sequences come from AUTOINCREMENT and nothing can be deleted, so
			// any gap means an entry or its seal was removed.
			if (row.sealSequence !== expectedSequence + 1) {
				return { intact: false, checked, brokenAt: expectedSequence + 1, problem: 'missing-seal' };
			}
			if (row.sequence === null || row.sequence === undefined) {
				return { intact: false, checked, brokenAt: row.sealSequence, problem: 'missing-entry' };
			}
			previous = await sealOf(previous, row);
			if (previous !== row.hash) {
				return { intact: false, checked, brokenAt: row.sealSequence, problem: 'changed' };
			}
			expectedSequence = row.sealSequence;
			latestSeal = row.hash;
			checked += 1;
		}
	}
	const unsealed = await database
		.prepare('SELECT COUNT(*) AS count, MIN(sequence) AS first FROM events WHERE sequence > ?')
		.bind(expectedSequence)
		.first<{ count: number; first: number | null }>();
	if (unsealed && unsealed.first !== null && unsealed.first !== expectedSequence + 1) {
		return { intact: false, checked, brokenAt: expectedSequence + 1, problem: 'missing-entry' };
	}
	return {
		intact: true,
		checked,
		unsealed: unsealed?.count ?? 0,
		latestSeal,
		latestSequence: expectedSequence
	};
}

interface CheckpointRow {
	sequence: number;
	hash: string;
	brokenAt: number | null;
	problem: Extract<SealCheck, { intact: false }>['problem'] | null;
}

/**
 * Checks the whole chain from the start, as `checkSeals` does, and records the result as the checkpoint pages start from: how far the chain is intact, or the problem found. The hourly scheduled run (/activity-log/scheduled) and the Activity page call this, so a change to an entry before the checkpoint is found within the hour and then shown wherever the seals are shown.
 */
export async function checkSealsAndRecord(database: D1Database, pageSize = 1000): Promise<SealCheck> {
	const check = await checkSeals(database, pageSize);
	const time = now();
	const point = check.intact
		? { sequence: check.latestSequence, hash: check.latestSeal ?? chainStart }
		: await checkedPointBefore(database, check);
	await database
		.prepare(
			`INSERT INTO event_seal_checkpoint (identifier, sequence, hash, broken_at, problem, checked_at, whole_chain_checked_at)
			 VALUES (1, ?1, ?2, ?3, ?4, ?5, ?5)
			 ON CONFLICT (identifier) DO UPDATE SET sequence = excluded.sequence, hash = excluded.hash,
			   broken_at = excluded.broken_at, problem = excluded.problem, checked_at = excluded.checked_at,
			   whole_chain_checked_at = excluded.whole_chain_checked_at`
		)
		.bind(point.sequence, point.hash, check.intact ? null : check.brokenAt, check.intact ? null : check.problem, time)
		.run();
	return check;
}

/** The last intact point before a broken entry: the stored seal of the entry before it. */
async function checkedPointBefore(
	database: D1Database,
	check: Extract<SealCheck, { intact: false }>
): Promise<ChainPoint> {
	if (check.checked === 0) return startOfChain;
	const row = await database
		.prepare('SELECT hash FROM event_seals WHERE sequence = ?')
		.bind(check.checked)
		.first<{ hash: string }>();
	return { sequence: check.checked, hash: row?.hash ?? chainStart };
}

/**
 * The seal check for pages that show it on every load (the workspace Overview and the Access page). It checks only the entries after the checkpoint the last check recorded, and moves the checkpoint forward.
 *
 * When the last check of the whole chain found a problem, it returns that problem. When anything looks wrong from the checkpoint on, or the checkpoint's own seal no longer matches, it checks the whole chain instead. So the result is always the one `checkSeals` would give, except that a change to an entry at or before the checkpoint shows once the next hourly check of the whole chain finds it.
 */
export async function checkSealsSinceCheckpoint(database: D1Database, pageSize = 1000): Promise<SealCheck> {
	const checkpoint = await database
		.prepare(
			`SELECT event_seal_checkpoint.sequence, event_seal_checkpoint.hash, event_seal_checkpoint.broken_at AS brokenAt,
			        event_seal_checkpoint.problem, event_seals.hash AS storedHash
			 FROM event_seal_checkpoint LEFT JOIN event_seals ON event_seals.sequence = event_seal_checkpoint.sequence
			 WHERE event_seal_checkpoint.identifier = 1`
		)
		.first<CheckpointRow & { storedHash: string | null }>();
	if (checkpoint && checkpoint.brokenAt !== null && checkpoint.problem !== null) {
		return { intact: false, checked: checkpoint.brokenAt - 1, brokenAt: checkpoint.brokenAt, problem: checkpoint.problem };
	}
	const start = checkpoint ?? startOfChain;
	const startStillSealed = start.sequence === 0 || checkpoint?.storedHash === start.hash;
	if (!startStillSealed) return checkSealsAndRecord(database, pageSize);
	const check = await checkSealsFrom(database, start, pageSize);
	if (!check.intact) return checkSealsAndRecord(database, pageSize);
	if (check.latestSequence > start.sequence) {
		// Only moves forward, and never over a problem the whole-chain check recorded in the meantime.
		await database
			.prepare(
				`INSERT INTO event_seal_checkpoint (identifier, sequence, hash, checked_at) VALUES (1, ?1, ?2, ?3)
				 ON CONFLICT (identifier) DO UPDATE SET sequence = excluded.sequence, hash = excluded.hash, checked_at = excluded.checked_at
				 WHERE event_seal_checkpoint.broken_at IS NULL AND event_seal_checkpoint.sequence < excluded.sequence`
			)
			.bind(check.latestSequence, check.latestSeal ?? chainStart, now())
			.run();
	}
	return check;
}
