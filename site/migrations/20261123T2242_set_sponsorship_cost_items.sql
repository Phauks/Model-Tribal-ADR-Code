-- Change the Sponsorship page's costs to the three the approved mockup shows.
-- Trevor approved mockup A (Nov. 23, 2026), whose cards are the site for a
-- year and hardcovers for every nation, beside the paperback goal; the first
-- version of this table keyed costs by what a gift goes toward and had the
-- large-format edition in place of hardcovers. The table was empty when this
-- was written, so it is made again. What each cost counts is fixed in code
-- (src/lib/sponsorship.ts, costItemUnits; docs/sponsorship.md).
DROP TABLE sponsorship_costs;

CREATE TABLE sponsorship_costs (
	item TEXT PRIMARY KEY CHECK (item IN ('paperback', 'hardcover', 'website')),
	cost_cents INTEGER CHECK (cost_cents IS NULL OR cost_cents > 0),
	updated_at TEXT NOT NULL,
	-- "The project (name)", as the sponsor history names the lead author.
	updated_by TEXT NOT NULL
);
