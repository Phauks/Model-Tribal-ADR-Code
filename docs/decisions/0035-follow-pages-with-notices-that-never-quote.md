# 0035. Following pages, with notices that never say what changed

- **Status:** Accepted
- **Date:** 2026-11-23

## Context

Trevor asked for a way to follow a nation (project chat, 2026-11-23): "Follow a nation would be interesting. Would it only be for users? Version history could be difficult for nations, as that could show redacted info?" He then asked for it to be built now, so that it works as soon as the project buys its domain, since the site cannot send email until then (docs/domain-to-do.md). Nations can ask for material to be taken off their page (decision record 0009, charter commitment 5). A public history of a nation page, or a notice that quoted what changed, would bring that material back.

## Decision

- **Following needs an account.** Anyone signed in can follow a nation's page, the model code or one of its sections, or an essay (Foundations, Essays and back matter). The Follow button (a bell) sits after Star in the masthead; a signed-out reader who presses it is told why an account is needed and offered sign-in, which returns them to the page. Stars stay on the device and need no account (decision record 0032); following has to know whom to tell.
- **A notice says only that a page was updated, and when.** It links to the page. It never quotes or summarizes what changed. The database stores only which page changed and when: no text and no title. Titles are looked up from the live site when a notice is shown, and a page that has left the site is not named.
- **Public version history is only for the model code and essays.** Their notices and emails also link to "What changed." Nation pages have no public history.
- **Updates are found by fingerprint.** The build fingerprints each nation page from its published record, as its download gives it (only the name and status for a page withdrawn at the nation's request), and its documents' version histories. A change in the site's design is not an update. An essay's fingerprint is the text of its newest listed publication. The Worker compares fingerprints every hour, on a new build's first signed-in request, and after an essay is published or held back.
- **Email is a summary, off until the domain exists.** Readers choose no email, a daily summary (the default) or a weekly one on their Following page. Nothing is sent while `UPDATE_EMAIL_FROM` is empty; setting it is the switch. Every email links to a page that turns the emails off without signing in. No secret is needed (decision record 0006).

## Consequences

- A notice cannot leak removed or restricted text, because it never holds any.
- A follower learns that a nation page changed on the day it changed. That fact is public anyway, since the site is rebuilt from a public repository.
- The site keeps a list of which account follows which page. It is shown only to that account; nobody else, the lead author included, sees it in the site.
- Updates are noticed within an hour of a deploy, or sooner when a signed-in reader visits.

## Sources

- Trevor Goldsmith, project chat, 2026-11-23, and the thread "Let users follow a nation."
- Decision records [0006](0006-secrets-only-in-cloudflare.md), [0009](0009-private-requests-from-nations.md) and [0032](0032-starred-pages-and-shared-collections-on-the-reader-s-device.md).
- Cloudflare, *Email Sending Workers API*, Cloudflare Email Service Docs, <https://developers.cloudflare.com/email-service/api/send-emails/workers-api/>.
- Cloudflare, *Cron Triggers*, Cloudflare Workers Docs, <https://developers.cloudflare.com/workers/configuration/cron-triggers/>.
