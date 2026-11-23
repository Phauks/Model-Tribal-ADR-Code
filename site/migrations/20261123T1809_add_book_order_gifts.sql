-- Adds an optional gift to the project on each printed-copy order, kept apart from the book's price.
-- The buyer picks it on the order page and it is its own line on Stripe's page (docs/book-orders.md, "Adding a gift"). Book receipts and gifts are counted separately, so the gift never goes into price_cents.

ALTER TABLE book_orders ADD COLUMN gift_cents INTEGER NOT NULL DEFAULT 0 CHECK (gift_cents >= 0);
