-- Following pages (site/COLLABORATION.md, "Following pages"). Someone signed
-- in can follow a nation's page, a section of the model code or an essay, and
-- is told when it changes: by a notice on the site and, once the site can send
-- email, by a summary email if they chose one.
--
-- Nothing here holds the text of a page. A notice records only which page
-- changed and when, and the page's title is looked up from the live site when
-- the notice is shown, so a notice can never show words a nation asked to
-- have removed or restricted, or a name the site no longer uses.

-- The pages each account follows.
CREATE TABLE follows (
	account_identifier TEXT NOT NULL REFERENCES accounts (identifier) ON DELETE CASCADE,
	-- The page's address on the site, such as /nations/navajo-nation.
	address TEXT NOT NULL CHECK (address GLOB '/*' AND length(address) <= 200),
	followed_at TEXT NOT NULL,
	-- The newest update that existed when the page was followed: only later
	-- updates are notices for this account.
	since_update INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY (account_identifier, address)
);

CREATE INDEX follows_by_address ON follows (address);

-- Each time a followed page changed for readers. Recorded only for pages
-- someone follows.
CREATE TABLE page_updates (
	identifier INTEGER PRIMARY KEY AUTOINCREMENT,
	address TEXT NOT NULL,
	-- 'nation', 'code' or 'essay' (src/lib/following.ts).
	kind TEXT NOT NULL CHECK (kind IN ('nation', 'code', 'essay')),
	updated_at TEXT NOT NULL
);

CREATE INDEX page_updates_by_address ON page_updates (address, identifier);

-- The last fingerprint seen of each page that can be followed: a hash of
-- what the page shows readers, worked out when the site is built (nation
-- pages, the model code) or from the newest publication (essays). A changed
-- fingerprint is an update.
CREATE TABLE page_fingerprints (
	address TEXT PRIMARY KEY,
	-- 'build' for pages built with the site, 'essay' for essays.
	source TEXT NOT NULL CHECK (source IN ('build', 'essay')),
	fingerprint TEXT NOT NULL,
	seen_at TEXT NOT NULL
);

-- Which build of the site was last compared with page_fingerprints. One row.
-- A build is compared once: the first copy of the Worker to see a newer build
-- claims it with its own run token, and only statements carrying that token
-- write anything, so two copies running at once cannot record an update twice.
CREATE TABLE following_checks (
	name TEXT PRIMARY KEY CHECK (name = 'site'),
	built_at TEXT NOT NULL,
	build_hash TEXT NOT NULL,
	fingerprint_version INTEGER NOT NULL,
	run_token TEXT NOT NULL,
	checked_at TEXT NOT NULL
);

-- Each account's notice settings. An account with no row has the defaults.
CREATE TABLE follow_settings (
	account_identifier TEXT PRIMARY KEY REFERENCES accounts (identifier) ON DELETE CASCADE,
	-- How often to email a summary: 'off', 'daily' or 'weekly'. Nothing is
	-- sent until the site has an address to send from (UPDATE_EMAIL_FROM).
	email TEXT NOT NULL DEFAULT 'daily' CHECK (email IN ('off', 'daily', 'weekly')),
	-- The newest update the person has seen on the Following page.
	last_read_update INTEGER NOT NULL DEFAULT 0,
	-- The newest update already put in an email, and when that email went.
	last_emailed_update INTEGER NOT NULL DEFAULT 0,
	last_emailed_at TEXT,
	-- The random token in the "Stop these emails" link. It can only turn the
	-- emails off, so it is kept as it is: the link has to keep working in
	-- every email already sent.
	email_off_token TEXT UNIQUE,
	updated_at TEXT NOT NULL
);
