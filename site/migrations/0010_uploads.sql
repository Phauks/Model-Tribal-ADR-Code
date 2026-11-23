-- Files people send for review (docs/uploads.md, decision record 0038).
--
-- Anyone signed in can send files on the Send files page; reviewers in the
-- workspace look at each one and file it, keep it for reference, or decline
-- it. The bytes of each file are in the private sourceDocuments bucket under
-- uploads/<identifier>/original, and a filed copy under filed/<reference>/.
-- A video can instead be a link to a YouTube video, with no file at all.
--
-- Apply with: npx wrangler d1 migrations apply database --remote
--
-- The activity log is rebuilt at the end to allow entries about uploads, so
-- foreign key checks wait until the end of the migration (Cloudflare, "Define
-- foreign keys: Defer foreign key constraints",
-- https://developers.cloudflare.com/d1/sql-api/foreign-keys/).
PRAGMA defer_foreign_keys = on;

CREATE TABLE uploads (
	identifier TEXT PRIMARY KEY,
	-- What the sender and reviewers quote, such as U-20261123-7KQ2MD.
	reference TEXT NOT NULL UNIQUE CHECK (reference GLOB 'U-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]-??????'),
	-- Files chosen together share a group and are described together.
	group_identifier TEXT NOT NULL,
	-- The sender. Empty once the sender deleted their account: what was filed
	-- or kept stays, and everything else of theirs is deleted
	-- (src/lib/server/uploads.ts, forgetAccountUploads).
	account_identifier TEXT REFERENCES accounts (identifier),
	-- 'essay-figure' files come from the essay editor and skip the queue:
	-- publishing the essay is the review.
	way_in TEXT NOT NULL CHECK (way_in IN ('send-files', 'essay-figure')),
	-- The essay a figure belongs to.
	essay_identifier TEXT REFERENCES essays (identifier),
	-- Found from the file's first bytes, so empty until the first piece arrives.
	kind TEXT CHECK (kind IN ('document', 'picture', 'sound', 'video')),
	source TEXT NOT NULL CHECK (source IN ('file', 'youtube')),
	status TEXT NOT NULL CHECK (
		status IN (
			'sending', 'checking', 'not-accepted', 'waiting-for-review', 'in-review', 'needs-answer',
			'waiting-for-nation', 'filed', 'kept-for-reference', 'not-used', 'withdrawn'
		)
	),

	-- The file. Empty for a YouTube link.
	file_name TEXT,
	-- Found from the file's first bytes, not from its name.
	media_type TEXT,
	size_bytes INTEGER CHECK (size_bytes IS NULL OR size_bytes > 0),
	-- SHA-256 of the file, or of its pieces' hashes for a file sent in more
	-- than one piece (src/lib/server/upload-checks.ts, fileFingerprint).
	fingerprint TEXT,
	original_key TEXT UNIQUE,
	-- A copy of a picture with location and other hidden details removed.
	preview_key TEXT UNIQUE,
	-- The bucket's multipart upload, while the file is still arriving.
	multipart_identifier TEXT,
	youtube_identifier TEXT CHECK (youtube_identifier IS NULL OR length(youtube_identifier) = 11),

	-- The sender's answers.
	title TEXT,
	description TEXT,
	origin TEXT CHECK (origin IN ('own-work', 'with-permission', 'published', 'government', 'not-sure')),
	-- Where it was published, or whose permission the sender has.
	origin_note TEXT,
	-- The permittedUses values of schemas/common.schema.json.
	permitted_use TEXT CHECK (permitted_use IN ('background-only', 'reference-only', 'quote', 'publish-in-full')),
	-- 1: the sender asked that the nation see it before anyone else.
	nation_first INTEGER NOT NULL DEFAULT 0 CHECK (nation_first IN (0, 1)),
	-- 1: the sender said they are under 18. Credited only by description or pseudonym.
	sender_under_eighteen INTEGER NOT NULL DEFAULT 0 CHECK (sender_under_eighteen IN (0, 1)),
	-- When the sender confirmed the answers; files are not reviewed before.
	described_at TEXT,

	-- The safety checks.
	check_result TEXT CHECK (check_result IN ('passed', 'careful-look', 'refused')),
	-- What the checks found, one finding per line.
	check_notes TEXT,

	-- The review.
	reviewer_identifier TEXT REFERENCES people (identifier),
	-- The reason given for 'not-used' or 'not-accepted'; the sender sees it.
	decision_reason TEXT,
	destination TEXT CHECK (
		destination IN ('nation-source', 'nation-picture', 'nation-video', 'story', 'essay-figure', 'research-library')
	),
	-- The nation, record or essay it was filed to, such as "nations/hopi-tribe".
	filed_page TEXT,
	caption TEXT,
	credit TEXT,
	alternative_text TEXT,
	-- The accessLevel values of schemas/common.schema.json.
	access_level TEXT CHECK (access_level IN ('public', 'nation-review-first', 'embargoed', 'restricted')),
	embargoed_until TEXT,
	-- The contribution filing it belongs to (docs/contributions.md).
	filing_identifier TEXT CHECK (
		filing_identifier IS NULL OR filing_identifier GLOB 'filing-[0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9]'
	),
	filed_key TEXT UNIQUE,

	received_at TEXT NOT NULL,
	finished_at TEXT,
	checked_at TEXT,
	decided_at TEXT,
	withdrawn_at TEXT,
	-- When the bytes were removed from the bucket. The row stays as a record.
	deleted_at TEXT,

	CHECK ((source = 'youtube') = (youtube_identifier IS NOT NULL)),
	CHECK (source = 'file' OR kind = 'video'),
	CHECK (kind IS NOT NULL OR status IN ('sending', 'not-accepted', 'withdrawn')),
	CHECK ((way_in = 'essay-figure') = (essay_identifier IS NOT NULL))
);

CREATE INDEX uploads_by_account ON uploads (account_identifier, received_at);
CREATE INDEX uploads_by_status ON uploads (status, received_at);
CREATE INDEX uploads_by_group ON uploads (group_identifier);
CREATE INDEX uploads_by_fingerprint ON uploads (fingerprint);

-- The pieces of a file that have arrived, so a stopped upload can pick up
-- where it left off. Pieces are numbered from 1, as the bucket numbers them.
CREATE TABLE upload_pieces (
	upload_identifier TEXT NOT NULL REFERENCES uploads (identifier) ON DELETE CASCADE,
	number INTEGER NOT NULL CHECK (number >= 1),
	size_bytes INTEGER NOT NULL,
	sha256 TEXT NOT NULL,
	-- The bucket's tag for the piece, needed to put the file together.
	entity_tag TEXT NOT NULL,
	-- What the checks found in this piece, one finding per line.
	findings TEXT,
	received_at TEXT NOT NULL,
	PRIMARY KEY (upload_identifier, number)
);

-- Nations and records an upload is about, named by the sender or a reviewer.
CREATE TABLE upload_links (
	upload_identifier TEXT NOT NULL REFERENCES uploads (identifier) ON DELETE CASCADE,
	target_kind TEXT NOT NULL CHECK (target_kind IN ('nation', 'record')),
	-- A nation's identifier, or a record's path such as "stories/coyote-and-the-flood".
	target_identifier TEXT NOT NULL,
	-- 'sender' or 'reviewer'.
	added_by TEXT NOT NULL CHECK (added_by IN ('sender', 'reviewer')),
	added_at TEXT NOT NULL,
	PRIMARY KEY (upload_identifier, target_kind, target_identifier)
);

-- Questions, answers and private notes about an upload.
CREATE TABLE upload_messages (
	identifier TEXT PRIMARY KEY,
	upload_identifier TEXT NOT NULL REFERENCES uploads (identifier) ON DELETE CASCADE,
	-- 'question' from a reviewer, 'answer' from the sender, 'note' between
	-- reviewers (the sender never sees notes).
	kind TEXT NOT NULL CHECK (kind IN ('question', 'answer', 'note')),
	-- The reviewer who wrote a question or note; empty for the sender.
	person_identifier TEXT REFERENCES people (identifier),
	body TEXT NOT NULL,
	created_at TEXT NOT NULL,
	CHECK ((kind = 'answer') = (person_identifier IS NULL))
);

CREATE INDEX upload_messages_by_upload ON upload_messages (upload_identifier, created_at);

-- The activity log, rebuilt to allow entries about uploads. SQLite cannot
-- change a CHECK constraint in place (SQLite, "ALTER TABLE: Making Other
-- Kinds Of Table Schema Changes", https://www.sqlite.org/lang_altertable.html).
-- Every entry keeps its sequence number and every field, so the seals in
-- event_seals still match (src/lib/server/activity-seals.ts). Dropping a
-- table does not run its DELETE triggers (SQLite, "DROP TABLE",
-- https://www.sqlite.org/lang_droptable.html).
CREATE TABLE events_copy AS SELECT * FROM events;
DROP TABLE events;

CREATE TABLE events (
	sequence INTEGER PRIMARY KEY AUTOINCREMENT,
	identifier TEXT NOT NULL UNIQUE,
	person_identifier TEXT REFERENCES people (identifier),
	action TEXT NOT NULL,
	target_kind TEXT NOT NULL CHECK (
		target_kind IN ('person', 'request', 'review', 'grant', 'document', 'profile', 'upload')
	),
	target_identifier TEXT NOT NULL,
	note TEXT,
	created_at TEXT NOT NULL
);

INSERT INTO events (sequence, identifier, person_identifier, action, target_kind, target_identifier, note, created_at)
SELECT sequence, identifier, person_identifier, action, target_kind, target_identifier, note, created_at
FROM events_copy ORDER BY sequence;

DROP TABLE events_copy;

CREATE INDEX events_by_target ON events (target_kind, target_identifier, created_at);
CREATE INDEX events_by_person ON events (person_identifier, created_at);

CREATE TRIGGER events_cannot_change BEFORE UPDATE ON events
BEGIN
	SELECT RAISE(ABORT, 'The activity log cannot be changed.');
END;

CREATE TRIGGER events_cannot_be_deleted BEFORE DELETE ON events
BEGIN
	SELECT RAISE(ABORT, 'The activity log cannot be deleted from.');
END;
