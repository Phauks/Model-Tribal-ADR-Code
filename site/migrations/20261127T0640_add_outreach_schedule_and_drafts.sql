-- Lets an outreach batch start later, choose the inbox its replies go to, and save itself as a draft while it is written.
-- Explained in site/MAIL.md, "Outreach". The Outreach screens were redone to match the inbox (Trevor, Nov. 27, 2026).

-- When a started batch may send its first letter. Null starts at once. A
-- batch that is running but whose start is still ahead shows as Scheduled.
ALTER TABLE outreach_batches ADD COLUMN starts_at TEXT;

-- The project address replies go to, such as contact@. It decides the inbox
-- the batch's conversations are kept in. Null uses OUTREACH_REPLY_TO.
ALTER TABLE outreach_batches ADD COLUMN reply_address TEXT;

-- Who a batch being written goes to, as the address book filters chosen on
-- the New batch page, as JSON ({"tag":…,"label":…,"nationsOnly":…}). The
-- recipients themselves are added when the batch is started or scheduled.
ALTER TABLE outreach_batches ADD COLUMN audience TEXT;

-- When the batch was last changed, such as when its draft saved itself.
ALTER TABLE outreach_batches ADD COLUMN updated_at TEXT;
