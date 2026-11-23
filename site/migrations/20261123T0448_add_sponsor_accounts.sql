-- Adds sponsor accounts: organizations that give to the project, the accounts that manage each one, invitations to manage one, the gifts Stripe reports, and a history of changes.
-- The design is in docs/sponsorship.md and decision record 0050. Gifts stay off until SPONSOR_GIFTS is set, and the amount someone gives is never shown in public.

CREATE TABLE sponsors (
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
	earmark TEXT NOT NULL DEFAULT 'needed-most' CHECK (earmark IN ('needed-most', 'books-for-nations', 'large-format', 'hosting')),
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

-- Everyone who manages a sponsorship can change everything on it.
CREATE TABLE sponsor_managers (
	sponsor_identifier TEXT NOT NULL REFERENCES sponsors (identifier) ON DELETE CASCADE,
	account_identifier TEXT NOT NULL REFERENCES accounts (identifier) ON DELETE CASCADE,
	added_at TEXT NOT NULL,
	PRIMARY KEY (sponsor_identifier, account_identifier)
);

CREATE INDEX sponsor_managers_by_account ON sponsor_managers (account_identifier);

-- A link that makes whoever opens it, signed in, a manager. Only the hash of the link's secret is kept.
CREATE TABLE sponsor_invitations (
	identifier TEXT PRIMARY KEY,
	sponsor_identifier TEXT NOT NULL REFERENCES sponsors (identifier) ON DELETE CASCADE,
	token_hash TEXT NOT NULL UNIQUE,
	-- What the inviter called the person, such as an email address. It is a note, not a check.
	label TEXT NOT NULL CHECK (length(label) BETWEEN 1 AND 200),
	created_by TEXT REFERENCES accounts (identifier) ON DELETE SET NULL,
	created_at TEXT NOT NULL,
	expires_at TEXT NOT NULL,
	accepted_at TEXT,
	accepted_by TEXT REFERENCES accounts (identifier) ON DELETE SET NULL
);

CREATE INDEX sponsor_invitations_by_sponsor ON sponsor_invitations (sponsor_identifier, created_at);

-- Each gift Stripe reports: a paid Checkout page for a one-time gift, or a paid invoice for a monthly one.
CREATE TABLE sponsor_gifts (
	identifier TEXT PRIMARY KEY,
	sponsor_identifier TEXT NOT NULL REFERENCES sponsors (identifier) ON DELETE CASCADE,
	mode TEXT NOT NULL CHECK (mode IN ('test', 'live')),
	-- The Checkout Session or invoice, so a gift Stripe reports twice is kept once.
	stripe_object TEXT NOT NULL UNIQUE,
	kind TEXT NOT NULL CHECK (kind IN ('one-time', 'monthly')),
	amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
	currency TEXT NOT NULL,
	earmark TEXT NOT NULL,
	received_at TEXT NOT NULL
);

CREATE INDEX sponsor_gifts_by_sponsor ON sponsor_gifts (sponsor_identifier, mode, received_at);

-- What changed on a sponsorship and who changed it, for the sponsor's managers and the lead author.
CREATE TABLE sponsor_history (
	identifier TEXT PRIMARY KEY,
	sponsor_identifier TEXT NOT NULL REFERENCES sponsors (identifier) ON DELETE CASCADE,
	account_identifier TEXT REFERENCES accounts (identifier) ON DELETE SET NULL,
	-- "Stripe" for a gift Stripe reported, "The project" for the lead author.
	actor TEXT NOT NULL,
	action TEXT NOT NULL,
	note TEXT,
	created_at TEXT NOT NULL
);

CREATE INDEX sponsor_history_by_sponsor ON sponsor_history (sponsor_identifier, created_at);
