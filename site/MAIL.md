# The project inbox

The website has its own email: a shared inbox in the workspace where the lead author reads, replies to, forwards, assigns, tags, files, sets reminders on and archives the project's mail, and an Outreach page that writes to nations from the private address book. Nothing needs Google Workspace or another hosted mailbox for everyday mail. Mail is kept in the project's own storage: each message whole in the private bucket (R2), and what the pages list and search in the database (D1). The design and its reasons are in [decision record 0040](../docs/decisions/0040-project-inbox-on-cloudflare.md).

Email is off until the project has a domain. While `MAIL_DOMAIN` is empty, the Inbox and Outreach pages open, but nothing is received or sent.

## How mail comes in

Cloudflare Email Routing receives mail for the domain and hands each message to the Worker's email handler.[^routing] The handler passes the raw message to `/mail/internal/arrive` inside the same Worker (`tools/add-mail-handlers.mjs`), which files it (`src/lib/server/mail/inbound.ts`):

- The whole message is kept in the bucket at `mail/raw/<year>/<month>/<id>.eml`, its HTML at `mail/html/<id>.html`, and each attachment at `mail/attachments/<message>/<attachment>`.
- A reply joins the conversation it answers, found by its `In-Reply-To` and `References` headers, or else by the same subject (without "Re:") from the same address within 60 days.
- An out-of-office or other automatic reply is shown, marked, and does not count as an answer for reminders (RFC 3834 headers, or the usual subjects).[^rfc3834]
- A delivery failure report (RFC 3464) marks the message it is about as bounced and puts the address on the do-not-email list.[^rfc3464] The address book marks that email "bounced" too.
- A message that fails its sender's own DMARC check, or fails SPF without a valid DKIM signature, goes to Spam with the reason shown.
- A reply whose own first line asks to stop ("stop", "unsubscribe", "remove me", "do not email us") is flagged in red. A person confirms it before the address goes on the do-not-email list; the inbox never decides alone.
- Mail to `unsubscribe+<token>@` the domain puts the address on the do-not-email list and is not filed.
- The sender's nation is found from the address book when the address is in it.

Auto-sort rules then run on the message (see "Folders, tags and rules" below), except on Spam and delivery reports.

If a notice address is set, one short "new mail" message goes there at most every 30 minutes. It never quotes the mail, so the message stays in the project's storage. Filing that fails makes Email Routing refuse the message for now, so the sender's server tries again later; nothing is lost silently.

## How mail goes out

Every message the inbox sends is written to the database first, then handed to a carrier (`src/lib/server/mail/carriers.ts`):

- **Replies and other mail people started** go through Cloudflare Email Service, through the `projectEmail` binding. Its terms allow only that kind of mail.[^terms]
- **Outreach** goes through the outreach mailbox's SMTP server, from the Worker over an encrypted TCP connection.[^sockets] See "Outreach" below.

A copy of each sent message is kept in the bucket like received mail. Replies carry `In-Reply-To` and `References`, so they thread in the other side's mail program. A message can wait for a time ("Send later"); the run every five minutes sends it, and it can be sent now or cancelled until then. Every received or sent message has Reply, Reply all and Forward buttons, which fill in the box at the bottom of the conversation for that message. Reply all leaves out the project's own addresses; it is offered only when the message reached more than one other person. A forward stays in the same conversation but does not carry `In-Reply-To`, so it starts a new thread for whoever receives it; it is checked against the do-not-email list like a new message, and the forwarded message's attachments go with it unless unticked.

"Remind me" is the one way to put a conversation off (there is no separate snooze): it leaves the Inbox list, is listed under Reminders, and comes back to the inbox as unread at the chosen time, from wherever it was filed. If a real reply arrives first, the conversation comes back at once and the reminder ends; an automatic reply does neither. A reminder can be set from the conversation, or with "Remind me" when sending, and the outreach batch's "remind me if no reply after this many days" sets the same thing. Moving the conversation to the inbox, Spam or Deleted ends the reminder; archiving or filing it keeps it.

### Delivery reports and "read receipts"

Each sent message shows what the sending service reports: delivered to the other side's mail server, delayed, bounced, failed, refused, or marked as spam. "Delivered" means their server took it, not that anyone read it.

The inbox has no hidden open tracking. Tracking pictures are unreliable (Apple Mail loads them for every message, opened or not) and they watch people without asking, which does not fit the project's charter or the CARE principles. Instead an outreach batch can add a visible line, "If you would like to let us know this reached you, open this link", which records only that the person pressed the button on that page. The follow-up reminder covers the rest.

Cloudflare reports delivery through a Queues event subscription.[^events] Setting it up needs a queue, and a deploy fails while the queue named in `wrangler.jsonc` does not exist, so it is added when email is switched on (step 6 below). Until then, bounces still arrive as mail and are read from there.

### Reading HTML mail

A message's text is shown as text. Its HTML version opens in a sandboxed frame: scripts, forms and plug-ins never run, and nothing outside the message loads, so pictures from the web stay hidden and no sender learns the message was opened. Attachments always download; they never open in the browser.

## Folders, tags and rules

The lead author asked for tags, folders and auto-sort rules on Nov. 23, 2026.

- **Folders.** Besides the four built-in ones (Inbox, Archive, Spam, Deleted), the lead author can make folders, three deep at most, such as "Nations / Southwest / Navajo Nation", on the Folders and tags page (`/workspace/inbox/organize`). A conversation sits in one folder at a time. A new reply to a conversation in a made folder stays in that folder, shown as unread there. Deleting a folder sends its conversations, and those of the folders inside it, back to the inbox, never to Deleted.
- **Tags.** A conversation can have any number of tags, whatever folder it is in. A tag's page lists its conversations in every folder except Spam and Deleted. Tag colors come from the site's tokens, and the name always shows, so the color is never the only way to tell tags apart.
- **Ticking several.** In any list, conversations can be ticked and then archived, deleted, marked as spam, read or unread, moved to a folder, or tagged and untagged together.
- **Auto-sort rules** (`/workspace/inbox/rules`, `src/lib/server/mail/rules.ts`). Each rule has conditions (sender, To or Cc, subject, text, has an attachment, sender known in the address book with a nation, automatic reply) joined by "all" or "any", and actions (move to a folder or to Archive, Spam or Deleted; add tags; assign; mark as read). Words match without regard to capital letters. Rules run in order on each message that arrives, except Spam and delivery reports, and a rule can stop the ones after it. "Test on the inbox" shows what a rule would catch now without changing anything; "Run on inbox" or the box under the editor applies it to the conversations already in the inbox. A rule that names a folder, tag or person that has since been deleted skips that action. A conversation a rule marks read or files away sends no "new mail" notice. A conversation's page links to "Make a rule for mail from this sender".

## Outreach

Cloudflare Email Service may not be used for unsolicited mail,[^terms] and a first letter to a nation is unsolicited. So outreach goes through a separate mailbox on a subdomain, such as `outreach@outreach.<domain>`, with replies sent to an address in the project inbox. The recommended mailbox is Zoho Mail Lite (US$1 a user a month, billed yearly, as of Nov. 2026),[^zoho-price] which accepts mail from the Worker on `smtppro.zoho.com`, port 465.[^zoho-smtp]

The Outreach page (`src/routes/workspace/outreach`) has:

- **Templates.** Saved messages with fields such as `{{nation.name}}` and `{{contact.greeting}}` (the list is in `src/lib/mail.ts`, `mergeFields`). Every save keeps the earlier version, and a batch keeps the version it was made from.
- **Batches.** One message for each recipient, taken from the private address book (the preferred email in use for each contact, an address once), or typed in. A recipient missing a field the template uses, or on the do-not-email list, is left out with the reason shown. A batch sends at most its daily number in any 24 hours, two each run, and only inside its sending hours in each nation's own time zone (from the nation's state), on weekdays unless told otherwise. It can be paused and cancelled.
- **Unsubscribe.** Every letter ends with how to stop further mail: a link, an address, and replying "stop". The message also carries `List-Unsubscribe` and `List-Unsubscribe-Post` headers, so mail programs can offer their own one-click button (RFC 8058).[^rfc8058] The link only shows a button, because mail scanners open links by themselves. Tokens are signed with `MAIL_SIGNING_KEY`.
- **The do-not-email list.** Addresses here get no outreach and no new messages from the inbox. Nothing takes an address off by itself; the lead author can.

A reply to an outreach letter lands in the inbox, in the same conversation, tagged "Outreach reply", and the batch marks the recipient as replied.

### Swapping the outreach service

The outreach mailbox can be changed by settings alone (lead author, Nov. 23, 2026). Any mailbox provider that offers authenticated SMTP submission on port 465 or 587 works: Zoho Mail, Fastmail, Migadu, Google Workspace and others. Change `OUTREACH_FROM`, `OUTREACH_SMTP_HOST`, `OUTREACH_SMTP_PORT` and `OUTREACH_SMTP_USERNAME` in `wrangler.jsonc`, and the `OUTREACH_SMTP_PASSWORD` secret in the dashboard. A service with only an HTTP sending API needs one more function in `carriers.ts` that returns a `MailCarrier`, and a new value for `OUTREACH_CARRIER`.

## Settings

Plain settings are in `site/wrangler.jsonc` under `vars`, because plain-text variables set in the dashboard are replaced by that file on each deploy. Secrets are set in the Cloudflare dashboard (Worker > Settings > Variables and Secrets) as the Secret type, never in git (decision record 0006).

| Setting | What it holds |
| --- | --- |
| `MAIL_DOMAIN` | The project's domain. Empty while email is off. |
| `MAIL_ADDRESSES` | The inbox's own addresses, as local parts separated by commas, such as `contact,requests`. The first is the one replies come from by default. |
| `MAIL_NOTICE_ADDRESS` | Where the "new mail" notice goes, if anywhere. Not one of the project's own addresses. |
| `MAIL_SENDER_NAME` | The sender's name on the project's mail. |
| `SITE_ADDRESS` | The website's address, such as `https://example.org`, for links in mail. |
| `MAIL_SIGNING_KEY` | Secret. A long random value that signs unsubscribe and acknowledgment links. Changing it breaks links already sent. |
| `OUTREACH_CARRIER` | `smtp` to switch outreach on; empty while it is off. |
| `OUTREACH_FROM` | The address outreach comes from. |
| `OUTREACH_REPLY_TO` | Where replies to outreach go, such as `replies@<domain>`. |
| `OUTREACH_SMTP_HOST`, `OUTREACH_SMTP_PORT`, `OUTREACH_SMTP_USERNAME` | The mailbox's SMTP server, port (465 or 587) and user name (the From address when empty). |
| `OUTREACH_SMTP_PASSWORD` | Secret. The mailbox's app password. |

Who can use the pages is set in `src/lib/permissions.ts`: `read-mail`, `send-outreach` and `manage-mail`, all held only by the lead author for now.

## Switching email on

These steps wait for the domain (`docs/domain-to-do.md`). The DNS records are added by Cloudflare when each part is switched on, because the domain's DNS is on the same Cloudflare account.

1. **Receiving.** In the dashboard, open the domain's Email > Email Routing and enable it; Cloudflare adds its MX records (`route1`, `route2` and `route3.mx.cloudflare.net`), an SPF record with `include:_spf.mx.cloudflare.net`, and a DKIM record.[^routing] Under Routing rules, set the catch-all to "Send to a Worker" and choose `model-tribal-adr-code`. A catch-all is needed for the `unsubscribe+` addresses and lets the inbox see mail to any address on the domain.
2. **Sending replies.** In Email Service > Email Sending, onboard the domain. Cloudflare adds the sending SPF and DKIM records on the `cf-bounce` subdomain and a DMARC record (`p=reject`) if the domain has none.[^send] The same step serves sign-in codes (`SIGN_IN_EMAIL_FROM`).
3. **Settings.** In `wrangler.jsonc`, set `MAIL_DOMAIN`, `MAIL_ADDRESSES`, `SITE_ADDRESS` and, if wanted, `MAIL_NOTICE_ADDRESS`, and merge that change. In the dashboard, add `MAIL_SIGNING_KEY` as a Secret (for example the output of `openssl rand -hex 32`).
4. **The database.** Run `npm run database:migrate:remote` from `site/` (or let the next deploy's migration step do it) so migration 0013 is applied.
5. **The outreach mailbox.** Sign up for Zoho Mail Lite with the subdomain `outreach.<domain>`, add the MX, SPF and DKIM records Zoho gives (under the subdomain, so they do not touch the root domain's Cloudflare records), and add a DMARC record for the subdomain. Turn on two-factor sign-in and make an app-specific password.[^zoho-smtp] In Zoho, forward everything that reaches the mailbox to `OUTREACH_REPLY_TO`, so a reply sent to the wrong address still lands in the inbox. Then set `OUTREACH_CARRIER` to `smtp`, the other `OUTREACH_` settings in `wrangler.jsonc`, and `OUTREACH_SMTP_PASSWORD` as a Secret.
6. **Delivery reports.** Create a queue named `mail-delivery-events`, subscribe it to Email Sending events for the domain (all six types), and add the consumer to `wrangler.jsonc`:[^events]

   ```jsonc
   "queues": { "consumers": [{ "queue": "mail-delivery-events", "max_batch_size": 50 }] }
   ```

7. **Try it.** Write to `contact@` from a personal address and reply from the inbox. Send a one-recipient outreach batch to an address the project controls, use its unsubscribe link, and check the address appears on the do-not-email list.

Start outreach slowly. A new mailbox is trusted gradually, so begin at 20 to 40 letters a day and raise it over a few weeks while bounces and spam reports stay near zero. Zoho also limits how much one mailbox sends a day.[^zoho-limits]

## Limits

- Cloudflare Email Service takes at most 50 recipients and 25 MiB a message.[^limits] The compose form allows 18 MB of attachments, since encoding adds about a third.
- On Workers Paid, 3,000 messages a month are included, then US$0.35 per 1,000 (Nov. 2026).[^pricing] Replies and notices are a small part of that; outreach does not count, because it goes through the outreach mailbox.
- The run every five minutes sends at most two outreach letters a batch, so at most 24 an hour for each running batch.
- Spam filtering is basic: it trusts the sender's own SPF, DKIM and DMARC results. Unwanted mail that passes those lands in the inbox and can be moved to Spam by hand.
- Conversations in Deleted are removed for good, with their files in the bucket, 30 days after they were deleted.

## Files

- `migrations/0013_mail.sql`: the tables.
- `src/lib/mail.ts`: names, labels and small functions the pages share, including how a rule's conditions are matched.
- `src/lib/server/mail/`: settings, message building (`mime.ts`), SMTP (`smtp.ts`), carriers, signed tokens, receiving (`inbound.ts`), sending (`outbound.ts`), conversations, folders and tags (`store.ts`), auto-sort rules (`rules.ts`), outreach (`outreach.ts`) and the do-not-email list (`suppressions.ts`). Only `runtime.ts` and `socket-opener.ts` need the Worker; the rest is tested in Node (`tests/mail.test.ts`, `tests/mail-flow.test.ts`, `tests/mail-organize.test.ts`).
- `tools/add-mail-handlers.mjs`: adds the email, queue and scheduled handlers after the build. It wraps whatever entry the build made, so it runs last in `npm run build`.
- `src/routes/workspace/inbox/`, `src/routes/workspace/outreach/`: the pages. `src/routes/mail/`: the unsubscribe and acknowledgment pages, and the internal routes the handlers call.

## Sources

[^routing]: Cloudflare, "Email Routing," <https://developers.cloudflare.com/email-routing/>; Cloudflare, "Email handler," Email Service documentation, <https://developers.cloudflare.com/email-service/api/route-emails/email-handler/>.
[^send]: Cloudflare, "Send emails," Email Service documentation, <https://developers.cloudflare.com/email-service/get-started/send-emails/>; Cloudflare, "Email authentication," <https://developers.cloudflare.com/email-service/concepts/email-authentication/>.
[^terms]: Cloudflare, "Service-Specific Terms: Developer Platform," Email Service section, <https://www.cloudflare.com/service-specific-terms-developer-platform/>; Cloudflare, "Email Service FAQ," <https://developers.cloudflare.com/email-service/reference/faq/>.
[^sockets]: Cloudflare, "TCP sockets," Workers documentation, <https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/> (outbound connections on port 25 are not allowed).
[^events]: Cloudflare, "Event subscriptions," Email Service documentation, <https://developers.cloudflare.com/email-service/reference/event-subscriptions/>.
[^limits]: Cloudflare, "Limits," Email Service documentation, <https://developers.cloudflare.com/email-service/platform/limits/>.
[^pricing]: Cloudflare, "Pricing," Email Service documentation, <https://developers.cloudflare.com/email-service/platform/pricing/>.
[^zoho-price]: Zoho, "Zoho Mail pricing (USD)," <https://www.zoho.com/mail/images/mail-pricing-usd.pdf>.
[^zoho-smtp]: Zoho, "Zoho Mail SMTP configuration," <https://www.zoho.com/mail/help/zoho-smtp.html>.
[^zoho-limits]: Zoho, "Email sending limits," <https://www.zoho.com/mail/help/adminconsole/email-sending-limits.html>.
[^rfc3834]: K. Moore, "Recommendations for Automatic Responses to Electronic Mail," RFC 3834 (2004), <https://www.rfc-editor.org/rfc/rfc3834>.
[^rfc3464]: K. Moore & G. Vaudreuil, "An Extensible Message Format for Delivery Status Notifications," RFC 3464 (2003), <https://www.rfc-editor.org/rfc/rfc3464>.
[^rfc8058]: J. Levine & T. Herkula, "Signaling One-Click Functionality for List Email Headers," RFC 8058 (2017), <https://www.rfc-editor.org/rfc/rfc8058>.
