-- The nonprofit corporation's record and its to-do list (COLLABORATION.md,
-- "Nonprofit"). The lead author keeps the facts (filing dates, numbers,
-- directors) here, and the site works out what is due from them: the Nevada
-- annual list, Form 990-N, the Form 1023-EZ deadline and the board's yearly
-- conflict-of-interest statements (src/lib/nonprofit.ts). Only the lead author
-- sees or changes any of it.
--
-- Apply with: npx wrangler d1 migrations apply database --remote

-- One row per fact, such as the date of incorporation or the Nevada business
-- number. A missing row means the fact is not known yet.
CREATE TABLE nonprofit_facts (
	name TEXT PRIMARY KEY CHECK (length(name) BETWEEN 1 AND 60),
	value TEXT NOT NULL CHECK (length(value) BETWEEN 1 AND 4000),
	changed_by TEXT REFERENCES people (identifier),
	changed_at TEXT NOT NULL
);

-- A filing or step done: one row for each obligation and period, such as the
-- Nevada annual list due 2027-12-31, or a one-time setup step (period 'once').
CREATE TABLE nonprofit_completions (
	identifier TEXT PRIMARY KEY,
	obligation TEXT NOT NULL CHECK (length(obligation) BETWEEN 1 AND 80),
	period TEXT NOT NULL CHECK (length(period) BETWEEN 1 AND 40),
	done_on TEXT NOT NULL,
	-- A confirmation or filing number from the agency, if any.
	reference TEXT CHECK (reference IS NULL OR length(reference) <= 200),
	note TEXT CHECK (note IS NULL OR length(note) <= 2000),
	recorded_by TEXT REFERENCES people (identifier),
	recorded_at TEXT NOT NULL,
	UNIQUE (obligation, period)
);

-- The lead author's own to-dos, with or without a due date. One that repeats
-- every year moves its due date on by a year each time it is marked done,
-- and the completion is kept in nonprofit_completions as 'task:<identifier>'.
CREATE TABLE nonprofit_tasks (
	identifier TEXT PRIMARY KEY,
	title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 300),
	notes TEXT CHECK (notes IS NULL OR length(notes) <= 4000),
	due_on TEXT,
	repeats_yearly INTEGER NOT NULL DEFAULT 0 CHECK (repeats_yearly IN (0, 1)),
	done_on TEXT,
	created_by TEXT REFERENCES people (identifier),
	created_at TEXT NOT NULL
);

CREATE INDEX nonprofit_tasks_by_due ON nonprofit_tasks (done_on, due_on);
