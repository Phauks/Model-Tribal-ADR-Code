# 0040. Keep the project's email in the website, with outreach through a separate mailbox

- **Status:** Accepted (lead author, Nov. 23, 2026)
- **Date:** 2026-11-23

## Context

The lead author asked whether the project's email could live in the website "instead of having to rely on a Google workspace or something like that", using the private bucket the site already has.[^ask] The lead author then added scheduled sending, read receipts and reminders to follow up, and asked that the private address book be the source of recipients.[^ask-more]

Cloudflare offers the two halves on the account the site already uses. Email Routing receives mail for a domain and can hand each message to a Worker.[^routing] Email Service sends mail from a Worker through a binding, with no keys to keep.[^send] But Cloudflare's terms allow Email Service only for mail people started or expect, not unsolicited mail,[^terms] and a first letter to a nation is unsolicited. A hosted mailbox such as Zoho Mail has no such rule for one person's letters and offers SMTP submission that a Worker can reach over a TCP connection.[^zoho-smtp][^sockets]

Tracking pictures, the usual "read receipt", report opens that never happened (Apple Mail loads them for every message) and watch people without asking. That conflicts with the project's charter and the CARE principles.

## Decision

The lead author chose, on a decision card in the project, "Website inbox + Zoho for outreach",[^choice] and asked that the outreach service be swappable.[^modular]

- **An inbox in the workspace.** Mail to the project's addresses arrives through Email Routing, is kept whole in the private bucket under `mail/`, and is listed, threaded and searched from the database. The lead author reads, answers, assigns, tags, files in folders, snoozes, archives and deletes conversations there, adds notes only the team sees, sets reminders for when no reply comes, and schedules messages to send later. Auto-sort rules file, tag, assign or mark read mail as it arrives.[^organize]
- **Replies through Cloudflare Email Service.** Only mail people started: replies, and the inbox's own "new mail" notice, which never quotes the message.
- **Outreach through a separate mailbox,** on a subdomain, sent by the Worker over SMTP with replies directed to the project inbox. Zoho Mail Lite is the first choice. The service is chosen by settings, and any SMTP mailbox fits without a code change.
- **Outreach is slow and easy to stop.** Templates are versioned; batches take recipients from the private address book, send a few at a time in working hours in each nation's own time zone, and carry an unsubscribe link, an unsubscribe address and one-click headers. A do-not-email list, filled by unsubscribes, confirmed "stop" replies, hard bounces and spam reports, is checked when a recipient is added and again before each send. Nothing takes an address off it automatically.
- **No hidden open tracking.** The inbox shows what the sending service reports about delivery. A batch may add a visible "let us know you got this" link that records only that it was pressed.
- **Lead author only, for now.** The inbox and outreach need permissions that only the lead author holds.

## Consequences

- The project pays nothing more for everyday mail beyond Workers Paid, which includes 3,000 sent messages a month,[^pricing] and about US$12 a year for the outreach mailbox.[^zoho-price]
- Everything waits for the domain. Switching on is a list of dashboard steps and settings in `site/MAIL.md`, "Switching email on".
- The inbox is simpler than a full mail program: no IMAP access from phones' mail apps, and spam filtering relies on the sender's SPF, DKIM and DMARC results. If that proves too thin, the fallback is a hosted mailbox for everything, with the website keeping outreach.
- Delivery reports from Cloudflare need a queue, added when email is switched on; bounces that come back as mail are read from the start.
- Letters to nations keep their history in one place: the address book records bounced addresses, and each recipient's conversation is linked from its batch.

## Sources

[^ask]: Lead author, message in the project, Nov. 23, 2026 (project records).
[^ask-more]: Lead author, messages in the project, Nov. 23, 2026: "Email should be able to be schedule sent, read receipts, ping for response. Etc"; "We should have internal contacts, so that csv becomes the basis of our address book" (project records).
[^choice]: Lead author, decision card in the project's email thread, Nov. 23, 2026 (project records).
[^modular]: Lead author, message in the project's email thread, Nov. 23, 2026: "Build zoho modular so we can shift to other service though if necessary" (project records).
[^organize]: Lead author, messages in the project's email thread, Nov. 23, 2026: "Add tagging and putting items in folders. Create functionality for auto-sort rules?" and "The inbox and message creation looks archaic. Can we make it look better" (project records).
[^routing]: Cloudflare, "Email Routing," <https://developers.cloudflare.com/email-routing/>.
[^send]: Cloudflare, "Send emails," Email Service documentation, <https://developers.cloudflare.com/email-service/get-started/send-emails/>.
[^terms]: Cloudflare, "Service-Specific Terms: Developer Platform," <https://www.cloudflare.com/service-specific-terms-developer-platform/>.
[^zoho-smtp]: Zoho, "Zoho Mail SMTP configuration," <https://www.zoho.com/mail/help/zoho-smtp.html>.
[^sockets]: Cloudflare, "TCP sockets," Workers documentation, <https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/>.
[^pricing]: Cloudflare, "Pricing," Email Service documentation, <https://developers.cloudflare.com/email-service/platform/pricing/>.
[^zoho-price]: Zoho, "Zoho Mail pricing (USD)," <https://www.zoho.com/mail/images/mail-pricing-usd.pdf>.
