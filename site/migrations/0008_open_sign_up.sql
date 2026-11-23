-- Sign-up changes chosen by the lead author on 2026-11-22
-- (docs/contributor-profiles.md):
--   * Everyone who confirms a profile is signed up; there is no waiting
--     step, so profiles still waiting are signed up now.
--   * Signing up is for people 13 or older (it was adults only).
--   * An optional Native name, or another name the person goes by.
--   * Advisors are no longer a separate credit section; any such credit
--     moves to Contributors. The column's CHECK still allows the old value,
--     because changing it would mean rebuilding the table and its children.

ALTER TABLE contributor_profiles RENAME COLUMN adult_confirmed TO thirteen_or_older;

ALTER TABLE contributor_profiles ADD COLUMN native_name TEXT;

UPDATE contributor_profiles SET credit_section = 'contributors' WHERE credit_section = 'advisors';

UPDATE contributor_profiles
SET status = 'welcomed', decided_at = COALESCE(decided_at, submitted_at)
WHERE status = 'submitted';
