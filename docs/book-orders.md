# Printed copies

Readers can order a printed copy of the book on the website at `/book`. Lulu's Print API prints each copy on demand and mails it; Stripe Checkout takes the payment. Ordering is **off** until the lead author decides who receives the money (see "Before ordering goes live" below). Decision record [0036](decisions/0036-order-printed-copies-through-the-lulu-print-api.md) explains why.

## How an order flows

1. The reader picks a size, binding, ink, paper and cover finish on `/book`, enters where the copy goes, and asks for the price. The page shows an estimate from Lulu's pricing calculator until then (`site/src/lib/book-order.ts`).
2. `/book/quote` asks Lulu's print-job cost calculation for that product, page count and address. Lulu's answer includes printing, shipping, its order fee and tax.
3. `/book/order` prices the order again, records it in the `book_orders` table, and opens a Stripe Checkout page for the reader's price: Lulu's total, plus `BOOK_MARGIN_CENTS`, plus Stripe's card fee (`readerPriceCents`).
4. When Stripe reports the payment at `/book/payment-webhook`, the order is marked paid once and sent to Lulu as a print job, with a 120-minute delay before printing so a mistake can still be canceled. Lulu charges the card on file in the project's Lulu API account.
5. Lulu downloads the interior and cover from `/book/files/...`, with a link key made from `BOOK_FILE_LINK_SECRET` for that one file.
6. Lulu reports status changes at `/book/printer-webhook` (topic `PRINT_JOB_STATUS_CHANGED`, signed with the API secret). The reader's page `/book/orders/<order>` shows the status and tracking link.
7. Name, address, telephone and email are cleared 90 days after an order ships, is canceled or expires.

## Prepared files

Lulu prints from two PDFs per copy: the interior and a one-page cover spread. They live in the private bucket under `books/<file set>/` with a `details.json` beside them:

```json
{ "title": "Model Tribal ADR Code", "pages": 312, "size": "us-trade", "binding": "paperback" }
```

The file set for a choice is `current/<size>/paperback` or `current/<size>/hardcover` (`fileSetFor`): the interior depends on the size, and the cover on the size, binding and page count. Ink, paper and finish do not change the files. The print build in `pdf/` already makes the interior for every size; it does not yet make covers.

## Still to build

- **Covers.** A cover spread sized from Lulu's cover-dimensions call (or the spine formula in `pdf/book-sizes.yaml`) for each size and binding.
- **Custom books.** Readers choosing parts and nations need the print build to run on demand. The plan is a Cloudflare Container running `pdf/` (Node, Typst, Python checks), started by the Worker, writing the two PDFs to `books/custom/<hash of the choices>/` so the same book is built once. Until then, readers can order only the prepared editions.
- **Publishing file sets.** A script that runs the print build for each size and uploads the PDFs and `details.json` with the bucket keys, like `scripts/captures/mirror_captures.py`.

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
| `STRIPE_WEBHOOK_SECRET` | Secret | The signing secret of the webhook endpoint `https://<site>/book/payment-webhook`, for `checkout.session.completed` and `checkout.session.expired`. |

Lulu's webhook is registered once with `POST /webhooks/` for topic `PRINT_JOB_STATUS_CHANGED` and URL `https://<site>/book/printer-webhook`.

## Before ordering goes live

The project becomes the seller of each copy. These are the lead author's decisions and duties; this list is project analysis, not legal or tax advice.

- **Who receives the money.** Payments land in the Stripe account that holds `STRIPE_SECRET_KEY`. Book sales count toward the 1023-EZ limit of $50,000 a year in gross receipts if the project incorporates as a nonprofit, so book receipts are tracked apart from gifts.
- **Sales tax.** Lulu charges tax on each print job to the project's card. Whether the project must also collect and remit sales tax on its own sale to the reader, register in Nevada or other states, or give Lulu a resale certificate, needs checking before `live`.
- **Refunds and misprints.** A paid order that Lulu refuses is marked `printer-refused`; the lead author fixes the file or refunds the reader from Stripe's dashboard. Lulu's own reprint policy for damaged copies applies to the project as Lulu's customer.
- **Privacy.** Addresses go to Lulu and are cleared here 90 days after shipping. The book page says so.
- **A webhook outage.** If Stripe's event never arrives, the order stays `awaiting-payment` while the reader has paid; check Stripe's dashboard against the table before refunding.
