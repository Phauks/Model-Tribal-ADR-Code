-- The project's private address book (Trevor, Nov. 23, 2026: "We should have
-- internal contacts", and "Maintain this list in the server with knowledge or
-- source and up to dateness"). People and organizations, linked to a Native
-- nation where they belong to one, each with emails and phones that record
-- where they were read and when they were last seen there.
--
-- Private: only the lead author sees or changes these rows, on the
-- workspace's Address book page, and nothing here is shown on the public site.
-- A nation's general office email is also published in its profile; a
-- leader's own address from a directory is kept only here (lead author's
-- decision, Nov. 23, 2026).
--
-- Whether an email or phone is out of date is worked out when the page is
-- read (src/lib/address-book.ts), from verified_on, its label and
-- next_election_on, so the rule can change without a migration.
CREATE TABLE contacts (
	identifier TEXT PRIMARY KEY,
	kind TEXT NOT NULL CHECK (kind IN ('person', 'organization')),
	name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 300),
	-- For a person, the organization they act for, such as a nation's government.
	organization_identifier TEXT REFERENCES contacts (identifier),
	-- The nation's id in content/tribes, such as "hopi-tribe-of-arizona".
	nation_identifier TEXT CHECK (
		nation_identifier IS NULL OR (nation_identifier GLOB '[a-z0-9]*' AND nation_identifier NOT GLOB '*[^a-z0-9-]*')
	),
	-- A person's title or role, such as "Chairman" or "Tribal Administrator".
	role TEXT,
	notes TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	updated_by TEXT REFERENCES people (identifier)
);

CREATE INDEX contacts_by_nation ON contacts (nation_identifier);
CREATE INDEX contacts_by_organization ON contacts (organization_identifier);

CREATE TABLE contact_methods (
	identifier TEXT PRIMARY KEY,
	contact_identifier TEXT NOT NULL REFERENCES contacts (identifier),
	method TEXT NOT NULL CHECK (method IN ('email', 'phone')),
	-- An email in lower case, or a phone number as written.
	value TEXT NOT NULL CHECK (method <> 'email' OR (value = lower(value) AND value LIKE '%_@_%._%')),
	-- general-office: an office, reception, council or administration account.
	-- leader: an officeholder's own address or line, such as a chair's.
	-- state-listed: listed for the group by a state government, often a person's.
	label TEXT NOT NULL CHECK (label IN ('general-office', 'leader', 'state-listed', 'work', 'personal', 'other')),
	-- Where it was read.
	source_kind TEXT NOT NULL CHECK (
		source_kind IN ('nation-website', 'federal-directory', 'alaska-directory', 'state-directory', 'told-us', 'other')
	),
	source_label TEXT NOT NULL,
	source_link TEXT,
	-- The nation's name in the federal or Alaska directory, so a refresh can find its row again.
	directory_name TEXT,
	first_recorded_on TEXT NOT NULL,
	-- The last date someone, or a refresh, saw it at its source.
	verified_on TEXT NOT NULL,
	-- The nation's next election, when the federal directory gives one.
	next_election_on TEXT,
	-- current: in use. bounced: mail came back. replaced: the source now lists another.
	-- retired: not to be used, for the reason in the note.
	status TEXT NOT NULL DEFAULT 'current' CHECK (status IN ('current', 'bounced', 'replaced', 'retired')),
	-- The one to use first for this contact and method.
	preferred INTEGER NOT NULL DEFAULT 0 CHECK (preferred IN (0, 1)),
	note TEXT,
	updated_at TEXT NOT NULL,
	updated_by TEXT REFERENCES people (identifier),
	UNIQUE (contact_identifier, method, value)
);

CREATE INDEX contact_methods_by_contact ON contact_methods (contact_identifier, method, preferred DESC);
CREATE INDEX contact_methods_by_value ON contact_methods (method, value);
CREATE INDEX contact_methods_by_verified ON contact_methods (verified_on);

-- Free labels for finding and grouping contacts, such as "nation-government" or "advisor".
CREATE TABLE contact_tags (
	contact_identifier TEXT NOT NULL REFERENCES contacts (identifier),
	tag TEXT NOT NULL CHECK (tag GLOB '[a-z0-9]*' AND tag NOT GLOB '*[^a-z0-9-]*' AND length(tag) <= 60),
	PRIMARY KEY (contact_identifier, tag)
);

CREATE INDEX contact_tags_by_tag ON contact_tags (tag);

-- Every change to a contact or one of its emails or phones, with the row as it
-- was before. Rows are never changed or deleted. person_identifier is empty for
-- the first import and for changes the site makes by itself.
CREATE TABLE contact_changes (
	identifier TEXT PRIMARY KEY,
	contact_identifier TEXT NOT NULL REFERENCES contacts (identifier),
	-- The email or phone changed, when the change is to one.
	method_identifier TEXT REFERENCES contact_methods (identifier),
	-- What happened, such as "Imported", "Verified", "Marked bounced" or "Replaced at source".
	change TEXT NOT NULL,
	-- The row before the change, as JSON; empty for a new row.
	before TEXT,
	person_identifier TEXT REFERENCES people (identifier),
	created_at TEXT NOT NULL
);

CREATE INDEX contact_changes_by_contact ON contact_changes (contact_identifier, created_at);
