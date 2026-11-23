# 0044. Order printed copies on the website through the Lulu Print API

- **Status:** Proposed (ordering stays off until the lead author decides who receives the money)
- **Date:** 2026-11-23

## Context

The website and its downloads are free. Trevor Goldsmith asked that readers also be able to buy a printed book, including custom builds and formats such as a large-format book: "We should add functionality to website to have it created" (2026-11-23). Of the options in the project's design note on donations and book ordering, he then chose to "build the API" (2026-11-23). Decision record 0005 already prints through Lulu. Lulu offers three ways to sell: its own bookstore and retail distribution, Lulu Direct buy buttons for fixed products, and the Print API. With the Print API, the seller's own site sends the files and the address, and Lulu prints and ships ([Lulu API Guide to Getting Started](https://assets.lulu.com/media/guides/en/lulu-api-getting-started-guide.pdf)). Only the Print API lets a reader order a book whose contents they chose.

## Decision

- The site has an order page at `/book` and the Worker routes behind it (docs/book-orders.md). Lulu's cost calculation prices each order for the reader's address; Stripe Checkout takes the payment on Stripe's own page; a paid order becomes a Lulu print job with a two-hour delay before printing.
- Ordering is off unless `BOOK_ORDERS` is set. `test` refuses to run unless Lulu's sandbox and a Stripe test key are configured, so it can never charge or print; `live` refuses unless both are in production mode.
- The reader pays Lulu's quote (printing, shipping, Lulu's $0.75 order fee and tax) plus Stripe's card fee and an optional margin set in `BOOK_MARGIN_CENTS`.
- Personal details are kept only as long as needed: cleared 90 days after an order ends.
- Prepared editions come first. Custom books follow once the print build can run on demand (planned: a Cloudflare Container running `pdf/`).

## Consequences

- The project becomes the seller of record for each copy: sales tax, refunds and support are its duties (docs/book-orders.md, "Before ordering goes live").
- New Worker secrets and variables, all in Cloudflare (decision record 0006), and a new table `book_orders` (migration 0016).
- Lulu Direct buy buttons and retail distribution stay possible for the standard editions; this does not rule them out.

## Sources

- Trevor Goldsmith, project thread "Set up donations and book ordering", 2026-11-23.
- Lulu Print API OpenAPI description, <https://api.lulu.com/api-docs/openapi-specs/openapi_public.yml>, read 2026-11-23.
- Lulu, "Per Order Fulfillment Fee", <https://help.api.lulu.com/en/support/solutions/articles/64000265990-per-order-fulfillment-fee>.
- Stripe, pricing, <https://stripe.com/pricing>, read 2026-11-23.
- Decision records [0005](0005-print-with-lulu.md) and [0006](0006-secrets-only-in-cloudflare.md).
