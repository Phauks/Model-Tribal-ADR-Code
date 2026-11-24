-- Adds a checkpoint recording how far the activity log's seal chain has been checked.
-- The workspace Overview and the Access page used to recompute the seal of every activity-log entry on each load. They now check only the entries after this checkpoint, and the hourly scheduled run (/activity-log/scheduled) checks the whole chain from the start and records its result here, including the first broken entry when it finds one (src/lib/server/activity-seals.ts; site/COLLABORATION.md, "Activity log"). The table holds a single row.
CREATE TABLE event_seal_checkpoint (
	-- Always 1, so the table can hold only one row.
	identifier INTEGER PRIMARY KEY CHECK (identifier = 1),
	-- The last entry the chain was checked up to, and its seal. Entry 0 with the chain's starting value means nothing has been checked yet.
	sequence INTEGER NOT NULL,
	hash TEXT NOT NULL,
	-- What the last check of the whole chain found wrong: the first entry that failed and why. Both are NULL while the chain is intact.
	broken_at INTEGER,
	problem TEXT CHECK (problem IN ('changed', 'missing-entry', 'missing-seal')),
	-- When the checkpoint last changed, and when the whole chain was last checked.
	checked_at TEXT NOT NULL,
	whole_chain_checked_at TEXT
);
