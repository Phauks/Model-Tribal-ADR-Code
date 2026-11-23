-- Nation teams (decision record 0039; site/COLLABORATION.md, "Nation teams").
-- A Native nation chooses the people who keep its own page up to date. Each
-- place on a team is for one nation only; a steward adds and removes people
-- for that nation, at up to their own level and parts of the page. Every
-- change is also written to the activity log (events), under the target
-- 'grant' with the identifier 'nation-team/<nation identifier>'.
CREATE TABLE nation_team_members (
	identifier TEXT PRIMARY KEY,
	nation_identifier TEXT NOT NULL,
	person_identifier TEXT NOT NULL REFERENCES people (identifier),
	level TEXT NOT NULL CHECK (level IN ('reviewer', 'drafter', 'editor', 'steward')),
	-- JSON list of the parts of the page this place covers, or NULL for the whole page.
	page_parts TEXT,
	-- The person's title or office at the nation, as they or their steward gave it.
	office TEXT,
	-- For a place the project confirmed: how the nation chose them, such as
	-- "Letter of Nov. 18, 2026, confirmed by the Office of the President".
	basis TEXT,
	-- 1 when the project confirmed this person directly with the nation's
	-- office; a steward cannot end such a place, only the office through the project.
	added_by_project INTEGER NOT NULL DEFAULT 0 CHECK (added_by_project IN (0, 1)),
	-- Every place ends; it can be renewed.
	expires_at TEXT NOT NULL,
	granted_by TEXT NOT NULL REFERENCES people (identifier),
	granted_at TEXT NOT NULL,
	ended_at TEXT,
	ended_by TEXT REFERENCES people (identifier),
	-- 'changed' (replaced by a new place), 'ended', 'left', 'suspended' or 'expired'.
	end_reason TEXT CHECK (end_reason IN ('changed', 'ended', 'left', 'suspended', 'expired'))
);

-- At most one current place per person and nation.
CREATE UNIQUE INDEX nation_team_members_current
	ON nation_team_members (nation_identifier, person_identifier)
	WHERE ended_at IS NULL;

CREATE INDEX nation_team_members_by_person
	ON nation_team_members (person_identifier)
	WHERE ended_at IS NULL;

-- Requests to join a nation's team, sent from the profile page by someone
-- who is signed in. The proof itself is a file in the private sourceDocuments
-- bucket under nation-teams/<identifier>/, never published or put in git.
CREATE TABLE nation_team_applications (
	identifier TEXT PRIMARY KEY,
	-- Shown to the applicant, such as "NT-2026-0007".
	reference TEXT NOT NULL UNIQUE,
	-- accounts.identifier of the person who sent it.
	account_identifier TEXT NOT NULL,
	email TEXT NOT NULL,
	display_name TEXT NOT NULL,
	nation_identifier TEXT NOT NULL,
	office TEXT NOT NULL,
	route TEXT NOT NULL CHECK (route IN ('letter', 'resolution', 'office')),
	-- JSON list of parts asked for, or NULL for the whole page.
	page_parts TEXT,
	details TEXT,
	proof_key TEXT,
	proof_name TEXT,
	proof_type TEXT,
	status TEXT NOT NULL DEFAULT 'received' CHECK (
		status IN ('received', 'confirming-with-nation', 'confirmed', 'declined', 'withdrawn')
	),
	-- Which of the nation's own listed contacts the project wrote to, and when.
	-- Never a contact the applicant gave.
	office_contact TEXT,
	office_contacted_at TEXT,
	decided_by TEXT REFERENCES people (identifier),
	decided_at TEXT,
	-- Shown to the applicant when the request is declined.
	decision_note TEXT,
	submitted_at TEXT NOT NULL
);

CREATE INDEX nation_team_applications_open
	ON nation_team_applications (status, submitted_at);
