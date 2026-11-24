/**
 * Each sponsorship level's amount a month (docs/sponsorship.md, "Levels"),
 * set by the lead author on the workspace Sponsors page. A level with no
 * saved amount uses its default (src/lib/sponsorship-levels.ts).
 */
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { defaultMonthlyCents, levels, type Level, type LevelAmounts } from '#lib/sponsorship-levels.ts';
import { now } from './identifiers.ts';

export async function levelAmounts(database: D1Database): Promise<LevelAmounts> {
	const { results } = await database
		.prepare('SELECT level, monthly_cents AS cents FROM sponsorship_level_amounts')
		.all<{ level: string; cents: number }>();
	const amounts: LevelAmounts = { ...defaultMonthlyCents };
	for (const row of results) {
		if ((levels as readonly string[]).includes(row.level)) amounts[row.level as Level] = row.cents;
	}
	return amounts;
}

/** Sets every level's amount at once, from the workspace form. */
export async function saveLevelAmounts(database: D1Database, amounts: LevelAmounts, by: string, at = now()): Promise<void> {
	await database.batch(
		levels.map((level) =>
			database
				.prepare(
					`INSERT INTO sponsorship_level_amounts (level, monthly_cents, updated_at, updated_by) VALUES (?, ?, ?, ?)
					 ON CONFLICT (level) DO UPDATE SET monthly_cents = excluded.monthly_cents, updated_at = excluded.updated_at, updated_by = excluded.updated_by`
				)
				.bind(level, amounts[level], at, by)
		)
	);
}
