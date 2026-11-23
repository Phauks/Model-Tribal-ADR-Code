-- The project's review of what nations publish on their own pages (decision
-- record 0041, "Stage 3"; site/COLLABORATION.md, "The project's review").
-- Nations' changes go live without waiting for the project. The project reads
-- each one afterwards, within seven days, and can undo it, pause the nation's
-- publishing to ask a question, or suspend the person who published it.

-- One row for each published change the project has looked at.
CREATE TABLE nation_page_reviews (
	change_identifier TEXT PRIMARY KEY REFERENCES nation_page_changes (identifier),
	nation_identifier TEXT NOT NULL,
	-- 'read': looked at and left as it is; 'undone': taken off the page by the project.
	outcome TEXT NOT NULL CHECK (outcome IN ('read', 'undone')),
	note TEXT,
	reviewed_by TEXT NOT NULL REFERENCES people (identifier),
	reviewed_at TEXT NOT NULL
);

CREATE INDEX nation_page_reviews_by_time ON nation_page_reviews (reviewed_at);

-- While a nation's publishing is paused, its team can still save drafts and
-- hide parts of the page, but nothing new goes live until the project resumes it.
CREATE TABLE nation_page_pauses (
	identifier TEXT PRIMARY KEY,
	nation_identifier TEXT NOT NULL,
	-- What the project asks the nation's team, shown on the team's edit page.
	question TEXT NOT NULL,
	paused_by TEXT NOT NULL REFERENCES people (identifier),
	paused_at TEXT NOT NULL,
	-- The team's reply, if it has written one.
	answer TEXT,
	answered_by TEXT REFERENCES people (identifier),
	answered_at TEXT,
	resumed_by TEXT REFERENCES people (identifier),
	resumed_at TEXT
);

-- At most one pause in force for each nation.
CREATE UNIQUE INDEX nation_page_pauses_current ON nation_page_pauses (nation_identifier) WHERE resumed_at IS NULL;
