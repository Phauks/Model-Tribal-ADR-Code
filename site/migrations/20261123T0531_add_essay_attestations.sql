-- Adds attestations, by which authors, editors and reviewers vouch for an essay's sections.
-- Asked for by the lead author on Nov. 22, 2026 ("Allow attestation of
-- authors and editors within sections and sub-sections"); the design is in
-- docs/editing.md, "Attesting to a section". A person attests that they
-- wrote, edited or reviewed a section or subsection as it stood at that
-- moment: the row keeps the section's Markdown and its SHA-256, so the
-- editor can say when the text has changed since. Attesting again adds a
-- new row; the newest row per person and role is the one shown. A row is
-- never changed, except to record that its person withdrew it, and never
-- deleted. Each attestation and withdrawal is also in the activity log.
CREATE TABLE essay_attestations (
	identifier TEXT PRIMARY KEY,
	essay_identifier TEXT NOT NULL REFERENCES essays (identifier),
	-- The heading's id on the essay page, such as "the-cherokee-cases".
	section_slug TEXT NOT NULL,
	-- The heading's words when attested, kept for the record.
	section_title TEXT NOT NULL,
	-- 2 for a section, 3 for a subsection.
	section_level INTEGER NOT NULL CHECK (section_level IN (2, 3)),
	role TEXT NOT NULL CHECK (role IN ('wrote', 'edited', 'reviewed')),
	person_identifier TEXT NOT NULL REFERENCES people (identifier),
	-- The section's Markdown as attested, heading and subsections included.
	section_text TEXT NOT NULL,
	section_sha256 TEXT NOT NULL CHECK (length(section_sha256) = 64),
	note TEXT,
	created_at TEXT NOT NULL,
	withdrawn_at TEXT
);

CREATE INDEX essay_attestations_by_section ON essay_attestations (essay_identifier, section_slug, created_at);

CREATE TRIGGER essay_attestations_only_withdrawn BEFORE UPDATE ON essay_attestations
WHEN OLD.withdrawn_at IS NOT NULL
	OR NEW.identifier IS NOT OLD.identifier
	OR NEW.essay_identifier IS NOT OLD.essay_identifier
	OR NEW.section_slug IS NOT OLD.section_slug
	OR NEW.section_title IS NOT OLD.section_title
	OR NEW.section_level IS NOT OLD.section_level
	OR NEW.role IS NOT OLD.role
	OR NEW.person_identifier IS NOT OLD.person_identifier
	OR NEW.section_text IS NOT OLD.section_text
	OR NEW.section_sha256 IS NOT OLD.section_sha256
	OR NEW.note IS NOT OLD.note
	OR NEW.created_at IS NOT OLD.created_at
BEGIN
	SELECT RAISE(ABORT, 'An attestation can only be withdrawn, once.');
END;

CREATE TRIGGER essay_attestations_cannot_be_deleted BEFORE DELETE ON essay_attestations
BEGIN
	SELECT RAISE(ABORT, 'Attestations cannot be deleted.');
END;
