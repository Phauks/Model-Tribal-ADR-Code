-- What a nation that has claimed its page chooses the site shows of its own
-- laws and its own courts' opinions (decision record 0056; design in
-- design/nation-restrictions/). Each save adds a row holding the whole
-- setting, and the newest row for a nation is the one in force, so every
-- earlier setting stays for the project's review. The rows are never copied
-- into git: the repository's history is public, and a list of restricted
-- items would point at exactly what a nation asked to keep out of view.
-- Every save is also written to the activity log (events), under the target
-- 'document' with the identifier 'nation-page/<nation identifier>'.
CREATE TABLE nation_restriction_changes (
	identifier TEXT PRIMARY KEY,
	nation_identifier TEXT NOT NULL,
	-- JSON: {"kinds": {"opinions": "cite"}, "items": {"copy:<key>": "show"}},
	-- as src/lib/nation-restrictions.ts reads it. The whole setting after this save.
	settings TEXT NOT NULL,
	-- JSON: what this save changed, one entry per kind or item, for the
	-- project's queue and the team's activity.
	changes TEXT NOT NULL,
	-- The team's note to the project, which only the project sees.
	note TEXT,
	made_by TEXT NOT NULL REFERENCES people (identifier),
	made_at TEXT NOT NULL,
	-- The project read it (within 7 days). A nation's choice about its own
	-- laws and opinions stands, so there is no undo (charter, commitment 6).
	read_by TEXT REFERENCES people (identifier),
	read_at TEXT,
	read_note TEXT,
	-- The project's question to the team, and the team's answer.
	question TEXT,
	asked_by TEXT REFERENCES people (identifier),
	asked_at TEXT,
	answer TEXT,
	answered_by TEXT REFERENCES people (identifier),
	answered_at TEXT
);

CREATE INDEX nation_restriction_changes_by_nation ON nation_restriction_changes (nation_identifier, made_at);
CREATE INDEX nation_restriction_changes_unread ON nation_restriction_changes (read_at, made_at);
