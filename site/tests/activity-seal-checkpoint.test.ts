import { beforeEach, describe, expect, it } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import {
	checkSeals,
	checkSealsAndRecord,
	checkSealsSinceCheckpoint,
	sealNewEntries
} from '#lib/server/activity-seals.ts';
import { administrationSummary } from '#lib/server/administration.ts';
import { eventStatement } from '#lib/server/events.ts';
import { testDatabase } from './database.ts';

let database: D1Database;

async function addEntries(count: number): Promise<void> {
	for (let index = 0; index < count; index += 1) {
		await eventStatement(database, {
			personIdentifier: null,
			action: `Entry ${index}`,
			targetKind: 'request',
			targetIdentifier: `request-${index}`
		}).run();
	}
	await sealNewEntries(database);
}

async function checkpoint() {
	return database
		.prepare('SELECT sequence, hash, broken_at AS brokenAt, problem FROM event_seal_checkpoint')
		.first<{ sequence: number; hash: string; brokenAt: number | null; problem: string | null }>();
}

/** Someone with direct access to the database removes the rule and rewrites an entry. */
async function rewriteEntry(sequence: number): Promise<void> {
	await database.prepare('DROP TRIGGER IF EXISTS events_cannot_change').run();
	await database.prepare("UPDATE events SET action = 'Something else' WHERE sequence = ?").bind(sequence).run();
}

beforeEach(() => {
	database = testDatabase();
});

describe('the seal checkpoint', () => {
	it('gives the same result as checking the whole chain, and moves forward', async () => {
		await addEntries(5);
		expect(await checkpoint()).toBeNull();
		const first = await checkSealsSinceCheckpoint(database);
		expect(first).toEqual(await checkSeals(database));
		expect(first).toMatchObject({ intact: true, checked: 5, latestSequence: 5 });
		expect(await checkpoint()).toMatchObject({ sequence: 5, brokenAt: null, problem: null });

		await addEntries(3);
		const second = await checkSealsSinceCheckpoint(database, 2);
		expect(second).toEqual(await checkSeals(database));
		expect(second).toMatchObject({ intact: true, checked: 8, latestSequence: 8 });
		expect(await checkpoint()).toMatchObject({ sequence: 8 });
	});

	it('counts entries not sealed yet the same way', async () => {
		await addEntries(4);
		await checkSealsSinceCheckpoint(database);
		await eventStatement(database, { personIdentifier: null, action: 'Late', targetKind: 'request', targetIdentifier: 'late' }).run();
		const check = await checkSealsSinceCheckpoint(database);
		expect(check).toEqual(await checkSeals(database));
		expect(check).toMatchObject({ intact: true, unsealed: 1 });
	});

	it('checks only entries after the checkpoint on page loads', async () => {
		await addEntries(6);
		await checkSealsSinceCheckpoint(database);
		// An entry before the checkpoint changes: page loads do not recompute it.
		await rewriteEntry(2);
		expect(await checkSealsSinceCheckpoint(database)).toMatchObject({ intact: true, checked: 6 });
	});

	it('finds a change before the checkpoint in the hourly whole-chain check, and pages then show it', async () => {
		await addEntries(6);
		await checkSealsSinceCheckpoint(database);
		await rewriteEntry(2);

		const whole = await checkSealsAndRecord(database);
		expect(whole).toEqual({ intact: false, checked: 1, brokenAt: 2, problem: 'changed' });
		expect(await checkpoint()).toMatchObject({ sequence: 1, brokenAt: 2, problem: 'changed' });

		// Pages show the problem the whole-chain check found, even after newer entries.
		await addEntries(2);
		expect(await checkSealsSinceCheckpoint(database)).toEqual(whole);
		expect((await administrationSummary(database)).seals).toEqual(whole);
		// A later page load does not clear it.
		expect(await checkpoint()).toMatchObject({ brokenAt: 2, problem: 'changed' });
	});

	it('finds the problem itself when an entry after the checkpoint changed', async () => {
		await addEntries(3);
		await checkSealsSinceCheckpoint(database);
		await addEntries(3);
		await rewriteEntry(5);
		const check = await checkSealsSinceCheckpoint(database);
		expect(check).toEqual(await checkSeals(database));
		expect(check).toEqual({ intact: false, checked: 4, brokenAt: 5, problem: 'changed' });
		expect(await checkpoint()).toMatchObject({ brokenAt: 5, problem: 'changed' });
	});

	it('reports the earliest problem when entries both before and after the checkpoint changed', async () => {
		await addEntries(3);
		await checkSealsSinceCheckpoint(database);
		await addEntries(3);
		await rewriteEntry(2);
		await rewriteEntry(5);
		// The problem after the checkpoint sends the page to the whole chain, which finds entry 2 first.
		expect(await checkSealsSinceCheckpoint(database)).toEqual({ intact: false, checked: 1, brokenAt: 2, problem: 'changed' });
	});

	it('checks the whole chain when the checkpoint’s own seal is gone', async () => {
		await addEntries(4);
		await checkSealsSinceCheckpoint(database);
		await database.prepare('DROP TRIGGER event_seals_cannot_be_deleted').run();
		await database.prepare('DROP TRIGGER events_cannot_be_deleted').run();
		await database.prepare('DELETE FROM event_seals WHERE sequence = 4').run();
		await database.prepare('DELETE FROM events WHERE sequence = 4').run();
		const check = await checkSealsSinceCheckpoint(database);
		expect(check).toEqual(await checkSeals(database));
		expect(check.intact).toBe(true);
		expect(check).toMatchObject({ checked: 3, latestSequence: 3 });
	});

	it('clears a recorded problem once the whole chain checks out again', async () => {
		await addEntries(3);
		await rewriteEntry(2);
		await checkSealsAndRecord(database);
		await database.prepare("UPDATE events SET action = 'Entry 1' WHERE sequence = 2").run();
		expect(await checkSealsAndRecord(database)).toMatchObject({ intact: true, checked: 3 });
		expect(await checkpoint()).toMatchObject({ sequence: 3, brokenAt: null, problem: null });
		expect(await checkSealsSinceCheckpoint(database)).toEqual(await checkSeals(database));
	});

	it('runs in the hourly scheduled run', async () => {
		const { scheduledPaths } = await import('../tools/add-scheduled-run.mjs');
		expect(scheduledPaths['17 * * * *']).toContain('/activity-log/scheduled');
	});
});
