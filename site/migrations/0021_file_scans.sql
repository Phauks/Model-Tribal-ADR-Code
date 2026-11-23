-- Virus and malware scans of files in the private bucket (site/SCANNING.md,
-- decision record 0046).
--
-- A file someone sends, or an email attachment, is held until it is scanned
-- clean: the code that stores it adds a row here (src/lib/server/file-scans.ts,
-- requestScan), and the code that serves it asks this table first. The
-- scanner Worker, model-tribal-adr-code-scanner (scanner/wrangler.jsonc),
-- finds rows that are waiting, scans the object in the bucket and writes the
-- result back. Nothing else in the site talks to the scanner.
--
-- Apply with: npx wrangler d1 migrations apply database --remote

CREATE TABLE file_scans (
	-- The object's key in the sourceDocuments bucket, such as
	-- uploads/<identifier>/original or mail/<message>/attachments/<id>.
	object_key TEXT PRIMARY KEY,
	-- What the file is, so each part of the site can find its own:
	-- 'upload' (docs/uploads.md) or 'mail-attachment' (the project inbox).
	purpose TEXT NOT NULL CHECK (length(purpose) BETWEEN 1 AND 40),
	-- The caller's own name for it, such as an upload reference or an
	-- attachment identifier.
	subject TEXT,
	status TEXT NOT NULL CHECK (
		status IN (
			-- Held, in line for the scanner.
			'waiting',
			-- The scanner has it now.
			'scanning',
			-- The scanner could not finish; tried again at next_try_at.
			'retrying',
			-- Scanned and nothing found. The only status (with
			-- 'released-by-hand') a file can be served in.
			'clean',
			-- Something was found; reason names it. Held for good: never served.
			'flagged',
			-- It cannot be scanned (locked with a password, or larger than the
			-- scanner takes); reason says which. Held until a reviewer releases it.
			'cannot-scan',
			-- Tried too many times without an answer. Held; scan again or release.
			'failed',
			-- A reviewer chose to release a file that could not be scanned.
			'released-by-hand'
		)
	),
	-- A signature or rule name for 'flagged'; 'encrypted', 'too-large',
	-- 'missing' or 'no-engine' for files that were not scanned; the last
	-- fault for 'retrying' and 'failed'.
	reason TEXT,
	-- 1: clean, but it holds scripts or macros (a PDF script, Office macros).
	active_content INTEGER NOT NULL DEFAULT 0 CHECK (active_content IN (0, 1)),
	-- The bucket object's etag when it was scanned. A result counts only for
	-- these exact bytes: if the object is replaced, it is held again.
	object_etag TEXT,
	size_bytes INTEGER CHECK (size_bytes IS NULL OR size_bytes >= 0),
	-- Which provider looked ('container', 'http', 'off') and which engine,
	-- rules and signatures it ran, such as
	-- engine/1+yara-rules/none+clamav-db/27840.
	provider TEXT,
	engine_version TEXT,
	attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
	requested_at TEXT NOT NULL,
	started_at TEXT,
	finished_at TEXT,
	next_try_at TEXT,
	-- Who released a file by hand, when and why.
	released_by TEXT REFERENCES people (identifier),
	released_at TEXT,
	release_note TEXT
);

-- The scanner's to-do list.
CREATE INDEX file_scans_to_do ON file_scans (status, next_try_at, requested_at);
-- Each part of the site's own files.
CREATE INDEX file_scans_by_subject ON file_scans (purpose, subject);
