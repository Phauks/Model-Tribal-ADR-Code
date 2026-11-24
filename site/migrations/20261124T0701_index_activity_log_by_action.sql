-- Adds an index on the activity log's action column for faster counts.
-- The workspace Overview and the Access page count refused attempts in the last thirty days and find the latest one on every load (src/lib/server/administration.ts), which read the whole events table before. With this index SQLite reads only the entries with that action, and the index's built-in sequence order gives the latest one directly.
CREATE INDEX events_by_action ON events (action);
