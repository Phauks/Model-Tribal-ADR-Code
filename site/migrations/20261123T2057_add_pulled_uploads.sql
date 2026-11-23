-- Marks uploads sent on the Intake page so they skip the review queue.
-- Explained in docs/uploads.md, "Intake". A workspace editor sends files for
-- the research library (pull-list items or general intake) on
-- /workspace/intake; they ask none of the contributor questions, stay out of
-- the review queue, and are filed into the research captures by
-- scripts/captures/mirror_captures.py intake.
ALTER TABLE uploads ADD COLUMN from_pull_list INTEGER NOT NULL DEFAULT 0 CHECK (from_pull_list IN (0, 1));

CREATE INDEX uploads_pull_list ON uploads (from_pull_list, status);
