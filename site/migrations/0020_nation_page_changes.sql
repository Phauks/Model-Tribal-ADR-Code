-- Changes a nation's team makes to its own page (decision record 0041,
-- "Stage 2"; site/COLLABORATION.md, "Nation teams"). Rows are never edited
-- in place except to move a draft or a waiting change along: each publish
-- adds a row, and the page shows, for each kind, the newest published row
-- whose live_at has come. So every earlier version stays, for restoring and
-- for the project's review, and none of it is published as page history.
-- Every change is also written to the activity log (events), under the
-- target 'document' with the identifier 'nation-page/<nation identifier>'.
CREATE TABLE nation_page_changes (
	identifier TEXT PRIMARY KEY,
	nation_identifier TEXT NOT NULL,
	kind TEXT NOT NULL CHECK (kind IN ('about', 'courts', 'statements', 'contacts', 'pictures', 'hidden')),
	-- JSON, as src/lib/nation-page-changes.ts reads it.
	content TEXT NOT NULL,
	-- Who the page credits, such as "Navajo Nation Judicial Branch". A
	-- person's own name is shown only if they typed it here.
	credit TEXT NOT NULL,
	-- 'draft' (written, not published), 'published' (live from live_at) or
	-- 'discarded' (a draft thrown away, or a waiting change cancelled).
	status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'discarded')),
	written_by TEXT NOT NULL REFERENCES people (identifier),
	written_at TEXT NOT NULL,
	published_by TEXT REFERENCES people (identifier),
	published_at TEXT,
	-- When a published change goes live. Contacts wait three days unless a
	-- second editor approves them; everything else is live when published.
	live_at TEXT,
	approved_by TEXT REFERENCES people (identifier),
	approved_at TEXT,
	-- The earlier version this one copies, when it was restored.
	restored_from TEXT REFERENCES nation_page_changes (identifier),
	discarded_by TEXT REFERENCES people (identifier),
	discarded_at TEXT
);

CREATE INDEX nation_page_changes_by_nation ON nation_page_changes (nation_identifier, kind, status, live_at);
CREATE INDEX nation_page_changes_live ON nation_page_changes (status, live_at);

-- A nation's team's answer to a problem report about its claimed page
-- (Trevor, Nov. 23, 2026: reports go to the nation's team as well as the
-- project). The project still sees every report and steps in when the team
-- has not answered within 7 days. The team never sees who sent a report.
CREATE TABLE nation_team_report_answers (
	request_identifier TEXT PRIMARY KEY REFERENCES requests (identifier),
	nation_identifier TEXT NOT NULL,
	-- 'fixed' (changed on the page) or 'no-change' (the team says the page is right).
	outcome TEXT NOT NULL CHECK (outcome IN ('fixed', 'no-change')),
	note TEXT,
	answered_by TEXT NOT NULL REFERENCES people (identifier),
	answered_at TEXT NOT NULL
);
