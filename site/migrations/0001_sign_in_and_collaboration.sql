-- Sign-in, co-author permissions, reviews and requests from Native nations.
-- Design: site/COLLABORATION.md. Requests follow docs/requests.md.
--
-- Apply with: npx wrangler d1 migrations apply database --remote
-- (or --local for the copy that `npm run preview` uses).
--
-- Times are ISO 8601 strings in UTC. Status and outcome values are the
-- words docs/requests.md uses, so the database and the documentation match.

-- People who may sign in. Nobody can sign in until the lead author adds them
-- (the first lead author is matched by the LEAD_AUTHOR_EMAIL secret).
CREATE TABLE people (
	identifier TEXT PRIMARY KEY,
	-- The Auth0 user identifier ("sub" claim). Empty until the first sign-in.
	sign_in_subject TEXT UNIQUE,
	email TEXT NOT NULL UNIQUE COLLATE NOCASE,
	display_name TEXT NOT NULL,
	role TEXT NOT NULL CHECK (
		role IN ('lead-author', 'editor', 'co-author', 'advisor', 'nation-reviewer')
	),
	-- Only for nation reviewers: the content/tribes record they review for.
	nation_identifier TEXT,
	status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'removed')),
	added_by TEXT REFERENCES people (identifier),
	added_at TEXT NOT NULL,
	last_signed_in_at TEXT,
	CHECK ((role = 'nation-reviewer') = (nation_identifier IS NOT NULL))
);

-- Sign-offs and comments on content: a nation record, a glossary term, a
-- provision or an essay, at a content version.
CREATE TABLE reviews (
	identifier TEXT PRIMARY KEY,
	subject_kind TEXT NOT NULL CHECK (
		subject_kind IN ('nation', 'glossary-term', 'provision', 'essay')
	),
	subject_identifier TEXT NOT NULL,
	content_version TEXT NOT NULL,
	person_identifier TEXT NOT NULL REFERENCES people (identifier),
	-- The capacity the person reviewed in, kept even if their role changes later.
	capacity TEXT NOT NULL CHECK (capacity IN ('lead-author', 'editor', 'co-author', 'advisor', 'nation')),
	decision TEXT NOT NULL CHECK (decision IN ('approved', 'changes-requested', 'comment')),
	note TEXT,
	created_at TEXT NOT NULL
);

CREATE INDEX reviews_by_subject ON reviews (subject_kind, subject_identifier, created_at);

-- Requests to correct, restrict, remove, contribute, add a nation, or ask.
CREATE TABLE requests (
	identifier TEXT PRIMARY KEY,
	-- Shown to the requester, for example 20261121-K7QX3M.
	reference TEXT NOT NULL UNIQUE,
	kind TEXT NOT NULL CHECK (
		kind IN ('correct', 'restrict', 'remove', 'add-nation', 'contribute', 'question')
	),
	status TEXT NOT NULL DEFAULT 'received' CHECK (
		status IN (
			'received',
			'acknowledged',
			'hidden-pending-review',
			'checking-proof',
			'confirming-with-nation',
			'waiting-for-requester',
			'resolved'
		)
	),
	outcome TEXT CHECK (
		outcome IN ('corrected', 'restricted', 'withdrawn', 'added', 'answered', 'declined')
	),
	-- Given to the requester in writing when a request is declined.
	outcome_reason TEXT,
	-- Pages and records the request is about, one per line.
	material TEXT,
	-- The nation the request is about, as a content/tribes record when known.
	nation_identifier TEXT,
	-- Requester (deleted 12 months after resolution unless credited).
	requester_name TEXT,
	requester_nation TEXT,
	requester_role TEXT,
	writing_for_government INTEGER NOT NULL DEFAULT 0,
	contact TEXT,
	details TEXT,
	-- Contribute only.
	credit_preference TEXT,
	publication_permission TEXT CHECK (publication_permission IN ('publish', 'review-only')),
	-- Add a nation that is missing only.
	missing_nation_official_name TEXT,
	missing_nation_own_name TEXT,
	missing_nation_states TEXT,
	authority_statement TEXT CHECK (
		authority_statement IN ('authorized-by-government', 'not-writing-for-government')
	),
	-- Applying again keeps the earlier reference (docs/requests.md).
	earlier_reference TEXT,
	received_at TEXT NOT NULL,
	acknowledged_at TEXT,
	-- When the material named in a restrict or remove request was hidden.
	material_hidden_at TEXT,
	resolved_at TEXT,
	personal_details_deleted_at TEXT
);

CREATE INDEX requests_by_status ON requests (status, received_at);

-- Sources offered as proof for adding a nation, and other uploaded files.
CREATE TABLE request_sources (
	identifier TEXT PRIMARY KEY,
	request_identifier TEXT NOT NULL REFERENCES requests (identifier) ON DELETE CASCADE,
	source_kind TEXT CHECK (source_kind IN ('federal', 'state', 'petitioning', 'other-official')),
	title TEXT,
	citation TEXT,
	source_date TEXT,
	location_in_source TEXT,
	-- Key of the uploaded copy in the private sourceDocuments bucket, if any.
	file_key TEXT,
	file_name TEXT,
	file_type TEXT,
	file_size INTEGER
);

CREATE INDEX request_sources_by_request ON request_sources (request_identifier);

-- Who did what: role changes, request status changes, notes. Never deleted,
-- so permissions and decisions can be traced.
CREATE TABLE events (
	identifier TEXT PRIMARY KEY,
	-- Empty for actions by a requester or by the site itself.
	person_identifier TEXT REFERENCES people (identifier),
	action TEXT NOT NULL,
	target_kind TEXT NOT NULL CHECK (target_kind IN ('person', 'request', 'review')),
	target_identifier TEXT NOT NULL,
	note TEXT,
	created_at TEXT NOT NULL
);

CREATE INDEX events_by_target ON events (target_kind, target_identifier, created_at);
