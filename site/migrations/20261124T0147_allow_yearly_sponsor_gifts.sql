-- Lets the site record yearly gifts beside one-time and monthly ones.
-- Sponsors can give every year at each sponsorship level, at ten months' cost (docs/sponsorship.md, "Levels"). SQLite cannot change a CHECK in place, so the sponsor_gifts table is made again with 'yearly' allowed and every row copied. No other table refers to sponsor_gifts, so nothing else needs copying.
CREATE TABLE sponsor_gifts_new (
	identifier TEXT PRIMARY KEY,
	sponsor_identifier TEXT NOT NULL REFERENCES sponsors (identifier) ON DELETE CASCADE,
	mode TEXT NOT NULL CHECK (mode IN ('test', 'live')),
	-- The Checkout Session or invoice, so a gift Stripe reports twice is kept once.
	stripe_object TEXT NOT NULL UNIQUE,
	kind TEXT NOT NULL CHECK (kind IN ('one-time', 'monthly', 'yearly')),
	amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
	currency TEXT NOT NULL,
	earmark TEXT NOT NULL,
	received_at TEXT NOT NULL
);

INSERT INTO sponsor_gifts_new SELECT identifier, sponsor_identifier, mode, stripe_object, kind, amount_cents, currency, earmark, received_at FROM sponsor_gifts;

DROP TABLE sponsor_gifts;
ALTER TABLE sponsor_gifts_new RENAME TO sponsor_gifts;

CREATE INDEX sponsor_gifts_by_sponsor ON sponsor_gifts (sponsor_identifier, mode, received_at);
