/**
 * The lead author's overview of who can do what (the Access page and the
 * workspace Overview): people by role and status, current grants, grants
 * about to expire, refused attempts, and whether the activity log is intact.
 */
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import type { Role } from '#lib/permissions.ts';
import { checkSeals, sealNewEntries, type SealCheck } from './activity-seals.ts';
import { refusedAction } from './events.ts';

export interface AdministrationSummary {
	people: { role: Role; status: 'invited' | 'active' | 'removed'; count: number }[];
	grants: number;
	grantsExpiringSoon: number;
	refusedLastThirtyDays: number;
	lastRefused: { createdAt: string; personName: string | null; note: string | null } | null;
	seals: SealCheck;
}

const day = 24 * 60 * 60 * 1000;

export async function administrationSummary(
	database: D1Database,
	time: Date = new Date()
): Promise<AdministrationSummary> {
	// Seal anything recorded since the last request, so the check covers it.
	await sealNewEntries(database);
	const soon = new Date(time.getTime() + 14 * day).toISOString();
	const monthAgo = new Date(time.getTime() - 30 * day).toISOString();
	const [people, grants, refused, lastRefused, seals] = await Promise.all([
		database
			.prepare('SELECT role, status, COUNT(*) AS count FROM people GROUP BY role, status ORDER BY role, status')
			.all<AdministrationSummary['people'][number]>(),
		database
			.prepare(
				`SELECT COUNT(*) AS count,
				        SUM(CASE WHEN expires_at IS NOT NULL AND expires_at > ?1 AND expires_at <= ?2 THEN 1 ELSE 0 END) AS expiring
				 FROM access_grants WHERE ended_at IS NULL AND (expires_at IS NULL OR expires_at > ?1)`
			)
			.bind(time.toISOString(), soon)
			.first<{ count: number; expiring: number | null }>(),
		database
			.prepare('SELECT COUNT(*) AS count FROM events WHERE action = ? AND created_at >= ?')
			.bind(refusedAction, monthAgo)
			.first<{ count: number }>(),
		database
			.prepare(
				`SELECT events.created_at AS createdAt, people.display_name AS personName, events.note
				 FROM events LEFT JOIN people ON people.identifier = events.person_identifier
				 WHERE events.action = ? ORDER BY events.sequence DESC LIMIT 1`
			)
			.bind(refusedAction)
			.first<AdministrationSummary['lastRefused']>(),
		checkSeals(database)
	]);
	return {
		people: people.results,
		grants: grants?.count ?? 0,
		grantsExpiringSoon: grants?.expiring ?? 0,
		refusedLastThirtyDays: refused?.count ?? 0,
		lastRefused: lastRefused ?? null,
		seals
	};
}
