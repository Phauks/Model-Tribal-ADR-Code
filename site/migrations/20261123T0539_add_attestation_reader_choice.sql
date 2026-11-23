-- Lets each person choose whether readers see their name under a section they attested to.
-- Design: docs/editing.md, "Attesting to a section". An attestation is shown
-- to readers on the published essay page only when its person chose so and
-- the published section is the text they attested to. Rows made before this
-- choice existed are not shown, so no name reaches readers without a choice.
-- The choice can be changed later; the trigger from
-- 20261123T0531_add_essay_attestations.sql does not cover the new column.
ALTER TABLE essay_attestations ADD COLUMN shown_to_readers INTEGER NOT NULL DEFAULT 0 CHECK (shown_to_readers IN (0, 1));
