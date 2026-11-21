-- Registration and profiles for people who help with the project.
-- Design: docs/contributor-profiles.md. Decision record 0022.
--
-- History is written to `events` with target_kind 'profile', which
-- migration 0002 (permission tiers) adds to the allowed targets.
--
-- Apply with: npx wrangler d1 migrations apply database --remote
-- (or --local for the copy that `npm run preview` uses).
--
-- A profile is separate from `people`: anyone with a verified email address
-- may register and keep a profile, but only the lead author gives access to
-- the workspace, by linking a profile to a row in `people`.

CREATE TABLE contributor_profiles (
	identifier TEXT PRIMARY KEY,
	-- The Auth0 user identifier ("sub" claim) of the account that owns it.
	sign_in_subject TEXT NOT NULL UNIQUE,
	-- Verified by Auth0 at sign-in; changed only by signing in again.
	email TEXT NOT NULL COLLATE NOCASE,
	-- Set when the person also has workspace access.
	person_identifier TEXT UNIQUE REFERENCES people (identifier),
	status TEXT NOT NULL DEFAULT 'draft' CHECK (
		status IN ('draft', 'submitted', 'welcomed', 'declined')
	),

	-- About the person. Only the email address is required (it comes from
	-- sign-in); every other field may be empty until the person confirms.
	given_name TEXT,
	family_name TEXT,
	phone TEXT,
	preferred_contact TEXT CHECK (preferred_contact IN ('email', 'phone', 'text-message')),
	adult_confirmed INTEGER NOT NULL DEFAULT 0,
	-- 'listed': the nations are in contributor_nations. Never required.
	nation_answer TEXT CHECK (nation_answer IN ('listed', 'none', 'not-saying')),
	background TEXT,
	languages TEXT,
	organization TEXT,
	availability TEXT CHECK (availability IN ('occasionally', 'monthly', 'weekly')),

	-- How the person wants to be credited, using the forms of
	-- schemas/common.schema.json $defs.credit (docs/contributions.md).
	credit_form TEXT CHECK (credit_form IN ('name', 'name-and-nation', 'role', 'pseudonym', 'none')),
	-- The name as it should be printed, when it differs from given + family.
	credit_name TEXT,
	credit_role TEXT,
	credit_pseudonym TEXT,
	credit_in_book INTEGER NOT NULL DEFAULT 1,
	credit_on_website INTEGER NOT NULL DEFAULT 1,
	-- A few sentences for the list of contributors, shown only if chosen.
	biography TEXT,
	biography_in_credits INTEGER NOT NULL DEFAULT 0,

	-- Set by the project, not the person: where the credit goes in the book.
	credit_section TEXT CHECK (
		credit_section IN ('acknowledgments', 'reviewers', 'contributors', 'advisors')
	),

	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	-- The latest version the person confirmed on the review page. Credits are
	-- always taken from this version, never from unconfirmed edits.
	confirmed_version INTEGER,
	confirmed_at TEXT,
	submitted_at TEXT,
	decided_at TEXT,
	decided_by TEXT REFERENCES people (identifier),
	-- Given to the person when a registration is declined.
	decision_note TEXT
);

CREATE INDEX contributor_profiles_by_status ON contributor_profiles (status, submitted_at);

-- Native nations a person lists, in their own words. Never verified, never
-- required, and listing one does not mean speaking for it.
CREATE TABLE contributor_nations (
	identifier TEXT PRIMARY KEY,
	profile_identifier TEXT NOT NULL REFERENCES contributor_profiles (identifier) ON DELETE CASCADE,
	-- The content/tribes record, when the nation is in the project's list.
	nation_identifier TEXT,
	-- The name as the person wrote it, or the record's name.
	nation_name TEXT NOT NULL,
	-- How the person describes the connection, in their own words.
	connection TEXT,
	show_in_credit INTEGER NOT NULL DEFAULT 0,
	position INTEGER NOT NULL
);

CREATE INDEX contributor_nations_by_profile ON contributor_nations (profile_identifier, position);

-- What a person would like to help with.
CREATE TABLE contributor_interests (
	profile_identifier TEXT NOT NULL REFERENCES contributor_profiles (identifier) ON DELETE CASCADE,
	interest TEXT NOT NULL CHECK (
		interest IN (
			'write',
			'review',
			'share-knowledge',
			'research',
			'translate',
			'art',
			'outreach',
			'website'
		)
	),
	PRIMARY KEY (profile_identifier, interest)
);

-- Every version the person confirmed, as they saw it on the review page,
-- with the credit line exactly as it was previewed. Deleted with the profile.
CREATE TABLE contributor_profile_versions (
	profile_identifier TEXT NOT NULL REFERENCES contributor_profiles (identifier) ON DELETE CASCADE,
	version INTEGER NOT NULL,
	snapshot TEXT NOT NULL,
	credit_line TEXT,
	confirmed_at TEXT NOT NULL,
	PRIMARY KEY (profile_identifier, version)
);
