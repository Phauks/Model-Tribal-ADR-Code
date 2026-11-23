-- Recent changes and page histories (site/COLLABORATION.md, "Recent
-- changes"). The site lists every change to its pages, newest first, the way
-- a wiki does, and each page's history.
--
-- Essays are published from the workspace, so their changes are read from
-- essay_publications (0005_essays.sql) and are not copied here. This file
-- holds the changes to the pages built with the site: nation pages, stories,
-- the glossary, the acknowledgments, the charter and licenses and, once it is
-- drafted, the model code. Each new build is compared with the last one
-- (src/lib/server/page-history.ts), and each page whose text changed gets a
-- row here.
--
-- Nation pages and stories never keep their earlier wording on the site: a
-- nation can ask for something to be taken off, and an old version would put
-- it back in view (Trevor, Nov. 23, 2026). For them a row says only which
-- parts of the page changed, never what they said. For the other pages the
-- text of each version is a file in the private sourceDocuments bucket under
-- page-versions/, written once and never replaced, so two versions can be
-- compared.

-- One row for each time a page built with the site changed.
CREATE TABLE page_changes (
	identifier INTEGER PRIMARY KEY AUTOINCREMENT,
	-- The page's address on the site, such as /glossary/american-indian.
	address TEXT NOT NULL CHECK (address GLOB '/*' AND length(address) <= 300),
	-- The kind of page (src/lib/page-history.ts, pageKinds).
	kind TEXT NOT NULL,
	-- The page's title when it changed. Empty for nation pages and stories,
	-- whose titles are looked up from the live site when the change is shown,
	-- so a name the site no longer uses is never shown again.
	title TEXT,
	change TEXT NOT NULL CHECK (change IN ('new', 'edit', 'removed')),
	-- What the site's change history records about it: the merged changes'
	-- titles, such as "Add dictionary-style glossary entries". Empty when the
	-- build could not tell.
	summary TEXT,
	-- True when the change came with an update to many pages at once, such as
	-- a run that added archive links to every source; Recent changes hides
	-- those unless the reader asks for them, the way a wiki hides bots.
	bulk INTEGER NOT NULL DEFAULT 0 CHECK (bulk IN (0, 1)),
	-- For pages whose earlier wording may be shown: the text's size before and
	-- after in bytes, and the files in the bucket holding each version.
	bytes_before INTEGER,
	bytes_after INTEGER,
	text_before TEXT,
	text_after TEXT,
	-- For nation pages and stories: the names of the parts of the page that
	-- changed, as a JSON list, such as ["Contacts","Courts"].
	parts TEXT,
	-- When the change was made: the newest merged change in it, or else when
	-- the build was made.
	made_at TEXT NOT NULL,
	recorded_at TEXT NOT NULL,
	CHECK ((text_before IS NULL AND text_after IS NULL) OR parts IS NULL)
);

CREATE INDEX page_changes_by_time ON page_changes (made_at DESC, identifier DESC);
CREATE INDEX page_changes_by_address ON page_changes (address, made_at DESC);

-- The last version seen of each page built with the site, compared with
-- each new build.
CREATE TABLE page_states (
	address TEXT PRIMARY KEY,
	kind TEXT NOT NULL,
	-- A hash of what the page shows readers.
	fingerprint TEXT NOT NULL,
	bytes INTEGER,
	-- The file in the bucket holding this version's text, for pages whose
	-- earlier wording may be shown.
	text_key TEXT,
	-- For nation pages and stories: a hash of each part of the page, as a JSON
	-- object, so the next change can name the parts that changed.
	part_hashes TEXT,
	seen_at TEXT NOT NULL
);

-- Which build was last compared with page_states. One row. As with
-- following_checks (0011_following.sql), the first copy of the Worker to see
-- a newer build claims it with its own run token, and only statements
-- carrying that token write, so a change is never recorded twice.
CREATE TABLE page_history_checks (
	name TEXT PRIMARY KEY CHECK (name = 'site'),
	built_at TEXT NOT NULL,
	build_hash TEXT NOT NULL,
	fingerprint_version INTEGER NOT NULL,
	run_token TEXT NOT NULL,
	checked_at TEXT NOT NULL
);

-- Parts of a change the lead author has hidden, the way a wiki hides a
-- revision: its text, its summary, or who made it. A hidden change stays in
-- the list with a line through what is hidden. Hiding and showing again are
-- recorded in the activity log (events), so this row can change; deleting it
-- shows the change again.
--
-- A change is named as in src/lib/page-history.ts: "page-<identifier>" for a
-- row above, "essay-<essay identifier>-<publication number>" for an essay.
CREATE TABLE hidden_changes (
	change TEXT PRIMARY KEY CHECK (change GLOB 'page-[0-9]*' OR change GLOB 'essay-*-[0-9]*'),
	hide_text INTEGER NOT NULL DEFAULT 1 CHECK (hide_text IN (0, 1)),
	hide_summary INTEGER NOT NULL DEFAULT 0 CHECK (hide_summary IN (0, 1)),
	hide_person INTEGER NOT NULL DEFAULT 0 CHECK (hide_person IN (0, 1)),
	-- The reason readers see (src/lib/page-history.ts, hideReasons).
	reason TEXT NOT NULL,
	person_identifier TEXT REFERENCES people (identifier),
	hidden_at TEXT NOT NULL,
	CHECK (hide_text + hide_summary + hide_person > 0)
);
