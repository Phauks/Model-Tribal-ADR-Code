-- Adds the source watch's tables: what its watchers found, where each left off,
-- each run, what each watched page last looked like, and what the models cost.
-- Design: docs/source-watch.md and decision record 0059. The watch Worker
-- (site/watch) writes them; the workspace's Source watch page reads them.
-- Nothing here is published: a person accepts each item, and an accepted item
-- becomes a record draft that lands through a pull request, Unverified.

-- One possible new or changed item. A watcher and the source's own identifier
-- (a Federal Register document number, an address) are unique together, so
-- finding the same item twice does nothing.
CREATE TABLE watch_candidates (
	identifier INTEGER PRIMARY KEY,
	watcher TEXT NOT NULL,
	source_identifier TEXT NOT NULL,
	kind TEXT NOT NULL,
	title TEXT NOT NULL,
	-- As the source gives it, YYYY-MM-DD.
	published_on TEXT,
	link TEXT,
	-- JSON array of collection identifiers and "nation:<field>" parts it may join.
	feeds TEXT NOT NULL DEFAULT '[]',
	-- JSON array of nation profile identifiers the name matcher found.
	nations TEXT NOT NULL DEFAULT '[]',
	-- JSON object of the facts the rules read (agency, document type, C.F.R. parts).
	facts TEXT NOT NULL DEFAULT '{}',
	summary TEXT,
	-- The private copy in the bucket (watch/captures/...), held until its scan passes.
	capture_key TEXT,
	capture_sha256 TEXT,
	-- For a changed page or file: the earlier copy and a short difference.
	previous_capture_key TEXT,
	difference TEXT,
	-- What the dedupe step found: none, same, new-version, possible-duplicate.
	match_kind TEXT NOT NULL DEFAULT 'none',
	-- The record it matched: a source key or a document history identifier.
	match_record TEXT,
	-- The proposed action: add, new-version, same-as, note.
	proposed TEXT,
	-- 0 to 1, from the rules and then the model.
	relevance REAL,
	-- JSON array of {step, rule or model, answer, reason, at}: the rules' answer, then any model's.
	triage TEXT NOT NULL DEFAULT '[]',
	-- JSON array of sensitivity flags: child-or-family-case, protection-order,
	-- nation-restriction, rights-not-settled, tribal-court-opinion.
	sensitivity TEXT NOT NULL DEFAULT '[]',
	-- The host's robots.txt or content signals bar models from its text.
	no_model_text INTEGER NOT NULL DEFAULT 0,
	hosting TEXT NOT NULL,
	tier TEXT NOT NULL,
	-- waiting-for-model, to-review, held, closed-by-rules, added, new-version,
	-- same-as, not-relevant.
	status TEXT NOT NULL,
	decided_by TEXT REFERENCES people (identifier),
	decided_at TEXT,
	decision_note TEXT,
	found_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	UNIQUE (watcher, source_identifier)
);
CREATE INDEX watch_candidates_by_status ON watch_candidates (status, found_at);
CREATE INDEX watch_candidates_by_match ON watch_candidates (match_record);

-- Where each watcher left off: its own cursor text (a date, an update time).
CREATE TABLE watch_cursors (
	watcher TEXT PRIMARY KEY,
	cursor TEXT,
	updated_at TEXT NOT NULL
);

-- Each run of a watcher.
CREATE TABLE watch_runs (
	identifier TEXT PRIMARY KEY,
	watcher TEXT NOT NULL,
	started_at TEXT NOT NULL,
	finished_at TEXT,
	-- running, finished, come-back-later, failed.
	outcome TEXT NOT NULL,
	found INTEGER NOT NULL DEFAULT 0,
	new_items INTEGER NOT NULL DEFAULT 0,
	closed_by_rules INTEGER NOT NULL DEFAULT 0,
	to_review INTEGER NOT NULL DEFAULT 0,
	problem TEXT
);
CREATE INDEX watch_runs_by_watcher ON watch_runs (watcher, started_at);

-- What each page or file a watcher re-checks looked like last time, so it can
-- ask with If-None-Match and If-Modified-Since and compare a hash of its text.
CREATE TABLE watch_pages (
	watcher TEXT NOT NULL,
	address TEXT NOT NULL,
	entity_tag TEXT,
	last_modified TEXT,
	sha256 TEXT,
	capture_key TEXT,
	status INTEGER,
	checked_at TEXT NOT NULL,
	PRIMARY KEY (watcher, address)
);

-- What the models cost, by day and model, for the progress page.
CREATE TABLE watch_model_spend (
	day TEXT NOT NULL,
	model TEXT NOT NULL,
	calls INTEGER NOT NULL DEFAULT 0,
	input_tokens INTEGER NOT NULL DEFAULT 0,
	output_tokens INTEGER NOT NULL DEFAULT 0,
	cache_read_tokens INTEGER NOT NULL DEFAULT 0,
	cache_write_tokens INTEGER NOT NULL DEFAULT 0,
	-- In millionths of a dollar, at the list prices in src/lib/server/watch/model-prices.ts.
	cost_microdollars INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY (day, model)
);
