# Sponsorship

Organizations, and people, can sponsor the project: give once or every month, choose what their gift goes toward, and choose how the project thanks them in public. The design is decision record [0050](decisions/0050-sponsor-accounts-on-the-account-pages.md). Gifts stay off until the lead author decides who receives the money.

## Pages

| Address | Who sees it | What it does |
| --- | --- | --- |
| `/account/sponsorship` | Anyone signed in | Starts a sponsorship; for its managers, gives, opens Stripe's billing page, sets the listing, logo and where the gift goes, and adds or removes managers |
| `/account/sponsorship?sponsor=<identifier>` | The sponsorship's managers, and the lead author | One sponsorship, when an account manages more than one; for the lead author, any sponsor's page as its managers see it, read only |
| `/sponsorship/invite/<link>` | Anyone signed in | Accepts an invitation to manage a sponsorship |
| `/sponsor` | Everyone | The Sponsorship page's own text (edited on the website), the goal of a copy for every nation, what else a gift can fund, then every sponsor shown in public; a link to give only while gifts are open |
| `/sponsors/<name>` | Everyone | One sponsor listed by name, once they have given |
| `/workspace/sponsors` | The lead author | Whether gifts work, setting by setting, and every sponsor |
| `/workspace/sponsors/<identifier>` | The lead author | One sponsor's details, managers, gifts with amounts and history; take off or put back on the public pages; ask Stripe about them |
| `/sponsorship/payment-webhook` | Stripe | Records paid gifts |

## The Sponsorship page

The page is built to match mockup A, which Trevor approved on Nov. 23, 2026, with his two changes: no amounts for one state's nations (two sponsors could pay for the same nations), and no cost fixed in the code, because printing and hosting prices are not settled. On Nov. 24, 2026 he named the goal of a copy for every nation an initiative, so the cause is easy to identify (its name is `initiativeName` in `src/lib/sponsorship.ts`), and renamed the other choices. It shows:

- a band with the page's own text (edited on the website like the essays), whose heading is the initiative's name, the initiative's three levels, and the gift form. Level 1 is a paperback for every federally recognized nation; level 2 is a paperback for every nation recognized by the United States or by a state, counting a nation recognized by both once; level 3 is a paperback for every Identified Native Nation, meaning every nation with a page on the site (Trevor, Nov. 24, 2026). The counts come from the nation records when the site is built. Copies paid for fill level 1 first and count toward each later level too, since each includes the ones before it. Under each level's bar, a tracker gives the share paid for, the nations still to go, and what finishing it would cost at the paperback's price;
- three counts taken when the site is built: Identified Native Nations (nations with their own page), sources recorded and cited, and what reading costs ($0). Once at least three sponsors give monthly, a fourth shows what monthly gifts bring in each month and how many sponsors give them; with fewer, the total could tell anyone what one sponsor gives, so it is left out of the page's data altogether. Each sponsor counts once, at their latest monthly invoice in the last 35 days, so a gift that ends drops out a month after its last invoice;
- "More you can fund": hardcovers for every nation, Accessibility Formats, Research, Digital Infrastructure (the site for a year) and Discretionary, each with a heart button to sponsor it; a card without a cost set says "Any";
- the sponsors shown in public and a card inviting a new one.

A gift can go toward five choices: Discretionary (spent where the project decides; earmark `needed-most`), the initiative (`books-for-nations`), Accessibility Formats (`large-format`), Research (`research`) and Digital Infrastructure (`hosting`). The earmarks are the names stored with each sponsor and gift; only their labels changed on Nov. 24.

The gift form chooses how often, where the gift goes (Discretionary, unless the sponsor picks another), and an amount: amounts for 1, 10 and 100 copies once the cost of a paperback is set, or any other amount. An amount is US dollars as people write them ("25", "$1,250", "12.50"): digits, commas only between groups of three, and at most two digits of cents, from $5 to $10,000 (`centsFromDollars` and `giftCents` in `src/lib/sponsorship.ts`). The amount box keeps only what can be money as it is typed, and flags an amount outside that range before it is sent; the Account page and the workspace's costs check every amount again with the same rule, so "1e3" or "12.345" is refused however it arrives. Nothing is chosen ahead of time but how often (every month, as on the Account page) and where the gift goes. Pressing Sponsor opens the Account page's gift form with those choices filled in; a new sponsorship starts with that choice of where its gifts go. While gifts are off, the button is greyed out and a note says who receives gifts goes there once chosen.

The lead author sets each cost under "Costs on the Sponsorship page" on the workspace Sponsors page: a paperback printed and mailed to one nation, a hardcover the same way, and the website for a year. A blank box keeps that figure and its progress bar off the page. Progress counts gifts in the mode the public pages use. Copies paid for are the gifts toward the initiative divided by the cost of a paperback, never more than level 3's nations; each level shows them up to its own nations. The site's share is its gifts in the last 365 days over a year's cost; at the whole cost the card says "Paid for". The hardcovers' share is the gifts toward copies over a hardcover for every nation, since hardcovers take the place of paperbacks.

## Managers

Everyone who manages a sponsorship can change everything on it, give, and change billing. A manager adds someone with an invitation link: the site shows the link once, the manager sends it themselves, and it works once for 14 days. The person signs in, or makes an account, and presses Accept. Links are used this way because the site cannot yet check that someone receives mail at an address (sign-in emails wait on the domain). The last manager cannot be removed, so a sponsorship always has someone to look after it; to close one, a manager writes to the project.

## Listing in public

A sponsor shows on the Sponsorship page only after their first gift, and only as they chose:

| Choice | Shown |
| --- | --- |
| Name, logo and link | Name, logo, one line, link and their own page |
| Name only | Name, one line and their own page |
| As "a sponsor", without our name | "A sponsor", what the gift helps fund and since when; no page of their own |
| Don't list us | Nothing |

The amount is never shown in public. The sponsor's managers see their own total and monthly gift; the lead author sees every gift. The lead author can take a sponsor off the public pages with a note, which goes in the sponsor's history.

While gifts are in test mode, test gifts count for the public pages, so the whole path can be tried. Otherwise only live gifts count.

Logos are PNG, JPEG or WebP up to 512 KB, checked by their first bytes, stored in the private bucket and served with their own type only. SVG is refused because it can carry scripts. A logo is a file sent from outside, so it is held until the virus check passes (site/SCANNING.md), and the sponsor's initials show until then.

## Gifts and Stripe

A gift is paid on Stripe Checkout, Stripe's own page, so card details never reach this site. A monthly gift is a Stripe subscription. The amount, card, billing address, cancelling and receipts are on Stripe's billing page (the customer portal), which the Account page opens. The site makes one Stripe customer for each sponsor in each mode, the first time a manager presses "Continue to payment", and matches every gift to the sponsor by that customer.

Gifts are recorded from Stripe's webhook: a one-time gift when its Checkout page is paid (`checkout.session.completed`, or `checkout.session.async_payment_succeeded` for a bank payment that clears later) and a monthly gift each time its invoice is paid (`invoice.paid`). Each Checkout Session or invoice is recorded once, with what the sponsor chose the gift to go toward at that moment.

## Settings

Set in the Cloudflare dashboard as secrets, never in the repository (decision record 0006).

| Setting | Value |
| --- | --- |
| `SPONSOR_GIFTS` | `test` or `live`; anything else, or nothing, keeps gifts off |
| `STRIPE_SECRET_KEY` | The same Stripe key as printed copies (docs/book-orders.md). Test mode needs a test key and live mode a live key |
| `STRIPE_SPONSOR_WEBHOOK_SECRET` | The signing secret of a Stripe webhook endpoint at `https://<site>/sponsorship/payment-webhook`, sending `checkout.session.completed`, `checkout.session.async_payment_succeeded` and `invoice.paid` |
| `SPONSOR_GIFTS_RECEIVER` | Who receives the money, as the gift form names them. Required for `live` |

In Stripe's dashboard, save the customer portal's settings once for each mode (Settings, Billing, Customer portal), or the billing button fails. Let customers update payment methods and billing addresses, cancel subscriptions, change the quantity or price only if a fixed price is set up later, and see invoice history.

## Diagnosing

The lead author's Sponsors page (`/workspace/sponsors`) shows:

- whether sponsors can give, and what sponsors read when they cannot;
- each setting above, whether it is right, and what to change, without showing any secret;
- the webhook address and the events to send;
- every sponsor, whether they show in public and why not, their test and live gifts, and whether they have a Stripe customer in each mode.

Each sponsor's own page there adds their settings, managers, open invitations, every gift with its Stripe reference, and their history. "Ask Stripe about this sponsor" fetches their Stripe customer and subscriptions as the Account page would, and shows Stripe's own error if it refuses. "See their Sponsorship page as they do" opens their Account page, read only.

## Before gifts go live

- Who receives the money: an individual, a fiscal sponsor, or the nonprofit once it exists. Set `SPONSOR_GIFTS_RECEIVER` to that name.
- The nonprofit route: no Donate or Sponsor button until the corporation exists and Nevada's charitable registration (NRS 82A) is filed, and each request for a gift carries the disclosure NRS 82A.200 requires. The disclosure's wording goes on the Account page's gift form and the Sponsorship page.
- Receipts for tax purposes, if the receiver is tax exempt: Stripe's receipts show the amount; a written acknowledgment may also be needed.
- Book receipts stay apart from gifts; printed copies use their own webhook and table (docs/book-orders.md).

This is a description of the website, not legal or tax advice.

## Deleting an account

A manager who deletes their account stops being a manager, and their email address is removed from the sponsorship's history ("A former manager" stays). The sponsorship stays with its other managers. If no manager is left, the lead author's page says so. The Stripe customer, which holds the email of the manager who first gave, is in Stripe and is changed there. The data download on Your data lists the sponsorships the person manages.
