-- Lets a sponsor choose Research as where their gift goes, beside the other four choices.
-- Trevor added the choice on Nov. 24, 2026 (docs/sponsorship.md, "The Sponsorship page"). SQLite cannot change a CHECK in place, so the sponsors table is made again with 'research' allowed and every row copied. Dropping the old table would delete the rows of the four tables that refer to it (ON DELETE CASCADE), so those rows are copied aside first and put back afterwards. The labels the site shows for each choice live in src/lib/sponsorship.ts, not here.
PRAGMA defer_foreign_keys = true;

CREATE TABLE sponsors_new (
	identifier TEXT PRIMARY KEY,
	-- The sponsor's own page is /sponsors/<slug>.
	slug TEXT NOT NULL UNIQUE CHECK (slug GLOB '[a-z0-9]*' AND slug NOT GLOB '*[^a-z0-9-]*' AND length(slug) <= 80),
	name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
	link TEXT CHECK (link IS NULL OR (link GLOB 'https://*' AND length(link) <= 300)),
	one_line TEXT CHECK (one_line IS NULL OR length(one_line) <= 160),
	-- The logo in the private bucket, and the image type it was checked to be.
	logo_key TEXT,
	logo_type TEXT CHECK (logo_type IS NULL OR logo_type IN ('image/png', 'image/jpeg', 'image/webp')),
	-- How the sponsor is listed in public, once they have given.
	listing TEXT NOT NULL DEFAULT 'name-logo-link' CHECK (listing IN ('name-logo-link', 'name', 'anonymous', 'hidden')),
	-- What the sponsor would like their gift to go toward.
	earmark TEXT NOT NULL DEFAULT 'needed-most' CHECK (earmark IN ('needed-most', 'books-for-nations', 'large-format', 'research', 'hosting')),
	-- The Stripe customer for each mode. Test and live customers are separate in Stripe.
	stripe_customer_test TEXT UNIQUE,
	stripe_customer_live TEXT UNIQUE,
	-- The lead author can take a sponsor off the public pages, with a note saying why.
	hidden_by_project INTEGER NOT NULL DEFAULT 0 CHECK (hidden_by_project IN (0, 1)),
	hidden_note TEXT,
	created_at TEXT NOT NULL,
	created_by TEXT REFERENCES accounts (identifier) ON DELETE SET NULL,
	updated_at TEXT NOT NULL
);

INSERT INTO sponsors_new SELECT identifier, slug, name, link, one_line, logo_key, logo_type, listing, earmark, stripe_customer_test, stripe_customer_live, hidden_by_project, hidden_note, created_at, created_by, updated_at FROM sponsors;

CREATE TABLE kept_sponsor_managers AS SELECT * FROM sponsor_managers;
CREATE TABLE kept_sponsor_invitations AS SELECT * FROM sponsor_invitations;
CREATE TABLE kept_sponsor_gifts AS SELECT * FROM sponsor_gifts;
CREATE TABLE kept_sponsor_history AS SELECT * FROM sponsor_history;

DROP TABLE sponsors;
ALTER TABLE sponsors_new RENAME TO sponsors;

DELETE FROM sponsor_managers;
DELETE FROM sponsor_invitations;
DELETE FROM sponsor_gifts;
DELETE FROM sponsor_history;
INSERT INTO sponsor_managers SELECT * FROM kept_sponsor_managers;
INSERT INTO sponsor_invitations SELECT * FROM kept_sponsor_invitations;
INSERT INTO sponsor_gifts SELECT * FROM kept_sponsor_gifts;
INSERT INTO sponsor_history SELECT * FROM kept_sponsor_history;

DROP TABLE kept_sponsor_managers;
DROP TABLE kept_sponsor_invitations;
DROP TABLE kept_sponsor_gifts;
DROP TABLE kept_sponsor_history;
