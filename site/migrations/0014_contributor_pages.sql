-- Public contributor pages, profile pictures and the People page (docs/contributor-profiles.md,
-- "Contributor pages" and "Profile pictures"), asked for by the lead author on
-- 2026-11-22.
--
-- age_group replaces the single "13 or older" box, so that people under 18 can
-- be credited only by a description or a chosen name (docs/contributions.md).
-- Earlier answers are left empty and asked again.
--
-- public_slug is the address of the person's page, /contributors/<slug>. It is
-- set when they confirm a credit shown on the website by name or chosen name,
-- and cleared when they stop.
--
-- picture_key is the person's picture in the private bucket, a square JPEG with
-- its metadata removed.

ALTER TABLE contributor_profiles ADD COLUMN age_group TEXT CHECK (age_group IN ('13-to-17', '18-or-older'));

ALTER TABLE contributor_profiles ADD COLUMN public_slug TEXT;

CREATE UNIQUE INDEX contributor_profiles_by_slug ON contributor_profiles (public_slug);

ALTER TABLE contributor_profiles ADD COLUMN picture_key TEXT;

ALTER TABLE contributor_profiles ADD COLUMN picture_updated_at TEXT;

-- Specialties the person chooses to show with their name on the People page
-- and their own page: a JSON list of values from `specialties` in
-- src/lib/contributors.ts, and "Other" in their own words.
ALTER TABLE contributor_profiles ADD COLUMN specialties TEXT NOT NULL DEFAULT '[]';

ALTER TABLE contributor_profiles ADD COLUMN specialty_other TEXT;

-- Members of the nonprofit's board, marked by the lead author, are listed first
-- on the People page. The office (President, Secretary, Treasurer) is set once
-- the nonprofit is formed.
ALTER TABLE contributor_profiles ADD COLUMN board_member INTEGER NOT NULL DEFAULT 0 CHECK (board_member IN (0, 1));

ALTER TABLE contributor_profiles ADD COLUMN board_office TEXT;
