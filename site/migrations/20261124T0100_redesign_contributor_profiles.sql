-- Stores contributor profile answers as separate, repeatable rows for the redesigned profile screen.
-- Design: docs/contributor-profiles.md ("Answers and where they appear"), after Trevor's notes of Nov. 23 and 24, 2026:
-- any number of names, pronouns, birth year in place of an age group, several emails and phones each with what they may
-- be used for, nations picked from the project's list with each relationship in its own row, languages with Speak, Read
-- and Write, specialties in their own rows, a CV, and a Book and a Website choice for every answer in place of one form
-- of credit. Each kind of answer has its own table, so changing one row never touches another.
--
-- The earlier columns (native_name, phone, preferred_contact, languages, specialties, specialty_other, credit_form,
-- credit_name, credit_role, credit_pseudonym, credit_in_book, credit_on_website, biography_in_credits) are copied into
-- the new tables below and are no longer written. They stay, unused, because dropping a column that a CHECK names
-- would mean copying the whole table. age_group is still written, worked out from the birth year, so pages that check
-- the current answers for someone under 18 keep working. Confirmed versions keep their snapshots as they were; the site
-- reads an earlier snapshot through upgradeAnswers in src/lib/contributors.ts.

ALTER TABLE contributor_profiles ADD COLUMN birth_year INTEGER;
-- "Have you had your 13th (or 18th) birthday yet?", asked only in that year, and the year it was answered.
ALTER TABLE contributor_profiles ADD COLUMN birthday_answer TEXT CHECK (birthday_answer IN ('yes', 'no'));
ALTER TABLE contributor_profiles ADD COLUMN birthday_answer_year INTEGER;
ALTER TABLE contributor_profiles ADD COLUMN pronoun_other TEXT;
-- A description to print in place of a name, moved from credit_role.
ALTER TABLE contributor_profiles ADD COLUMN description TEXT;
-- A CV or resume in the private bucket, kept like an upload and checked by the virus scanner (site/SCANNING.md). Never published.
ALTER TABLE contributor_profiles ADD COLUMN curriculum_vitae_key TEXT;
ALTER TABLE contributor_profiles ADD COLUMN curriculum_vitae_name TEXT;
ALTER TABLE contributor_profiles ADD COLUMN curriculum_vitae_updated_at TEXT;

UPDATE contributor_profiles SET description = credit_role;

-- Names beyond the first and last name, in the person's order, each with where it may appear.
CREATE TABLE contributor_names (
	identifier TEXT PRIMARY KEY,
	profile_identifier TEXT NOT NULL REFERENCES contributor_profiles (identifier) ON DELETE CASCADE,
	position INTEGER NOT NULL,
	name TEXT NOT NULL,
	kind TEXT NOT NULL CHECK (kind IN ('native', 'goes-by', 'pen-name', 'other')),
	in_book INTEGER NOT NULL DEFAULT 0 CHECK (in_book IN (0, 1)),
	on_website INTEGER NOT NULL DEFAULT 0 CHECK (on_website IN (0, 1))
);

CREATE INDEX contributor_names_by_profile ON contributor_names (profile_identifier, position);

-- A name the person wrote to print in place of their own stood in for it, so it takes the full name's places.
INSERT INTO contributor_names (identifier, profile_identifier, position, name, kind, in_book, on_website)
SELECT lower(hex(randomblob(16))), identifier, -1, credit_name, 'other', credit_in_book, credit_on_website
FROM contributor_profiles WHERE credit_form IN ('name', 'name-and-nation') AND credit_name IS NOT NULL AND credit_name != '';

INSERT INTO contributor_names (identifier, profile_identifier, position, name, kind, in_book, on_website)
SELECT lower(hex(randomblob(16))), identifier, 0, native_name, 'native', 0, 0
FROM contributor_profiles WHERE native_name IS NOT NULL AND native_name != '';

INSERT INTO contributor_names (identifier, profile_identifier, position, name, kind, in_book, on_website)
SELECT lower(hex(randomblob(16))), identifier, 1, credit_pseudonym, 'pen-name',
	CASE WHEN credit_form = 'pseudonym' AND credit_in_book = 1 THEN 1 ELSE 0 END,
	CASE WHEN credit_form = 'pseudonym' AND credit_on_website = 1 THEN 1 ELSE 0 END
FROM contributor_profiles WHERE credit_pseudonym IS NOT NULL AND credit_pseudonym != '';

-- Pronouns, one row each.
CREATE TABLE contributor_pronouns (
	profile_identifier TEXT NOT NULL REFERENCES contributor_profiles (identifier) ON DELETE CASCADE,
	pronoun TEXT NOT NULL CHECK (pronoun IN ('she', 'he', 'they', 'name-only', 'other', 'not-saying')),
	PRIMARY KEY (profile_identifier, pronoun)
);

-- Emails and phones, each with what it may be used for. Never published. The sign-in address is the row with sign_in = 1.
CREATE TABLE contributor_contacts (
	identifier TEXT PRIMARY KEY,
	profile_identifier TEXT NOT NULL REFERENCES contributor_profiles (identifier) ON DELETE CASCADE,
	position INTEGER NOT NULL,
	kind TEXT NOT NULL CHECK (kind IN ('email', 'phone')),
	-- An email address, or a phone number in E.164 form such as +17025550134.
	value TEXT NOT NULL,
	-- The phone number's country, ISO 3166-1 alpha-2.
	country TEXT,
	sign_in INTEGER NOT NULL DEFAULT 0 CHECK (sign_in IN (0, 1)),
	may_email INTEGER NOT NULL DEFAULT 0 CHECK (may_email IN (0, 1)),
	may_call INTEGER NOT NULL DEFAULT 0 CHECK (may_call IN (0, 1)),
	may_text INTEGER NOT NULL DEFAULT 0 CHECK (may_text IN (0, 1)),
	preferred INTEGER NOT NULL DEFAULT 0 CHECK (preferred IN (0, 1))
);

CREATE INDEX contributor_contacts_by_profile ON contributor_contacts (profile_identifier, position);

INSERT INTO contributor_contacts (identifier, profile_identifier, position, kind, value, country, sign_in, may_email, may_call, may_text, preferred)
SELECT lower(hex(randomblob(16))), identifier, 0, 'email', email, NULL, 1, 1, 0, 0,
	CASE WHEN preferred_contact IS NULL OR preferred_contact = 'email' THEN 1 ELSE 0 END
FROM contributor_profiles;

-- A phone number written before the redesign keeps its old form until the person saves the profile again.
INSERT INTO contributor_contacts (identifier, profile_identifier, position, kind, value, country, sign_in, may_email, may_call, may_text, preferred)
SELECT lower(hex(randomblob(16))), identifier, 1, 'phone', phone, NULL, 0, 0, 1,
	CASE WHEN preferred_contact = 'text-message' THEN 1 ELSE 0 END,
	CASE WHEN preferred_contact IN ('phone', 'text-message') THEN 1 ELSE 0 END
FROM contributor_profiles WHERE phone IS NOT NULL AND phone != '';

-- Nations: where each may appear, and the relationship in the person's own words when they chose Other.
ALTER TABLE contributor_nations ADD COLUMN in_book INTEGER NOT NULL DEFAULT 0 CHECK (in_book IN (0, 1));
ALTER TABLE contributor_nations ADD COLUMN on_website INTEGER NOT NULL DEFAULT 0 CHECK (on_website IN (0, 1));
ALTER TABLE contributor_nations ADD COLUMN relationship_other TEXT;

UPDATE contributor_nations SET
	relationship_other = connection,
	in_book = (SELECT CASE WHEN contributor_nations.show_in_credit = 1 AND profiles.credit_form = 'name-and-nation' AND profiles.credit_in_book = 1 THEN 1 ELSE 0 END
		FROM contributor_profiles AS profiles WHERE profiles.identifier = contributor_nations.profile_identifier),
	on_website = (SELECT CASE WHEN contributor_nations.show_in_credit = 1 AND profiles.credit_form = 'name-and-nation' AND profiles.credit_on_website = 1 THEN 1 ELSE 0 END
		FROM contributor_profiles AS profiles WHERE profiles.identifier = contributor_nations.profile_identifier);

-- Each relationship to a nation in its own row (Trevor, Nov. 24, 2026: "each should be kept separate so that they don't corrupt each other").
CREATE TABLE contributor_nation_relationships (
	nation_row_identifier TEXT NOT NULL REFERENCES contributor_nations (identifier) ON DELETE CASCADE,
	relationship TEXT NOT NULL CHECK (
		relationship IN ('citizen', 'descendant', 'family', 'community', 'works-for', 'works-with', 'other')
	),
	PRIMARY KEY (nation_row_identifier, relationship)
);

INSERT INTO contributor_nation_relationships (nation_row_identifier, relationship)
SELECT identifier, 'other' FROM contributor_nations WHERE connection IS NOT NULL AND connection != '';

-- Languages, each with Speak, Read and Write, and whether it is listed on the person's page. Never printed.
CREATE TABLE contributor_languages (
	identifier TEXT PRIMARY KEY,
	profile_identifier TEXT NOT NULL REFERENCES contributor_profiles (identifier) ON DELETE CASCADE,
	position INTEGER NOT NULL,
	-- ISO 639-3, from src/lib/languages.ts; NULL for a language written in.
	language_code TEXT,
	other_name TEXT,
	speaks INTEGER NOT NULL DEFAULT 0 CHECK (speaks IN (0, 1)),
	reads INTEGER NOT NULL DEFAULT 0 CHECK (reads IN (0, 1)),
	writes INTEGER NOT NULL DEFAULT 0 CHECK (writes IN (0, 1)),
	on_website INTEGER NOT NULL DEFAULT 0 CHECK (on_website IN (0, 1)),
	CHECK (language_code IS NOT NULL OR other_name IS NOT NULL)
);

CREATE INDEX contributor_languages_by_profile ON contributor_languages (profile_identifier, position);

INSERT INTO contributor_languages (identifier, profile_identifier, position, language_code, other_name, speaks, reads, writes, on_website)
SELECT lower(hex(randomblob(16))), identifier, 0, NULL, languages, 1, 0, 0, 0
FROM contributor_profiles WHERE languages IS NOT NULL AND languages != '';

-- Specialties, one row each: from the list, or in the person's own words.
CREATE TABLE contributor_specialties (
	identifier TEXT PRIMARY KEY,
	profile_identifier TEXT NOT NULL REFERENCES contributor_profiles (identifier) ON DELETE CASCADE,
	position INTEGER NOT NULL,
	specialty TEXT CHECK (specialty IN ('peacemaking', 'mediation', 'tribal-courts', 'tribal-codes', 'language', 'research')),
	other_name TEXT,
	CHECK ((specialty IS NULL) != (other_name IS NULL))
);

CREATE INDEX contributor_specialties_by_profile ON contributor_specialties (profile_identifier, position);

INSERT INTO contributor_specialties (identifier, profile_identifier, position, specialty, other_name)
SELECT lower(hex(randomblob(16))), profiles.identifier, chosen.key, chosen.value, NULL
FROM contributor_profiles AS profiles, json_each(profiles.specialties) AS chosen
WHERE chosen.value IN ('peacemaking', 'mediation', 'tribal-courts', 'tribal-codes', 'language', 'research');

INSERT INTO contributor_specialties (identifier, profile_identifier, position, specialty, other_name)
SELECT lower(hex(randomblob(16))), identifier, 100, NULL, specialty_other
FROM contributor_profiles WHERE specialty_other IS NOT NULL AND specialty_other != '';

-- Where each answer that appears once may appear: the first and last name, picture, pronouns, organization,
-- specialties, description and biography. No row means neither place.
CREATE TABLE contributor_placements (
	profile_identifier TEXT NOT NULL REFERENCES contributor_profiles (identifier) ON DELETE CASCADE,
	item TEXT NOT NULL CHECK (
		item IN ('full-name', 'picture', 'pronouns', 'organization', 'specialties', 'description', 'biography')
	),
	in_book INTEGER NOT NULL DEFAULT 0 CHECK (in_book IN (0, 1)),
	on_website INTEGER NOT NULL DEFAULT 0 CHECK (on_website IN (0, 1)),
	PRIMARY KEY (profile_identifier, item)
);

-- The earlier single choice of credit, spread over the answers it covered.
INSERT INTO contributor_placements (profile_identifier, item, in_book, on_website)
SELECT identifier, 'full-name', credit_in_book, credit_on_website
FROM contributor_profiles WHERE credit_form IN ('name', 'name-and-nation') AND (credit_name IS NULL OR credit_name = '');

INSERT INTO contributor_placements (profile_identifier, item, in_book, on_website)
SELECT identifier, 'description', credit_in_book, credit_on_website
FROM contributor_profiles WHERE credit_form = 'role';

INSERT INTO contributor_placements (profile_identifier, item, in_book, on_website)
SELECT identifier, 'biography', credit_in_book, credit_on_website
FROM contributor_profiles WHERE biography_in_credits = 1 AND credit_form != 'role';

-- Pictures and specialties were shown on a contributor page whenever there was one.
INSERT INTO contributor_placements (profile_identifier, item, in_book, on_website)
SELECT identifier, 'picture', 0, 1 FROM contributor_profiles WHERE picture_key IS NOT NULL;

INSERT INTO contributor_placements (profile_identifier, item, in_book, on_website)
SELECT identifier, 'specialties', 0, 1 FROM contributor_profiles WHERE specialties != '[]' OR specialty_other IS NOT NULL;
