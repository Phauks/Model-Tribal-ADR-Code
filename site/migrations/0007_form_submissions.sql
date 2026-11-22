-- Forms sent through the website's Forms pages (docs/contributions.md,
-- "On the website"; decision record 0020). Each form sent opens a request,
-- so the workspace's request handling, statuses and history apply to it; this
-- table says which form and version was signed and how. A form filled in
-- online also has a copy of the filled form in the private sourceDocuments
-- bucket under forms/<request>/<submission>.md, written once. A signed paper
-- copy that was uploaded is a file of the request, in request_sources.
CREATE TABLE form_submissions (
	identifier TEXT PRIMARY KEY,
	request_identifier TEXT NOT NULL REFERENCES requests (identifier),
	-- The form's page name, such as "contributor-statement".
	form TEXT NOT NULL CHECK (form GLOB '[a-z0-9]*' AND form NOT GLOB '*[^a-z0-9-]*'),
	-- The ids written at the top of the form, space separated, such as "interview-consent interview-release".
	form_identifiers TEXT NOT NULL,
	form_version TEXT NOT NULL,
	-- SHA-256 of the form's file when the site was built, so the exact words signed can be found in git.
	form_checksum TEXT NOT NULL,
	method TEXT NOT NULL CHECK (method IN ('online', 'paper-upload')),
	-- The name typed in the signature line, for a form signed online.
	signed_name TEXT,
	signed_at TEXT,
	-- The answers given online, as JSON: {"f12": "text", "f13": "on"}.
	answers TEXT,
	-- The filled form in the bucket, for a form filled in online.
	filled_copy_key TEXT UNIQUE,
	-- Given by an editor in the workspace, such as filing-2026-0001.
	filing_identifier TEXT CHECK (
		filing_identifier IS NULL OR filing_identifier GLOB 'filing-[0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9]'
	),
	received_at TEXT NOT NULL
);

CREATE INDEX form_submissions_by_request ON form_submissions (request_identifier);
CREATE INDEX form_submissions_by_filing ON form_submissions (filing_identifier);
