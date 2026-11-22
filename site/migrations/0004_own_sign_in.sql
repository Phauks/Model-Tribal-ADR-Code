-- The site's own sign-in, replacing Auth0 (decision record 0024,
-- site/COLLABORATION.md, "How sign-in works").
--
-- People sign in with a code sent to their email address, a link in the same
-- email, or a password they chose. Nothing that would let someone sign in is
-- stored as it is: codes, links and session tokens are kept only as SHA-256
-- hashes, and passwords only as salted PBKDF2 hashes.
--
-- `people.sign_in_subject` and `contributor_profiles.sign_in_subject` now hold
-- an account identifier from this table. Nobody had signed in with Auth0 when
-- this changed, so no rows needed converting.

CREATE TABLE accounts (
	identifier TEXT PRIMARY KEY,
	email TEXT NOT NULL UNIQUE COLLATE NOCASE,
	-- When the person last proved they receive mail at this address. An
	-- account is only ever created by a code, a link or an invitation link,
	-- so this is always set.
	email_verified_at TEXT NOT NULL,
	-- Empty until the person chooses a password. Code sign-in always works.
	password_hash TEXT,
	password_salt TEXT,
	password_iterations INTEGER,
	password_changed_at TEXT,
	created_at TEXT NOT NULL,
	last_signed_in_at TEXT
);

-- Codes and links that have been sent or made and not yet used. A code is
-- six digits; the link token is 256 random bits. Each row is used at most
-- once, expires after a few minutes, and stops working after a few wrong
-- codes, so a code cannot be guessed.
CREATE TABLE sign_in_codes (
	identifier TEXT PRIMARY KEY,
	email TEXT NOT NULL COLLATE NOCASE,
	code_hash TEXT,
	link_hash TEXT NOT NULL UNIQUE,
	-- 'email' for a code the person asked for; 'invitation' for a link the
	-- lead author made for someone they invited; 'operator' for a link made
	-- from the command line by someone with access to the Cloudflare account.
	origin TEXT NOT NULL CHECK (origin IN ('email', 'invitation', 'operator')),
	wrong_attempts INTEGER NOT NULL DEFAULT 0,
	created_by TEXT REFERENCES people (identifier),
	created_at TEXT NOT NULL,
	expires_at TEXT NOT NULL
);

CREATE INDEX sign_in_codes_by_email ON sign_in_codes (email, created_at);

-- Signed-in browsers. The cookie holds a random token; only its hash is kept
-- here, so a copy of the database cannot be used to sign in.
CREATE TABLE sessions (
	token_hash TEXT PRIMARY KEY,
	account_identifier TEXT NOT NULL REFERENCES accounts (identifier) ON DELETE CASCADE,
	created_at TEXT NOT NULL,
	last_seen_at TEXT NOT NULL,
	expires_at TEXT NOT NULL,
	-- How the session started: 'code', 'link' or 'password'.
	method TEXT NOT NULL CHECK (method IN ('code', 'link', 'password'))
);

CREATE INDEX sessions_by_account ON sessions (account_identifier);
