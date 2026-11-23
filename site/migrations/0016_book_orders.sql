-- Printed copies ordered on the website (docs/book-orders.md). Payment is
-- taken by Stripe Checkout; Lulu's Print API prints and mails the copy. Each
-- row holds what the reader chose, the price Lulu quoted for that address,
-- and where the order stands. The reader's name, address, telephone and
-- email are kept only until the copy has shipped and the time to report a
-- problem has passed (book_orders.personal_details_removed_at).
CREATE TABLE book_orders (
	-- Random and hard to guess: the order's page is /book/orders/<identifier>.
	identifier TEXT PRIMARY KEY CHECK (length(identifier) >= 20),
	-- 'test' orders use Stripe test keys and Lulu's sandbox, which never print or charge.
	mode TEXT NOT NULL CHECK (mode IN ('test', 'live')),
	status TEXT NOT NULL CHECK (
		status IN ('awaiting-payment', 'paid', 'sent-to-printer', 'printer-refused', 'shipped', 'canceled', 'expired')
	),
	-- The prepared files in the sourceDocuments bucket, under books/<file_set>/.
	file_set TEXT NOT NULL,
	title TEXT NOT NULL,
	pod_package_identifier TEXT NOT NULL,
	page_count INTEGER NOT NULL CHECK (page_count BETWEEN 32 AND 800),
	-- The reader's choices as JSON (src/lib/book-order.ts, PrintChoice).
	choice TEXT NOT NULL,
	shipping_level TEXT NOT NULL,
	-- Lulu's quote for this address, tax included, in cents.
	printer_cost_cents INTEGER NOT NULL CHECK (printer_cost_cents > 0),
	-- What the reader pays, in cents.
	price_cents INTEGER NOT NULL CHECK (price_cents >= printer_cost_cents),
	-- Personal details, cleared after delivery.
	recipient_name TEXT,
	-- The shipping address as JSON in Lulu's form.
	shipping_address TEXT,
	email TEXT,
	personal_details_removed_at TEXT,
	payment_session TEXT UNIQUE,
	print_job INTEGER UNIQUE,
	printer_status TEXT,
	printer_message TEXT,
	tracking_link TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE INDEX book_orders_by_status ON book_orders (status, updated_at);
