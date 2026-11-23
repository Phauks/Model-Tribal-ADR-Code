# Printed copies

Readers can order a printed copy of the book on the website: the standard formats in one step from the Store ([store.md](store.md)), and any other choice as a special order at `/book`. Lulu's Print API prints each copy on demand and mails it; Stripe Checkout takes the payment. Ordering is **off** until the lead author decides who receives the money (see "Before ordering goes live" below). Decision record [0044](decisions/0044-order-printed-copies-through-the-lulu-print-api.md) explains why.

## How an order flows

1. The reader picks a size, binding, ink, paper and cover finish on `/book`, then enters only the country, state and postal code and asks for prices. The page shows an estimate from Lulu's pricing calculator until then (`site/src/lib/book-order.ts`).
2. `/book/quote` asks Lulu's print-job cost calculation for that product, page count and postal code once for each of the five shipping speeds (Mail, Priority Mail, Ground, Expedited, Express) and lists every speed Lulu prices, with its total. Lulu's answer includes printing, shipping, its order fee and tax. The page shows the chosen speed's price in parts (`priceParts` in `site/src/lib/server/book-orders.ts`): printing, shipping, Lulu's order fee, sales tax, the amount toward copies for Tribal Nations' courts (when `BOOK_MARGIN_CENTS` is set) and the card processing fee. The parts add up to the price.
3. The reader then enters the name, street, city, telephone and email the copy goes to, and may add a gift (see "Adding a gift" below). `/book/order` prices the order again with the full address and records it in the `book_orders` table. It then opens a Stripe Checkout page for the reader's price: Lulu's total, plus `BOOK_MARGIN_CENTS`, plus Stripe's card fee (`readerPriceCents`). A gift is a second line on that page.
4. When Stripe reports the payment at `/book/payment-webhook`, the order is marked paid once and sent to Lulu as a print job, with a 120-minute delay before printing so a mistake can still be canceled. Lulu charges the card on file in the project's Lulu API account.
5. Lulu downloads the interior and cover from `/book/files/...`, with a link key made from `BOOK_FILE_LINK_SECRET` for that one file.
6. Lulu reports status changes at `/book/printer-webhook` (topic `PRINT_JOB_STATUS_CHANGED`, signed with the API secret). The reader's page `/orders/<order>` shows the status and tracking link (the old address, `/book/orders/<order>`, is sent on to it).
7. Name, address, telephone and email are cleared 90 days after an order ships, is canceled or expires.

Lulu's cost calculation asks for a city. Prices by postal code send the placeholder city "City for price" (`addressForQuote`), and `/book/order` prices again with the real city before anything is charged. Whether Lulu's sandbox accepts the placeholder has not been tried yet, because there are no sandbox keys; check it on the first test order.

## Adding a gift

A buyer may add a gift to the project on the order page (`site/src/lib/checkout-gift.ts`, `site/src/lib/components/CheckoutGift.svelte`). The choices are No thanks, Round up to the next whole $5 (left out when the price already is one), $5, $10, $25 and Other ($1 to $1,000). No thanks is chosen until the buyer picks something else: a gift chosen in advance reads as a trick, and the EU bars pre-ticked extra payments (Directive 2011/83/EU, art. 22). The page shows the price, the gift and the total before the buyer goes to Stripe.

The gift goes to Stripe as its own line ("Gift to Model Tribal ADR Code") with `metadata[gift_cents]`, and is saved in `book_orders.gift_cents`, never in `price_cents`, so book receipts and gifts are counted apart. Lulu never receives it. The order's page thanks the buyer for it.

Stripe's own add-on features did not fit: optional items need saved Price records and cannot take a typed amount, a custom amount cannot sit beside another line, and Stripe's fee-coverage option is a private preview for nonprofits only. So the server works out the gift and sends it as an inline price.

In test mode the gift is always offered. In live mode it is offered only once `SPONSOR_GIFTS_RECEIVER` names who receives gifts, the same setting sponsor gifts need ([sponsorship.md](sponsorship.md)); until then the server refuses any gift above $0 (`site/src/lib/server/checkout-gifts.ts`).

Paid event tickets can reuse the same component when they come.

## Your orders and problems

An order placed while signed in is linked to that account (`book_orders.account_identifier`) and listed under Account, **Your orders** (`/account/orders`), with where it stands, what was paid and refunded, and the tracking link. An order placed while signed out keeps only its private link, `/orders/<order>`, which Stripe's receipt page returns to. It is never matched to an account by email, because the email on an order is not checked. Deleting the account unlinks its orders; the "Your data" download includes them.

Each paid order's page has a **Problem with this order?** form (`site/src/lib/book-order-problems.ts`). The buyer picks what went wrong and says what happened:

| Kind | What the buyer is told |
| --- | --- |
| It arrived damaged, It was printed wrong | A photo is required, because Lulu asks for photos taken with a phone or camera in good light before replacing a copy ("Providing digital defect images", help.lulu.com, read Nov. 23, 2026). |
| It never arrived | Report within 30 days of the day it shipped. Lulu replaces an order that failed to arrive when told within that time ("Shipping FAQ", help.api.lulu.com, read Nov. 23, 2026). |
| The address is wrong, Cancel the order | Possible only before printing starts, about two hours after payment (the print job's delay). |
| Return it or get a refund, Something else | The project decides each request. |

A photo is stored in the private bucket under `book-orders/<order>/<problem>` with `storeSentFile` and opened only with `openScannedFile` (site/SCANNING.md). An order may have at most five open problems at once, and the form shares the request form's rate limit, so a leaked link cannot flood the project.

Problems land on the workspace's **Orders** page (`/workspace/orders`, permission `manage-orders`, the lead author only), which lists every purchase from the Store ([store.md](store.md), "Orders for any purchase"). It lists every order with the buyer's name and email, Lulu's job and status, a link to the payment in Stripe's dashboard, and the problems still open. The lead author writes an answer, which shows on the buyer's order page, or closes the problem. Claims for a reprint go to Lulu through Lulu's support form, with the buyer's photo.

Refunds are made in Stripe's dashboard, then recorded on the Orders page as the total refunded so far, up to the price and gift together. The buyer's order page and Your orders then show "Refunded" with the amount and date.

Not built yet: emailing the buyer when the project answers, since outgoing email waits on the project's domain. Canceling or changing a print job through Lulu's API, and refunding through Stripe's API, are also left for later; Stripe's would need the restricted key to have write access to refunds.

## Prepared files

Lulu prints from two PDFs per copy: the interior and a one-page cover spread. They live in the private bucket under `books/<file set>/` with a `details.json` beside them:

```json
{ "title": "Model Tribal ADR Code", "pages": 312, "size": "us-trade", "binding": "paperback" }
```

The file set for a choice is `current/<size>/paperback` or `current/<size>/hardcover` (`fileSetFor`). Case wrap and linen wrap both print from the hardcover set. Ink, paper and finish do not change the files. Coil binding has no cover yet, so a reader who picks it is told the book is not ready in that binding.

To make and publish the file sets:

1. In `pdf/`, run `npm run build:editions`. It builds the interior at every size, then a paperback and a hardcover cover for each (`pipeline/cover.mjs`, `typst/cover.typ`), and checks each cover with `tools/check_cover.py`. The output is in `pdf/output/editions/current/`. Add `--trim us-trade` to build one size.
2. From the repository root, run `python3 scripts/books/publish_file_sets.py` to see the plan, then again with `--confirm` to upload. It sends `details.json` last, so a file set only appears once both PDFs are in the bucket.

### Cover sizes

| Binding | Spread | Spine | Source |
| --- | --- | --- | --- |
| Paperback | Both covers plus the spine, with 0.125 in bleed on every side | Pages / 444 + 0.06 in | Lulu, *Book Creation Guide*, pp. 10 and 13 |
| Hardcover (case wrap) | Each board is 0.25 in wider and 0.5 in taller than the pages (6.25 x 9.5 in for US Trade), and the artwork wraps 0.625 in around every edge | Lulu's table by page count, 0.25 in to 2.125 in | Lulu's cover templates from its pricing calculator; *Book Creation Guide*, p. 15 |

Text stays 0.5 in inside a paperback cover's edges and 0.625 in inside a hardcover board's edges, the spine side included, and 0.125 in inside the spine. The spine has text only from 100 pages (`pdf/book-sizes.yaml`). The sizes match the cover templates Lulu's pricing calculator gave on Nov. 23, 2026 for five sizes and page counts, and `pdf/tests/cover.test.mjs` checks them. When `LULU_CLIENT_KEY`, `LULU_CLIENT_SECRET` and `LULU_ENVIRONMENT` are set in the shell, `build:editions` also asks Lulu's cover-dimensions call for each cover and stops if the sizes differ by more than 0.02 in.

The cover text (title, author, edition, back cover paragraph) comes from `pdf/book.yaml`.

## Still to build

- **Custom books.** Readers choosing parts and nations need the print build to run on demand. The plan is a Cloudflare Container running `pdf/` (Node, Typst, Python checks), started by the Worker, writing the two PDFs to `books/custom/<hash of the choices>/` so the same book is built once. Until then, readers can order only the prepared editions.
- **Coil-bound covers.** Lulu's coil binding needs its own cover layout.
- **A barcode.** Copies sold through bookstores need an ISBN (decision record 0005). Lulu asks for the barcode on covers made outside its own tools ("Casewrap Books: The Basics"). The back cover has room for one but does not print it yet.

## Settings

All are set in the Cloudflare dashboard for the Worker, never in the repository (decision record 0006).

| Setting | Kind | What it is |
| --- | --- | --- |
| `BOOK_ORDERS` | Variable | `test` (Stripe test keys and Lulu's sandbox only; enforced) or `live`. Anything else keeps ordering off. |
| `BOOK_ORDERS_CONTACT_EMAIL` | Variable | The project's address Lulu writes to about a print job. |
| `BOOK_MARGIN_CENTS` | Variable | Added to each copy toward copies sent to nations. Default 0. |
| `BOOK_FILE_LINK_SECRET` | Secret | Any long random text; signs the links Lulu downloads files from. |
| `LULU_ENVIRONMENT` | Variable | `sandbox` or `production`. |
| `LULU_CLIENT_KEY`, `LULU_CLIENT_SECRET` | Secrets | From the Lulu developer portal (separate accounts for sandbox and production). |
| `STRIPE_SECRET_KEY` | Secret | A restricted key is enough: write access to Checkout Sessions. |
| `SPONSOR_GIFTS_RECEIVER` | Variable | Who receives gifts. In live mode the order page offers a gift only when this is set. |
| `STRIPE_WEBHOOK_SECRET` | Secret | The signing secret of the webhook endpoint `https://<site>/book/payment-webhook`, for `checkout.session.completed` and `checkout.session.expired`. |

Lulu's webhook is registered once with `POST /webhooks/` for topic `PRINT_JOB_STATUS_CHANGED` and URL `https://<site>/book/printer-webhook`.

## Before ordering goes live

The project becomes the seller of each copy. These are the lead author's decisions and duties; this list is project analysis, not legal or tax advice.

- **Who receives the money.** Payments land in the Stripe account that holds `STRIPE_SECRET_KEY`. Book sales count toward the 1023-EZ limit of $50,000 a year in gross receipts if the project incorporates as a nonprofit, so book receipts are tracked apart from gifts.
- **Sales tax.** Lulu charges tax on each print job to the project's card. Whether the project must also collect and remit sales tax on its own sale to the reader, register in Nevada or other states, or give Lulu a resale certificate, needs checking before `live`.
- **Refunds and misprints.** A paid order that Lulu refuses is marked `printer-refused`; the lead author fixes the file or refunds the reader from Stripe's dashboard and records it on the Orders page. Lulu's own reprint policy for damaged copies applies to the project as Lulu's customer. Whether to accept returns of copies that arrived as ordered is the lead author's decision; the order page says the project decides each request.
- **Privacy.** Addresses go to Lulu and are cleared here 90 days after shipping. The book page says so.
- **A webhook outage.** If Stripe's event never arrives, the order stays `awaiting-payment` while the reader has paid; check Stripe's dashboard against the table before refunding.
