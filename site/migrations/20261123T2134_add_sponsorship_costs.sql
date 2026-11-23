-- Add the costs the Sponsorship page shows for each thing a gift can fund.
-- The lead author sets them on the workspace Sponsors page once they are
-- known, because printing and hosting prices are not settled (Trevor,
-- Nov. 23, 2026: "don't hard set the money, we don't even know how much the
-- books will cost yet"). A cost with no row, or a null cost, is not shown.
-- What each cost counts (a copy or a year) is fixed in code
-- (src/lib/sponsorship.ts, earmarkCostUnits; docs/sponsorship.md).
CREATE TABLE sponsorship_costs (
	earmark TEXT PRIMARY KEY CHECK (earmark IN ('books-for-nations', 'large-format', 'hosting')),
	cost_cents INTEGER CHECK (cost_cents IS NULL OR cost_cents > 0),
	updated_at TEXT NOT NULL,
	-- "The project (name)", as the sponsor history names the lead author.
	updated_by TEXT NOT NULL
);
