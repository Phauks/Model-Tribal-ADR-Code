-- Adds passkeys, Google and Microsoft sign-in, and short-lived sign-in challenges.
--
-- Design: site/COLLABORATION.md, "Passkeys" and "Google and Microsoft sign-in",
-- and decision record 0062. A passkey's private key never leaves the person's
-- device; only its public key is kept here. A Google or Microsoft sign-in is
-- tied to an account by the provider's own identifier for the person, never by
-- the email address alone.
PRAGMA defer_foreign_keys = on;

-- Each passkey an account has added. credential_id and public_key are
-- base64url text, as the browser and the WebAuthn library give them.
CREATE TABLE passkeys (
	credential_id TEXT PRIMARY KEY,
	account_identifier TEXT NOT NULL REFERENCES accounts (identifier) ON DELETE CASCADE,
	public_key TEXT NOT NULL,
	-- The authenticator's signature counter; most passkeys keep it at 0.
	sign_count INTEGER NOT NULL DEFAULT 0 CHECK (sign_count >= 0),
	-- How the browser can reach it, as a JSON list such as ["internal","hybrid"].
	transports TEXT,
	-- The password manager or device that holds it, such as "iCloud Keychain", or "Passkey".
	name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
	-- The browser and system it was added on, such as "Safari on Mac".
	device TEXT CHECK (device IS NULL OR length(device) <= 60),
	-- 1 when the passkey is synced between devices (a backed-up passkey).
	backed_up INTEGER NOT NULL DEFAULT 0 CHECK (backed_up IN (0, 1)),
	created_at TEXT NOT NULL,
	last_used_at TEXT
);

CREATE INDEX passkeys_by_account ON passkeys (account_identifier);

-- Google and Microsoft accounts connected to an account. subject is Google's
-- "sub", or Microsoft's tenant and object identifiers joined as "tid:oid",
-- which stay the same when the person's email address changes.
CREATE TABLE outside_sign_ins (
	provider TEXT NOT NULL CHECK (provider IN ('google', 'microsoft')),
	subject TEXT NOT NULL CHECK (length(subject) BETWEEN 1 AND 200),
	account_identifier TEXT NOT NULL REFERENCES accounts (identifier) ON DELETE CASCADE,
	-- The address the provider gave, to show on Sign-in and security.
	email TEXT,
	created_at TEXT NOT NULL,
	last_used_at TEXT,
	PRIMARY KEY (provider, subject)
);

-- One Google and one Microsoft account at most for each account.
CREATE UNIQUE INDEX outside_sign_ins_one_per_provider ON outside_sign_ins (account_identifier, provider);

-- Challenges that wait for the browser's answer: a passkey challenge, or the
-- state, nonce and PKCE verifier of a Google or Microsoft sign-in. The
-- browser holds a random handle in a cookie; only its hash is kept here.
-- Each works once and for ten minutes.
CREATE TABLE sign_in_challenges (
	handle_hash TEXT PRIMARY KEY,
	purpose TEXT NOT NULL CHECK (purpose IN ('passkey-sign-in', 'passkey-add', 'google', 'microsoft')),
	-- JSON: what the answer is checked against.
	details TEXT NOT NULL,
	-- The signed-in account, when adding a passkey or connecting an account.
	account_identifier TEXT REFERENCES accounts (identifier) ON DELETE CASCADE,
	created_at TEXT NOT NULL,
	expires_at TEXT NOT NULL
);

-- Sessions can now start with a passkey, Google or Microsoft. SQLite cannot
-- change a CHECK, so the table is made again with the same rows.
CREATE TABLE sessions_new (
	token_hash TEXT PRIMARY KEY,
	account_identifier TEXT NOT NULL REFERENCES accounts (identifier) ON DELETE CASCADE,
	created_at TEXT NOT NULL,
	last_seen_at TEXT NOT NULL,
	expires_at TEXT NOT NULL,
	method TEXT NOT NULL CHECK (method IN ('code', 'link', 'password', 'passkey', 'google', 'microsoft')),
	device TEXT CHECK (device IS NULL OR length(device) <= 60),
	second_step TEXT NOT NULL DEFAULT 'none' CHECK (second_step IN ('none', 'waiting', 'done')),
	wrong_second_steps INTEGER NOT NULL DEFAULT 0 CHECK (wrong_second_steps >= 0),
	lasting INTEGER NOT NULL DEFAULT 0 CHECK (lasting IN (0, 1))
);

INSERT INTO sessions_new (token_hash, account_identifier, created_at, last_seen_at, expires_at, method, device, second_step, wrong_second_steps, lasting)
SELECT token_hash, account_identifier, created_at, last_seen_at, expires_at, method, device, second_step, wrong_second_steps, lasting FROM sessions;

DROP TABLE sessions;
ALTER TABLE sessions_new RENAME TO sessions;
CREATE INDEX sessions_by_account ON sessions (account_identifier);
