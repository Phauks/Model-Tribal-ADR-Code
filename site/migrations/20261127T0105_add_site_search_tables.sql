-- Adds the tables the site search reads on the server until a reader's device has the search files.
-- Design: src/lib/server/search-tables.ts. The Worker fills them from the
-- built /search/index.json and /search/records.json, filtered by what nations
-- chose to hide, and fills them again whenever the build or the restrictions
-- change. They hold names and links only, as the public files do, so nothing
-- here is private, and they can be emptied at any time: the Worker refills them.

-- One search result: its group, what the panel shows for it (JSON), and its
-- title, other names and detail line folded together, or nothing when it has
-- no detail line. Position is its place in the index, which breaks ties.
CREATE TABLE site_search_entries (
	position INTEGER PRIMARY KEY,
	kind TEXT NOT NULL,
	result TEXT NOT NULL,
	everything TEXT NOT NULL
);

-- Each name that finds a result, folded: its title (rank 0), another name
-- (rank 1, shown as "also called") or the name of a set it belongs to (rank 2,
-- shown as the set's first name). Words holds the name's words between spaces.
CREATE TABLE site_search_names (
	position INTEGER NOT NULL,
	rank INTEGER NOT NULL,
	ordinal INTEGER NOT NULL,
	shown TEXT,
	folded TEXT NOT NULL,
	words TEXT NOT NULL,
	PRIMARY KEY (position, ordinal)
);

-- Each law or governing document the records file lists: what the panel shows
-- (JSON) and its title, kind, year and nation folded together.
CREATE TABLE site_search_documents (
	position INTEGER PRIMARY KEY,
	result TEXT NOT NULL,
	words TEXT NOT NULL
);

-- What the tables were filled from (key: the index file's version and the
-- restrictions' stamp; content: a hash of the rows) and when a fill started.
CREATE TABLE site_search_state (
	name TEXT PRIMARY KEY,
	value TEXT NOT NULL
);
