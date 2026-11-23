# The project inbox

The website has its own email: inboxes in the workspace, shared or personal, where the project team reads, replies to, forwards, assigns, tags, files, sets reminders on and archives the project's mail, and an Outreach page that writes to nations from the private address book. Nothing needs Google Workspace or another hosted mailbox for everyday mail. Mail is kept in the project's own storage: each message whole in a private bucket of its own (R2), and what the pages list and search in the database (D1). The design and its reasons are in [decision record 0040](../docs/decisions/0040-project-inbox-on-cloudflare.md).

Email is off until the project has a domain. While `MAIL_DOMAIN` is empty, the Inbox and Outreach pages open, but nothing is received or sent.

## Inboxes

Each address on the domain that the project uses has its own inbox (`src/lib/server/mail/inboxes.ts`, migration `20261123T1757_add_mail_inboxes.sql`). There are two kinds:

- **Shared**, such as `contact@`: read and answered by everyone on its list. Whoever manages mail adds and takes off people on the Inbox settings page; an inbox always keeps at least one person. Someone taken off loses sight of its conversations at once, and those assigned to them there become unassigned.
- **Personal**, such as `trevor@`: read only by the one person it belongs to. Nobody else is ever put on it, and whoever manages mail sees only that it exists, not what is in it or how much. Deleting the person's account deletes the inbox, and the run every five minutes then removes its conversations and their files, unseen by anyone.

One shared inbox is marked "Gets other mail": mail to an address no inbox has goes there, so a mistyped or old address is not lost. It starts as `contact@`, the inbox the site had before there were several, read by the lead author. A `+tag` after the local part (`contact+forms@`) goes to the inbox without it. An inbox can be deleted once it has no conversations (Deleted is emptied after 30 days); mail to its address then goes to the catch-all. `unsubscribe@` is kept for the inbox's own use.

Everything is by inbox. The list, counts, search, a conversation, its files and HTML, the sender card's other conversations and its export open only for someone on that conversation's inbox; anyone else gets "not found", as if it were not there. The same message sent to two addresses lands in both inboxes as separate conversations, because Email Routing gives the Worker each message with a single recipient address (`message.to`), so a message to two of the project's addresses is filed once for each.[^routing] A person sends only from the addresses of inboxes they are on, and a reply starts from the address of the conversation's inbox. When someone is on more than one inbox, the sidebar lists each with its unread count, and "All inboxes" shows them together.

Some things belong to the project's shared mail and so skip personal inboxes: auto-sort rules, the "new mail" notice and the away message. Folders, tags and saved replies are shared across inboxes, and a folder or tag shows each person only the conversations they can open. Settings, rules and the private address book (contact details on the sender card, address suggestions while writing) stay with whoever holds `manage-mail` and `manage-address-book`.

## How mail comes in

Cloudflare Email Routing receives mail for the domain and hands each message to the Worker's email handler.[^routing] The address it was sent to picks the inbox (see "Inboxes" above). The handler passes the raw message to `/mail/internal/arrive` inside the same Worker (`tools/add-mail-handlers.mjs`), which files it (`src/lib/server/mail/inbound.ts`):

- The whole message is kept in the mail bucket (see "Storage") at `mail/raw/<year>/<month>/<id>.eml`, its HTML at `mail/html/<id>.html`, and each attachment at `mail/attachments/<message>/<attachment>`.
- A reply joins the conversation it answers, found by its `In-Reply-To` and `References` headers, or else by the same subject (without "Re:") from the same address within 60 days.
- An out-of-office or other automatic reply is shown, marked, and does not count as an answer for reminders (RFC 3834 headers, or the usual subjects).[^rfc3834]
- A delivery failure report (RFC 3464) marks the message it is about as bounced and puts the address on the do-not-email list.[^rfc3464] The address book marks that email "bounced" too.
- A message that fails its sender's own DMARC check, or fails SPF without a valid DKIM signature, goes to Spam with the reason shown.
- A reply whose own first line asks to stop ("stop", "unsubscribe", "remove me", "do not email us") is flagged in red. A person confirms it before the address goes on the do-not-email list; the inbox never decides alone.
- Mail to `unsubscribe+<token>@` the domain puts the address on the do-not-email list and is not filed.
- The sender's nation is found from the address book when the address is in it.

Auto-sort rules then run on the message (see "Folders, tags and rules" below), except on Spam and delivery reports.

If a notice address is set, one short "new mail" message goes there at most every 30 minutes. It never quotes the mail, so the message stays in the project's storage. If filing fails, the message is kept and filed later (see "When something fails").

### Attachments and the virus check

Every attachment, of a message that arrives or one the project sends, is stored with `storeSentFile`, which puts it in line for the site's virus scanner ([SCANNING.md](SCANNING.md)), and it is held until the scan says clean. While it is held, the conversation shows the file with where the check stands instead of a download link, and a forward cannot include it. A file where something was found is held for good. One the scanner could not finish (locked with a password, too large) can be released by someone who manages the inbox, with a short reason that goes in the conversation's history. A message the project sends waits until its attachments pass: it shows "Waiting for the virus check" and the five-minute run sends it once they do, usually within a minute or two (Trevor, Nov. 23, 2026: no file may get around the scanner). If the check finds something in a file the team attached, or cannot check it, the message is not sent and says why; remove the file and send again. When a deleted conversation is removed for good, its files' scan records go with it. The code is in `src/lib/server/mail/scans.ts`.

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

### Big files as links

A message's attachments can add up to 18 MB. Cloudflare Email Service takes 25 MiB a message, and attachments grow by about a third when encoded for mail.[^limits] When the chosen files add up to more than that, the composer keeps the ones that fit as attachments, and the biggest go as download links instead, the way webmail services handle big files (`src/lib/server/mail/linked-files.ts`).

- **Sending up.** The browser sends a link file to the mail bucket in 10 MiB pieces, as an R2 multipart upload, with a progress bar. A file can be up to 2 GiB, what the virus scanner takes. If the page is reloaded or the form comes back with a problem, choosing the same file again picks up where it stopped. The form cannot be sent while a file is still going up. This part needs scripts; without them, files over 18 MB are refused with a note to send them another way.
- **In the message.** Each link goes in the message's text above the signature, with the file's name, its size, and the date the link stops working: 30 days after the message goes. The link is `<SITE_ADDRESS>/mail/files/<token>`, where the token is signed with `MAIL_SIGNING_KEY`, so it cannot be guessed or changed to reach another file.
- **The virus check.** A link file is checked like any attachment, and the message waits until every file passes, so a link never leads to a file that will be held. If the check finds something, the message is not sent and the conversation says why.
- **Downloading.** Anyone with the link can download the file until it runs out. It downloads as a file (never shown in the browser), with no cookies and no sign-in needed. Nothing records who downloaded it or when, in keeping with the inbox's rule against tracking whether mail was read.
- **Clean-up.** The run every five minutes deletes files whose link has run out, uploads left unfinished for a day, and files never sent with a message within a week. Deleting a conversation for good deletes its link files too.

## Folders, tags and rules

The lead author asked for tags, folders and auto-sort rules on Nov. 23, 2026.

- **Folders.** Besides the four built-in ones (Inbox, Archive, Spam, Deleted), the lead author can make folders, three deep at most, such as "Nations / Southwest / Navajo Nation", on the Folders and tags page (`/workspace/inbox/organize`). A conversation sits in one folder at a time. A new reply to a conversation in a made folder stays in that folder, shown as unread there. Deleting a folder sends its conversations, and those of the folders inside it, back to the inbox, never to Deleted.
- **Tags.** A conversation can have any number of tags, whatever folder it is in. A tag's page lists its conversations in every folder except Spam and Deleted. Tag colors come from the site's tokens, and the name always shows, so the color is never the only way to tell tags apart.
- **Ticking several.** In any list, conversations can be ticked and then archived, deleted, marked as spam, read or unread, moved to a folder, or tagged and untagged together.
- **Auto-sort rules** (`/workspace/inbox/rules`, `src/lib/server/mail/rules.ts`). Each rule has conditions (sender, To or Cc, subject, text, has an attachment, sender known in the address book with a nation, automatic reply) joined by "all" or "any", and actions (move to a folder or to Archive, Spam or Deleted; add tags; assign; mark as read). Words match without regard to capital letters. Rules run in order on each message that arrives, except Spam and delivery reports, and a rule can stop the ones after it. "Test on the inbox" shows what a rule would catch now without changing anything; "Run on inbox" or the box under the editor applies it to the conversations already in the inbox. A rule that names a folder, tag or person that has since been deleted skips that action. A conversation a rule marks read or files away sends no "new mail" notice. A conversation's page links to "Make a rule for mail from this sender".

## Writing

The lead author asked for these on Nov. 23, 2026, after a comparison with other mail services. The settings are on the Inbox settings page (`/workspace/inbox/settings`), for whoever manages the inbox; they apply to everyone who answers it. The code is `src/lib/server/mail/writing.ts`, and the tables are in `migrations/20261123T0510_add_mail_writing.sql`.

- **Signatures.** Each of the inbox's addresses can have one. It is put below a new message, reply or forward when the box opens, after a line of two dashes and a space, the usual signature mark,[^rfc3676] and above any quoted message. Choosing another From address swaps it for that address's signature. It is plain text in the message, so it can be changed or taken out before sending.
- **Saved replies.** Answers given often, put in where the cursor is with the speech-bubble button beside Send. They can use the merge fields outreach uses, such as `{{ contact.name }}`, filled in from the address book for whoever the message is to; a field with nothing to fill stays in the message as typed, so the writer sees it and fills it by hand.
- **Drafts that save themselves.** Two seconds after the writer stops typing, what is in the box is saved as their draft, and "Draft saved" shows beside Send. A reply's draft belongs to its conversation (one for each person) and opens again in the reply box; a new message's draft opens from the Drafts list. Drafts are private to their writer, and sending or discarding removes them. Attachments are not kept in drafts. Saving a draft does not count against the limit on workspace changes a minute.
- **Undo send.** After Send, a message waits a short pause (10 seconds unless changed; 5, 20 or none can be chosen) before it goes. The conversation shows it counting down, with Undo and Send now. Undo puts it back in the box as a draft; a new message's conversation is removed with it. Its attachments are not kept and have to be attached again. The Worker sends the message when the pause ends, using the time it may keep working after answering the page (at most 30 seconds);[^waituntil] if that ever fails, the run every five minutes sends it. Each send is claimed first, so the end of the pause, Send now and the five-minute run can never send it twice. A message scheduled for later is not paused; it can be cancelled until its time.
- **Away message.** When it is on, and between its optional start and end, each person who writes gets it once, sent from the address they wrote to with that address's signature. Switching it on again or changing its words starts a new round. It follows the rules for automatic answers:[^rfc3834] it carries `Auto-Submitted: auto-replied`, and it never answers mail in Spam, automatic replies, delivery reports, mailing lists (`List-Id` or `List-Unsubscribe`), machine addresses such as `no-reply@`, the project's own addresses, or anyone on the do-not-email list. It is kept in the conversation as an automatic reply.

## Blocking, unsubscribing and exporting

The lead author asked for these on Nov. 23, 2026, from the same comparison. The code is `src/lib/server/mail/senders.ts` and `src/lib/server/mail/export.ts`, and the table is in `migrations/20261123T0509_add_mail_blocked_senders.sql`.

- **Sender card.** Beside each conversation, a card says who wrote: their entry in the address book if there is one (name, role, nation, other ways to reach them, where the details came from and when they were last checked), and the other conversations with that address. Someone not in the address book is shown as such.
- **Blocking.** Whoever manages the inbox can block one address or a whole domain from the sender card, or from the Inbox settings page, where the list of blocked senders is kept and anyone on it can be unblocked. Mail from a blocked sender is still kept, so nothing is lost, but it goes to Spam with the reason "You blocked this sender," starts a conversation of its own instead of joining an earlier one, sends no notice, and gets no away message. The conversation it was blocked from moves to Spam too. The project's own addresses and domain cannot be blocked.
- **Unsubscribing.** A message from a mailing list (one with a `List-Unsubscribe` header) has an Unsubscribe button.[^rfc2369] If the list offers one-click unsubscribing, the inbox posts `List-Unsubscribe=One-Click` to the list's secure web address, without following redirects, as the standard requires;[^rfc8058] if it offers only an address, the inbox writes to it from the address the list wrote to; if it offers only a web page, the page is linked for the person to open. The conversation is then archived. A list that offers no way gets no button.
- **Exporting.** Each message has "Save as .eml", which downloads the copy of the message the inbox kept as it arrived or was sent, with its attachments inside, so any mail program opens it. "Export" at the top of a conversation downloads the whole conversation as one .mbox file, oldest first, in the "mboxrd" form most mail programs import: lines in a message that begin with "From " get a ">" so they are not read as the start of a new message, and every byte of the message is kept as it was.[^rfc4155] A received message can be exported only once each attachment in it has passed the virus check (see "Attachments and the virus check"); until then the page says which files are still waiting. File names come from the date and subject, with the characters file systems refuse taken out, and are sent in both plain and international forms.[^rfc6266]

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

## Storage

Mail has a private R2 bucket of its own, `model-tribal-adr-code-mail`, bound as `mailFiles` in `wrangler.jsonc` and in the scanner's `scanner/wrangler.jsonc`. It holds each message whole, its HTML and its attachments, under `mail/`. Nothing in it is public: the Worker serves a file only to someone on the conversation's inbox, and an attachment only after the virus check (`SCANNING.md`). The scanner reads files under `mail/` from this bucket and everything else from `sourceDocuments`.

Mail is kept apart from the source documents for three reasons. Access can be given to one without the other. Rules such as deleting old mail or keeping a backup copy can be set for mail alone. And a mistake in code that tidies one bucket cannot touch the other.

The bucket has to exist before a deploy that binds it, or the deploy fails. Create it once in the Cloudflare dashboard (R2 > Create bucket, name `model-tribal-adr-code-mail`, no public access), or with `npx wrangler r2 bucket create model-tribal-adr-code-mail`.

## Settings

Plain settings are in `site/wrangler.jsonc` under `vars`, because plain-text variables set in the dashboard are replaced by that file on each deploy. Secrets are set in the Cloudflare dashboard (Worker > Settings > Variables and Secrets) as the Secret type, never in git (decision record 0006).

| Setting | What it holds |
| --- | --- |
| `MAIL_DOMAIN` | The project's domain. Empty while email is off. |
| `MAIL_NOTICE_ADDRESS` | Where the "new mail" notice goes, if anywhere. Not one of the project's own addresses. |
| `MAIL_SENDER_NAME` | The sender's name on the project's mail. |
| `SITE_ADDRESS` | The website's address, such as `https://example.org`, for links in mail. |
| `MAIL_SIGNING_KEY` | Secret. A long random value that signs unsubscribe and acknowledgment links. Changing it breaks links already sent. |
| `OUTREACH_CARRIER` | `smtp` to switch outreach on; empty while it is off. |
| `OUTREACH_FROM` | The address outreach comes from. |
| `OUTREACH_REPLY_TO` | Where replies to outreach go, such as `replies@<domain>`. |
| `OUTREACH_SMTP_HOST`, `OUTREACH_SMTP_PORT`, `OUTREACH_SMTP_USERNAME` | The mailbox's SMTP server, port (465 or 587) and user name (the From address when empty). |
| `OUTREACH_SMTP_PASSWORD` | Secret. The mailbox's app password. |

The addresses are not a setting: they are the inboxes, made on the Inbox settings page. Who can use the pages is set by inbox membership (see "Inboxes") and in `src/lib/permissions.ts`: `manage-mail` (the settings, the inboxes and who is on them, and rules) and `send-outreach`, both held only by the lead author for now. Anyone on at least one inbox sees Inbox in the workspace menu.

## Switching email on

These steps wait for the domain (`docs/domain-to-do.md`). The DNS records are added by Cloudflare when each part is switched on, because the domain's DNS is on the same Cloudflare account.

1. **Receiving.** In the dashboard, open the domain's Email > Email Routing and enable it; Cloudflare adds its MX records (`route1`, `route2` and `route3.mx.cloudflare.net`), an SPF record with `include:_spf.mx.cloudflare.net`, and a DKIM record.[^routing] Under Routing rules, set the catch-all to "Send to a Worker" and choose `model-tribal-adr-code`. A catch-all is needed for the `unsubscribe+` addresses and lets the inbox see mail to any address on the domain.
2. **Sending replies.** In Email Service > Email Sending, onboard the domain. Cloudflare adds the sending SPF and DKIM records on the `cf-bounce` subdomain and a DMARC record (`p=reject`) if the domain has none.[^send] The same step serves sign-in codes (`SIGN_IN_EMAIL_FROM`).
3. **Settings.** In `wrangler.jsonc`, set `MAIL_DOMAIN`, `SITE_ADDRESS` and, if wanted, `MAIL_NOTICE_ADDRESS`, and merge that change. In the dashboard, add `MAIL_SIGNING_KEY` as a Secret (for example the output of `openssl rand -hex 32`).
4. **The database.** Run `npm run database:migrate:remote` from `site/` (or let the next deploy's migration step do it) so migration 0013 is applied.
5. **The outreach mailbox.** Sign up for Zoho Mail Lite with the subdomain `outreach.<domain>`, add the MX, SPF and DKIM records Zoho gives (under the subdomain, so they do not touch the root domain's Cloudflare records), and add a DMARC record for the subdomain. Turn on two-factor sign-in and make an app-specific password.[^zoho-smtp] In Zoho, forward everything that reaches the mailbox to `OUTREACH_REPLY_TO`, so a reply sent to the wrong address still lands in the inbox. Then set `OUTREACH_CARRIER` to `smtp`, the other `OUTREACH_` settings in `wrangler.jsonc`, and `OUTREACH_SMTP_PASSWORD` as a Secret.
6. **Delivery reports.** Create a queue named `mail-delivery-events`, subscribe it to Email Sending events for the domain (all six types), and add the consumer to `wrangler.jsonc`:[^events]

   ```jsonc
   "queues": { "consumers": [{ "queue": "mail-delivery-events", "max_batch_size": 50 }] }
   ```

7. **Try it.** Write to `contact@` from a personal address and reply from the inbox. Send a one-recipient outreach batch to an address the project controls, use its unsubscribe link, and check the address appears on the do-not-email list.

Start outreach slowly. A new mailbox is trusted gradually, so begin at 20 to 40 letters a day and raise it over a few weeks while bounces and spam reports stay near zero. Zoho also limits how much one mailbox sends a day.[^zoho-limits]

## When something fails

Mail is not lost when a step fails for a while (`src/lib/server/mail/arrivals.ts`, migration `20261123T1833_add_mail_retries.sql`).

- **Mail coming in.** The email handler first writes each message whole to the mail bucket under `mail/incoming/`, with the envelope's sender and recipient, and only then files it. If filing fails (the database busy, a bug, a deploy at the wrong moment), the copy stays, the message is still accepted, and the run every five minutes tries again after 5, 15, 60, 240 and 720 minutes, about a day in all. A message still not filed after that is listed at the top of the Inbox for whoever manages mail, with "Try again now". Once filed, the copy is deleted. If the copy itself cannot be written, the handler fails and Email Routing records an error for that message in its logs.[^routing] What the sender's server does then has not been checked, so the copy is written before anything else that could fail.
- **The same message twice.** A message whose Message-ID is already in the inbox is not filed again, so a try after a half-finished filing, or a sender's server sending twice, makes no duplicate.
- **Mail going out.** A reply that the mail service turns down for a reason that may pass (busy, a sending limit reached, the domain still being set up, a network fault) waits and is tried again after 1, 5, 15, 30 and 60 minutes, about two hours in all, with the reason and the next try shown on the message. A reason that will not pass, such as an unverified sender, fails at once.[^send-errors] Once a reply is accepted, Email Service itself retries a receiving server that answers "try later" and reports the result as a delivery event.[^lifecycle] Outreach keeps its own pace and is not tried again this way.

This uses the database and the bucket the inbox already has, rather than a separate Cloudflare Queue, so there is nothing more to create or pay for, and a stuck message is visible in the Inbox rather than in a queue's dashboard.

## Limits

- Cloudflare Email Service takes at most 50 recipients and 25 MiB a message.[^limits] The compose form allows 18 MB of attachments, since encoding adds about a third; bigger files go as download links (see "Big files as links").
- On Workers Paid, 3,000 messages a month are included, then US$0.35 per 1,000 (Nov. 2026).[^pricing] Replies and notices are a small part of that; outreach does not count, because it goes through the outreach mailbox.
- The run every five minutes sends at most two outreach letters a batch, so at most 24 an hour for each running batch.
- Spam filtering is basic: it trusts the sender's own SPF, DKIM and DMARC results. Unwanted mail that passes those lands in the inbox and can be moved to Spam by hand.
- Conversations in Deleted are removed for good, with their files in the bucket, 30 days after they were deleted.

## Files

- `migrations/0013_mail.sql`: the tables; `migrations/20261123T0510_add_mail_writing.sql` adds those for signatures, saved replies, drafts, undo send and the away message; `migrations/20261123T0509_add_mail_blocked_senders.sql` adds blocked senders and keeps each message's unsubscribe headers; `migrations/20261123T1757_add_mail_inboxes.sql` adds the inboxes and who is on each; `migrations/20261123T1822_add_mail_linked_files.sql` adds big files sent as links; `migrations/20261123T1833_add_mail_retries.sql` adds retries for mail coming in and going out.
- `src/lib/mail.ts`: names, labels and small functions the pages share, including how a rule's conditions are matched.
- `src/lib/server/mail/`: settings, inboxes and who may open them (`inboxes.ts`, `inbox-access.ts`), message building (`mime.ts`), SMTP (`smtp.ts`), carriers, signed tokens, receiving (`inbound.ts`), sending (`outbound.ts`), conversations, folders and tags (`store.ts`), auto-sort rules (`rules.ts`), writing (`writing.ts`), the sender card, blocking and unsubscribing (`senders.ts`), big files as links (`linked-files.ts`), keeping arriving mail until it is filed (`arrivals.ts`), exporting (`export.ts`), outreach (`outreach.ts`) and the do-not-email list (`suppressions.ts`). Only `runtime.ts` and `socket-opener.ts` need the Worker; the rest is tested in Node (`tests/mail.test.ts`, `tests/mail-flow.test.ts`, `tests/mail-organize.test.ts`, `tests/mail-writing.test.ts`, `tests/mail-senders.test.ts`, `tests/mail-inboxes.test.ts`, `tests/mail-linked-files.test.ts`, `tests/mail-arrivals.test.ts`).
- `tools/add-mail-handlers.mjs`: adds the email, queue and scheduled handlers after the build. It wraps whatever entry the build made, so it runs last in `npm run build`.
- `src/routes/workspace/inbox/`, `src/routes/workspace/outreach/`: the pages. `src/routes/mail/`: the unsubscribe and acknowledgment pages, and the internal routes the handlers call.

## Sources

[^routing]: Cloudflare, "Email Routing," <https://developers.cloudflare.com/email-routing/>; Cloudflare, "Email handler," Email Service documentation, <https://developers.cloudflare.com/email-service/api/route-emails/email-handler/>.
[^send]: Cloudflare, "Send emails," Email Service documentation, <https://developers.cloudflare.com/email-service/get-started/send-emails/>; Cloudflare, "Email authentication," <https://developers.cloudflare.com/email-service/concepts/email-authentication/>.
[^terms]: Cloudflare, "Service-Specific Terms: Developer Platform," Email Service section, <https://www.cloudflare.com/service-specific-terms-developer-platform/>; Cloudflare, "Email Service FAQ," <https://developers.cloudflare.com/email-service/reference/faq/>.
[^sockets]: Cloudflare, "TCP sockets," Workers documentation, <https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/> (outbound connections on port 25 are not allowed).
[^events]: Cloudflare, "Event subscriptions," Email Service documentation, <https://developers.cloudflare.com/email-service/reference/event-subscriptions/>.
[^send-errors]: Cloudflare, "Workers API," Email Service documentation, "Error codes," <https://developers.cloudflare.com/email-service/api/send-emails/workers-api/>.
[^lifecycle]: Cloudflare, "Email lifecycle," Email Service documentation, <https://developers.cloudflare.com/email-service/concepts/email-lifecycle/>.
[^limits]: Cloudflare, "Limits," Email Service documentation, <https://developers.cloudflare.com/email-service/platform/limits/>.
[^pricing]: Cloudflare, "Pricing," Email Service documentation, <https://developers.cloudflare.com/email-service/platform/pricing/>.
[^zoho-price]: Zoho, "Zoho Mail pricing (USD)," <https://www.zoho.com/mail/images/mail-pricing-usd.pdf>.
[^zoho-smtp]: Zoho, "Zoho Mail SMTP configuration," <https://www.zoho.com/mail/help/zoho-smtp.html>.
[^zoho-limits]: Zoho, "Email sending limits," <https://www.zoho.com/mail/help/adminconsole/email-sending-limits.html>.
[^rfc3834]: K. Moore, "Recommendations for Automatic Responses to Electronic Mail," RFC 3834 (2004), <https://www.rfc-editor.org/rfc/rfc3834>.
[^rfc3464]: K. Moore & G. Vaudreuil, "An Extensible Message Format for Delivery Status Notifications," RFC 3464 (2003), <https://www.rfc-editor.org/rfc/rfc3464>.
[^rfc8058]: J. Levine & T. Herkula, "Signaling One-Click Functionality for List Email Headers," RFC 8058 (2017), <https://www.rfc-editor.org/rfc/rfc8058>.
[^rfc3676]: R. Gellens, "The Text/Plain Format and DelSp Parameters," RFC 3676 (2004), section 4.3, <https://www.rfc-editor.org/rfc/rfc3676#section-4.3>.
[^waituntil]: Cloudflare, "Context (ctx)," Workers documentation, `waitUntil`, <https://developers.cloudflare.com/workers/runtime-apis/context/#waituntil>.
[^rfc2369]: G. Neufeld & J. Baer, "The Use of URLs as Meta-Syntax for Core Mail List Commands and their Transport through Message Header Fields," RFC 2369 (1998), section 3.2, <https://www.rfc-editor.org/rfc/rfc2369#section-3.2>.
[^rfc4155]: E. Hall, "The application/mbox Media Type," RFC 4155 (2005), <https://www.rfc-editor.org/rfc/rfc4155>.
[^rfc6266]: J. Reschke, "Use of the Content-Disposition Header Field in the Hypertext Transfer Protocol (HTTP)," RFC 6266 (2011), section 4.3, <https://www.rfc-editor.org/rfc/rfc6266#section-4.3>.
