-- Links printed-copy orders to the account that placed them, records refunds, and adds problems buyers report about an order.
-- Account, Orders lists the orders placed while signed in; an order placed signed out keeps only its private link, and is never matched to an account by email, because the email on an order is not checked (docs/book-orders.md, "Your orders and problems"). Refunds are made in Stripe's dashboard and recorded here, so the order page can say so. A problem is what the buyer reports from the order's page: a damaged or misprinted copy (with a photo, which Lulu asks for), a copy that never arrived, a wrong address, or a request to cancel, return or refund. The lead author answers it on the workspace's Book orders page.

ALTER TABLE book_orders ADD COLUMN account_identifier TEXT REFERENCES accounts (identifier) ON DELETE SET NULL;
ALTER TABLE book_orders ADD COLUMN refunded_cents INTEGER NOT NULL DEFAULT 0 CHECK (refunded_cents >= 0);
ALTER TABLE book_orders ADD COLUMN refunded_at TEXT;

CREATE INDEX book_orders_by_account ON book_orders (account_identifier, created_at);

CREATE TABLE book_order_problems (
	identifier TEXT PRIMARY KEY,
	order_identifier TEXT NOT NULL REFERENCES book_orders (identifier) ON DELETE CASCADE,
	kind TEXT NOT NULL CHECK (kind IN ('damaged', 'misprinted', 'never-arrived', 'wrong-address', 'cancel', 'return-or-refund', 'other')),
	details TEXT NOT NULL CHECK (length(details) BETWEEN 1 AND 4000),
	-- A photo of the copy in the sourceDocuments bucket under book-orders/<order>/<problem>, held until the virus check passes (site/SCANNING.md).
	photo_key TEXT,
	photo_type TEXT,
	status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered', 'closed')),
	-- What the project wrote back; shown on the order's page.
	answer TEXT CHECK (answer IS NULL OR length(answer) <= 4000),
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE INDEX book_order_problems_by_order ON book_order_problems (order_identifier, created_at);
CREATE INDEX book_order_problems_by_status ON book_order_problems (status, created_at);
