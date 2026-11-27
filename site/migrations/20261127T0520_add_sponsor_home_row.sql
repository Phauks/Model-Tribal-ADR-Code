-- Lets a sponsor appear in the rolling row of sponsors on the home page.
-- Trevor asked for the row on Nov. 27, 2026 and chose that Patrons appear by name and Benefactors by logo (docs/sponsorship.md, "The home page row"). Being on the row tells anyone the sponsor gives at least a Patron's amount, so a sponsor appears only if their managers choose to (home_row_chosen). The lead author can also place a sponsor on the row whatever they give, such as one who gave by check, or keep one off it (home_row_placement).
ALTER TABLE sponsors ADD COLUMN home_row_chosen INTEGER NOT NULL DEFAULT 0 CHECK (home_row_chosen IN (0, 1));
ALTER TABLE sponsors ADD COLUMN home_row_placement TEXT NOT NULL DEFAULT 'by-level' CHECK (home_row_placement IN ('by-level', 'always', 'never'));
