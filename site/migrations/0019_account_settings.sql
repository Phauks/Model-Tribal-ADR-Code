-- Account pages and settings on every device (site/DESIGN.md, section 6,
-- "Settings and Account"; decision record 0045).
--
-- Settings change how the site looks on one screen and are kept on that
-- device. A signed-in person can choose to use the same settings on every
-- device they sign in on: a copy is then kept here, with the account. The
-- row exists only while that choice is on; turning it off deletes the row.
CREATE TABLE account_settings (
	account_identifier TEXT PRIMARY KEY REFERENCES accounts (identifier) ON DELETE CASCADE,
	-- The reading settings as src/lib/reading-settings.ts stores them: only the
	-- ones that differ from the default, as JSON. '{}' means all defaults.
	reading_settings TEXT NOT NULL DEFAULT '{}' CHECK (length(reading_settings) <= 2000),
	-- 'device', 'light' or 'dark', as the theme button stores it.
	theme TEXT NOT NULL DEFAULT 'device' CHECK (theme IN ('device', 'light', 'dark')),
	updated_at TEXT NOT NULL
);

-- The browser and system a session was started from, such as "Firefox on
-- Windows", so the Sign-in and security page can list where the person is
-- signed in. Only these words are kept, never the full browser string or a
-- place. Empty for sessions started before this migration.
ALTER TABLE sessions ADD COLUMN device TEXT CHECK (device IS NULL OR length(device) <= 60);
