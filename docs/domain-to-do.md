# Waiting on the domain

The project's domain is `triballawproject.org`, registered on the project's Cloudflare account on 2026-11-25. The website runs there. The site sends no email yet, because Cloudflare Email Service sends only from a domain onboarded on the same Cloudflare account.[^email-send] On 2026-11-22 the lead author chose to buy a new domain for the project.

This page lists everything that waits on the domain, so that it can all be done together once the name is chosen. When an item is done, tick it and name the pull request.

## 1. Choose and register the name

- [x] **The lead author picks the name:** `triballawproject.org`. Candidates checked on 2026-11-22 with Cloudflare Registrar's availability check, all available then at US$8.50 for the first year and US$11.20 a year after:[^registrar-check]
  - `tribaladrcode.org` (suggested: short, names the code, and `.org` suits a non-commercial project);
  - `modeltribaladrcode.org` (matches the full project name);
  - `tribaladr.org` (shortest, but reads as a general site about Tribal ADR).

  `.law` is not offered by Cloudflare Registrar.
- [x] **Register it with Cloudflare Registrar on the project's Cloudflare account.** Done 2026-11-25. Cloudflare sells domains at cost and puts their DNS on the same account,[^registrar] so the Worker and Email Service can use the domain with no records to copy by hand. Registration costs money and cannot be undone, so it waits for the lead author's yes.

## 2. Move the website to the domain

- [x] Add the domain to the Worker as a custom domain (`routes` with `custom_domain: true` in `site/wrangler.jsonc`). Added in the dashboard on 2026-11-25 and written into `site/wrangler.jsonc` afterward. Cloudflare then creates the DNS record and the certificate.[^custom-domain]
- [x] Decide whether the workers.dev address stays on (`workers_dev` in `site/wrangler.jsonc`). Turned off on 2026-11-25, so there is one address to cite.
- [x] Replace the workers.dev address where it is written down, including `SITE_ADDRESS` in `site/wrangler.jsonc` and the default `--site` in `site/tools/make-sign-in-link.mjs`.
- [x] Build a sitemap on the domain. Done 2026-11-26: `/sitemap.xml`, written from the collections registry when a crawler asks, so it grows with the site ([sitemap.md](sitemap.md)).
- [ ] At the first release, not before: set `openToSearchEngines` to `true` in `site/src/lib/search-engines.ts`. That removes the `noindex` tag from every page, opens robots.txt (`site/src/routes/robots.txt`) except for private and signed-in pages, and turns on its `Sitemap:` line. Then submit the sitemap in Google Search Console and Bing Webmaster Tools, and add canonical links. The site stays out of search engines during 0.0.x because nation pages have not been reviewed by the nations.

## 3. Turn on email

- [ ] **Sign-in codes.** Onboard the domain in Email Service (Compute > Email Service > Email Sending > Onboard Domain), which adds the SPF, DKIM and DMARC records,[^email-send] then set `SIGN_IN_EMAIL_FROM` in `site/wrangler.jsonc` to an address such as `sign-in@` the domain. Steps: `site/COLLABORATION.md`, "Setting up sign-in". Until then people sign in with a password or a link from the lead author.
- [ ] **Summaries of followed pages.** Built and waiting: set `UPDATE_EMAIL_FROM` in `site/wrangler.jsonc` to an address such as `updates@` the domain, and `SITE_ADDRESS` to the site's address on the domain. Readers' daily or weekly summaries then start at the next hourly run. Steps: `site/COLLABORATION.md`, "Turning on the emails".
- [ ] **Event emails.** Built and waiting on the same switch as summaries: once `UPDATE_EMAIL_FROM` and `SITE_ADDRESS` are set, people registered for events get confirmations, waitlist offers, reminders and word of changes or cancellations from the next 15-minute run. Steps: `site/COLLABORATION.md`, "Events".
- [ ] **Request notices.** Email the maintainer a link to each new request, never its contents (`docs/requests.md`, "How it is built"). Not built.
- [ ] **Contributor notices.** Email the lead author when a registration arrives, and contributors before each edition goes to print (`docs/contributor-profiles.md`, "Not built yet"). Not built.
- [ ] **The project inbox and outreach.** Built, waiting for the domain: Email Routing to the Worker, the settings, the outreach mailbox on a subdomain, and the delivery-report queue. The steps are in `site/MAIL.md`, "Switching email on" (decision record 0040). Nations asking for a correction or removal can then write to the project's own address.

## 4. Print and ebook

- [ ] The book and the EPUB print the website's address. Use the domain, never the workers.dev address, and check this before the first Lulu export.

## Sources

[^email-send]: Cloudflare, "Send emails," Email Service documentation,
    <https://developers.cloudflare.com/email-service/get-started/send-emails/>.

[^registrar-check]: Cloudflare Registrar API, "Check domain availability" (`POST /accounts/{account_id}/registrar/domain-check`), run on the project's account on 2026-11-22. Prices and availability change; check again just before registering.

[^registrar]: Cloudflare, "Cloudflare Registrar," Registrar documentation,
    <https://developers.cloudflare.com/registrar/>.

[^custom-domain]: Cloudflare, "Custom Domains," Workers documentation,
    <https://developers.cloudflare.com/workers/configuration/routing/custom-domains/>.
