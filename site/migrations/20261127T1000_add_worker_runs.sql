-- Adds the worker_runs table, which records when each Worker's scheduled runs and alarms last ran and last failed.
-- Design: site/ERRORS.md ("Worker runs") and src/lib/server/reported.ts. The
-- live, scanner, Wayback and source watch Workers wrap their fetch, scheduled
-- and Durable Object alarm handlers in reported(), which reports what is thrown
-- (the problems table) and writes one row here per Worker and handler at the
-- end of each scheduled run or alarm, so the Service checks page can say when
-- each last ran and last failed. A fetch handler records only its failures.
-- The table holds no personal details: failure messages are stripped of
-- addresses, emails and anything that looks like a key before they are written.

CREATE TABLE worker_runs (
	-- The Worker's short name: live, scanner, wayback or radar.
	worker TEXT NOT NULL,
	-- What ran, such as scheduled, scheduled:rebuild, alarm:ScanDesk or fetch.
	handler TEXT NOT NULL,
	-- When the last run started and how long it took.
	last_started TEXT NOT NULL,
	last_milliseconds INTEGER,
	last_outcome TEXT NOT NULL CHECK (last_outcome IN ('finished', 'failed')),
	runs INTEGER NOT NULL DEFAULT 0,
	failures INTEGER NOT NULL DEFAULT 0,
	-- The last failure, kept after later runs finish. The reference finds the whole report in Workers Logs.
	last_failed TEXT,
	last_failure_code TEXT,
	last_failure_reference TEXT,
	last_failure_message TEXT,
	PRIMARY KEY (worker, handler)
);
