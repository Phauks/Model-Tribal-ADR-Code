-- Adds the problems table, which counts each kind of problem the site and its Workers report.
-- Design: site/ERRORS.md and src/lib/server/report.ts. Each report is also one
-- line in Cloudflare's Workers Logs; this table keeps one row per code, source
-- and place, so the Service checks page can list what has gone wrong lately
-- without reading the logs. It holds no personal details: messages are
-- stripped of addresses, emails and anything that looks like a key before
-- they are written, and paths are kept without their queries.

CREATE TABLE problems (
	-- A short code such as search.fill or map.style (src/lib/problems.ts).
	code TEXT NOT NULL,
	-- site, browser, or another Worker's short name, such as wayback.
	source TEXT NOT NULL,
	-- What was running: a route such as /nations/[id] or a handler such as scheduled.
	place TEXT NOT NULL,
	first_seen TEXT NOT NULL,
	last_seen TEXT NOT NULL,
	count INTEGER NOT NULL DEFAULT 1,
	-- The reference a reader was shown, such as P-4F7K-92QD, and the log line carries.
	last_reference TEXT NOT NULL,
	last_message TEXT NOT NULL,
	last_path TEXT,
	PRIMARY KEY (code, source, place)
);

CREATE INDEX problems_by_last_seen ON problems (last_seen);
