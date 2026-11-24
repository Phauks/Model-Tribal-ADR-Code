-- Adds the amount each sponsorship level costs a month, set by the lead author.
-- The levels and what each gives are in site/src/lib/sponsorship-levels.ts and
-- docs/sponsorship.md ("Levels"); a level with no row here uses its default
-- amount. A yearly gift costs ten months.
CREATE TABLE sponsorship_level_amounts (
	level TEXT PRIMARY KEY CHECK (level IN ('friend', 'supporter', 'patron', 'benefactor')),
	monthly_cents INTEGER NOT NULL CHECK (monthly_cents > 0),
	updated_at TEXT NOT NULL,
	-- "The project (name)", as the sponsor history names the lead author.
	updated_by TEXT NOT NULL
);
