-- Adds credits that a person with full access to an essay adds by hand under a section heading, such as "Researched by".
-- The lead author chose on Nov. 24, 2026 to credit each section from the edit history, with a way to add someone, in place of attesting (docs/editing.md, "Credits"). Who wrote and edited a section comes from the saved versions and who reviewed it from review requests; this table holds only what the history cannot know. Rows are only added: adding a credit is one row, taking it away is another with action 'remove', and the newest row for a person, role and section says whether the credit stands. The essay_attestations table stays as a record; nothing adds to it now.
CREATE TABLE essay_section_credits (
	identifier TEXT PRIMARY KEY,
	essay_identifier TEXT NOT NULL REFERENCES essays (identifier),
	-- The heading's id on the essay page, such as "the-cherokee-cases".
	section_slug TEXT NOT NULL,
	-- The heading's words when the credit was added or taken away, kept for the record.
	section_title TEXT NOT NULL,
	person_identifier TEXT NOT NULL REFERENCES people (identifier),
	role TEXT NOT NULL CHECK (role IN ('wrote', 'edited', 'researched', 'reviewed')),
	action TEXT NOT NULL CHECK (action IN ('add', 'remove')),
	-- Who added or took away the credit.
	changed_by TEXT NOT NULL REFERENCES people (identifier),
	created_at TEXT NOT NULL
);

CREATE INDEX essay_section_credits_by_essay ON essay_section_credits (essay_identifier, created_at);

CREATE TRIGGER essay_section_credits_cannot_change BEFORE UPDATE ON essay_section_credits
BEGIN
	SELECT RAISE(ABORT, 'Credits are only added; take one away with a new row.');
END;

CREATE TRIGGER essay_section_credits_cannot_be_deleted BEFORE DELETE ON essay_section_credits
BEGIN
	SELECT RAISE(ABORT, 'Credits cannot be deleted; take one away with a new row.');
END;
