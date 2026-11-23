# 0050. Give sponsors an account page, with billing on Stripe's own pages

- **Status:** Proposed (gifts stay off until the lead author decides who receives the money)
- **Date:** 2026-11-23

## Context

The project's design note on donations and sponsorship proposed that organizations could sponsor the work. Trevor Goldsmith then asked: "Sponsors should get their own page on the website as well, or profile. So they can update payment info and other settings? Similar to a user account I guess" (2026-11-23). A mockup showed the page on the Account pages, a public list on the Sponsorship page, and each sponsor's own page; he chose "Build it as shown". He also asked: "From admin, make it so I can see sponsorship page, that way I can fully diagnose" (2026-11-23).

Who receives the money is still undecided, and the nonprofit route requires the corporation and Nevada's charitable registration before anyone is asked for a gift (project memory, "donations-and-books").

## Decision

- A sponsorship is set up by any signed-in account at Account → Sponsorship (`/account/sponsorship`). Everyone who manages it can change everything on it; there is one kind of manager. A manager adds another by an invitation link that works once for 14 days, because account email addresses are not yet verified by email.
- Payment details never reach the site. A gift is made on Stripe Checkout (a subscription for a monthly gift), and the card, amount, billing address, cancelling and receipts are on Stripe's own billing page (the customer portal). Each sponsor has its own Stripe customer in each mode, and gifts are matched to the sponsor by that customer.
- Gifts are off unless `SPONSOR_GIFTS` is `test` (a Stripe test key only) or `live` (a live key and `SPONSOR_GIFTS_RECEIVER`, which names who receives the money). Gifts have their own Stripe webhook endpoint and signing secret, apart from printed copies, so each can be switched on alone.
- A sponsor shows in public only after a gift, only as they chose (name, logo and link; name only; as "a sponsor"; or not at all), and never with the amount. The lead author can take a sponsor off the public pages with a note.
- The lead author has a Sponsors page in the workspace that shows which gift settings are missing or wrong, every sponsor with why they show in public or not, each sponsor's gifts and history, and asks Stripe about a sponsor on request. From there the lead author opens any sponsor's Account page as its managers see it, read only.
- The Sponsorship page shows a link to give only while gifts are open.

## Consequences

- New tables `sponsors`, `sponsor_managers`, `sponsor_invitations`, `sponsor_gifts` and `sponsor_history` (migration `20261123T0448_add_sponsor_accounts.sql`), a permission `manage-sponsors` for the lead author, and three Worker settings in Cloudflare (decision record 0006).
- Stripe's customer portal must be set up once in Stripe's dashboard for each mode before the billing button works.
- Receipts for tax purposes, and the Nevada solicitation disclosure, depend on who receives the money and are settled before `live` (docs/sponsorship.md, "Before gifts go live").
- Deleting an account removes the person as a manager and their email address from the sponsorship's history; the sponsorship stays with its other managers.

## Sources

- Trevor Goldsmith, project thread "Set up donations and book ordering", 2026-11-23.
- Stripe, "Customer portal", <https://docs.stripe.com/customer-management>, and "Create a portal session", <https://docs.stripe.com/api/customer_portal/sessions/create>.
- Stripe, "Create a Checkout Session", <https://docs.stripe.com/api/checkout/sessions/create>, and "Using webhooks with subscriptions", <https://docs.stripe.com/billing/subscriptions/webhooks>.
- Decision records [0006](0006-secrets-only-in-cloudflare.md) and [0044](0044-order-printed-copies-through-the-lulu-print-api.md).
