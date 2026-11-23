# Store

The Store (`/store`) is where readers buy the book, and later merchandise. It is a section in the left sidebar, which opens to Books and Special order. Trevor asked for it on Nov. 23, 2026: one page for books and merchandise, the standard formats of the book bought in one easy step, and the full order page kept as a special order. Ordering stays **off** until the lead author decides who receives the money ([book-orders.md](book-orders.md), "Before ordering goes live").

## What it sells

| Item | Where it is listed | Who makes it |
| --- | --- | --- |
| Paperback, 6 × 9 in | Books, bought in one step | Lulu |
| Hardcover, 6 × 9 in | Books, bought in one step | Lulu |
| Large paperback, 8.5 × 11 in | Books, bought in one step | Lulu |
| Every other size, binding, paper and ink | Special order (`/book`) | Lulu |
| Merchandise | Not shown until an item can be bought | Not chosen yet |

The standard formats are listed in `site/src/lib/store.ts` (`standardFormats`). Each card shows Lulu's printing estimate for a 300-page copy, before shipping, tax and the card fee, the same estimate the special-order page uses until the first edition exists.

## Buying in one step

A standard format's cart button opens a dialog. The buyer enters the country, state and postal code and asks for prices; `/book/quote` returns Lulu's price for every shipping speed. The buyer picks a speed, may add a gift (No thanks is chosen until they pick something else, as on the special-order page), and pays.

`/store/checkout` prices the copy again with Lulu and records the order with only the country, state and postal code. Stripe's page then asks for the name, street address, telephone and email, in that one country only (`shipping_address_collection` and `phone_number_collection` in the Checkout Session). When Stripe reports the payment, `/book/payment-webhook` takes the address from the session (`collected_information.shipping_details`, or `shipping_details` in older Stripe API versions) and sends the copy to Lulu.

Lulu's price, tax included, depends on the postal code, so the webhook checks that the postal code given on Stripe's page is the one the copy was priced for (the first five digits for the United States). If it is not, the order is marked "Could not be made" with the reason, and the lead author orders the copy by hand or refunds it from the workspace's Orders page.

## Orders for any purchase

Trevor asked on Nov. 23, 2026 for one orders screen for every kind of purchase. Each order is shown as lines (`site/src/lib/orders.ts`): what was bought, its details, the quantity and the company that makes it, with that company's job number in the workspace. A printed copy's line uses the Store's name for a standard format and "Special order" for anything else. Statuses are general: Not paid, Paid, Being made, Could not be made, Shipped, Canceled and Expired.

- **Workspace, Orders** (`/workspace/orders`, permission `manage-orders`, the lead author only): problems buyers report come first, each naming the order's items, then every order, filtered by kind (All, Books, Merchandise) and by status. Answers and refunds work as described in [book-orders.md](book-orders.md), "Your orders and problems".
- **Your orders** (`/account/orders`): the buyer's orders with their items, what was paid, where each stands and the tracking link.
- **An order's page** (`/orders/<order>`): where it stands and the "Problem with this order?" form. Links to the old address, `/book/orders/<order>`, are sent on to it.

Only books are sold for now, so the orders are still kept in the `book_orders` table and shown as lines. A general orders table comes with the first item that is not a printed copy.

## Merchandise

Trevor said on Nov. 23, 2026 that, for now, everything sold is books, printed by Lulu. Merchandise is listed in `site/src/lib/store.ts` (`merchandise`), and the Store shows a Merchandise section only once an item there is `available` with a price.

When merchandise comes, the project picks a print-on-demand provider. The options looked at on Nov. 23, 2026 (project analysis from each company's own pages, not legal or tax advice):

| Provider | Who is the seller | Fits |
| --- | --- | --- |
| Printful | The project, through its own checkout ("Submit orders, manage sales, generate mockups" by API, printful.com/api) | One cart, one gift step and one Orders screen with the books. The project collects sales tax, as it must decide for books anyway. |
| Fourthwall | Fourthwall, which says it is "the Merchant of Record" and collects and remits sales tax (help.fourthwall.com, "Creator tax information") | The least work on tax. Orders happen on Fourthwall's own checkout, so they would not appear on the Orders screen without an import. |
| Bonfire | Not stated on its nonprofit pages | A 501(c)(3): verified nonprofit badges and lower fees on added donations (bonfire.com/online-stores/nonprofits). |

Art comes from Native artists the project commissions, never from made-up motifs (site/DESIGN.md). No item may be offered in a way that suggests it is Indian-made unless it is. Under the Indian Arts and Crafts Act, a tribe, an Indian or an Indian arts and crafts organization may sue for the greater of treble damages or $1,000 for each day the item is offered or sold (25 U.S.C. § 305e(b), (d)).
