-- People can delete their own account (docs/contributor-profiles.md,
-- "Deleting an account"). Everything personal goes: the account, its
-- sessions and codes, and the contributor profile with every version. A
-- workspace member's row in `people` stays, because reviews, drafts and the
-- sealed activity log point to it, but its email address and sign-in are
-- removed and its name is kept or replaced, as the person chose.
--
-- When the person chooses to keep their name on work they helped with, the
-- credit line they last confirmed is kept here, with nothing else about them.

CREATE TABLE retained_credits (
	identifier TEXT PRIMARY KEY,
	section TEXT NOT NULL CHECK (section IN ('acknowledgments', 'reviewers', 'contributors')),
	line TEXT NOT NULL,
	sort_key TEXT NOT NULL,
	biography TEXT,
	in_book INTEGER NOT NULL,
	on_website INTEGER NOT NULL,
	retained_at TEXT NOT NULL
);
