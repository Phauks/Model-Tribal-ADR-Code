-- Lets a reader who writes about a claimed nation page share their name and contact details with the nation's team, so the team can write back (Trevor, Nov. 23, 2026: "If you claim a page, you have to be willing to take the input").
-- Design: decision record 0041 ("Claimed pages and problem reports") and site/DESIGN.md, nation pages item 2. Until now the team saw what was written, never who sent it; that stays the default for a report unless the reader ticks the box.
ALTER TABLE requests ADD COLUMN shared_with_team INTEGER NOT NULL DEFAULT 0 CHECK (shared_with_team IN (0, 1));

-- The team can now answer "Wrote back to the sender" as well as "Fixed on the page" and "No change needed". SQLite cannot change a CHECK, so the table is copied.
CREATE TABLE nation_team_report_answers_new (
	request_identifier TEXT PRIMARY KEY REFERENCES requests (identifier),
	nation_identifier TEXT NOT NULL,
	-- 'fixed' (changed on the page), 'no-change' (the team says the page is right) or 'wrote-back' (the team answered the sender).
	outcome TEXT NOT NULL CHECK (outcome IN ('fixed', 'no-change', 'wrote-back')),
	note TEXT,
	answered_by TEXT NOT NULL REFERENCES people (identifier),
	answered_at TEXT NOT NULL
);
INSERT INTO nation_team_report_answers_new (request_identifier, nation_identifier, outcome, note, answered_by, answered_at)
	SELECT request_identifier, nation_identifier, outcome, note, answered_by, answered_at FROM nation_team_report_answers;
DROP TABLE nation_team_report_answers;
ALTER TABLE nation_team_report_answers_new RENAME TO nation_team_report_answers;
