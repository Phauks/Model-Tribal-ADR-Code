# 0023. Give each person a level on each document; keep a sealed activity log

- **Status:** Accepted
- **Date:** 2026-11-21

## Context

Decision record 0013 gave each person who signs in one role (lead author, editor, advisor, co-author, nation reviewer), and the role alone decided what they could do. The lead author asked on Nov. 21, 2026 for finer control as the site gains essays and a website editor:

- as the administrator, access to everything, and to the accounts of everyone else: giving access, restricting it, changing it, and an overview of all of it;
- per-document access, for example to one essay, at the levels "no access", "comment" and "contribute", with full control above that;
- no view-only level, because a reader who cannot comment gives the project no feedback;
- protection against people changing material they are not allowed to change.

Two other pieces of work depend on this: the website editor (decision record
0021) and contributor profiles (decision record 0022).

## Decision

**Two layers.** A person's role still decides workspace-wide tasks: only the lead author manages people and access, only editors and the lead author handle requests, only the lead author, editors and advisors sign off. For documents, each person has a level on each document:

| Level | Allows |
| --- | --- |
| No access | Cannot open the document or see that it is being worked on. |
| Comment | Reads the document and its drafts, and comments. The lowest level that opens a document. |
| Contribute | Comment, and edits the draft and saves versions of it. |
| Full | Contribute, and restores an earlier version, resolves or hides others' comments, and submits the draft for publishing. |

**Where a level comes from**, most specific first: the lead author always has full access and cannot be restricted, so the project can never be locked out of its own work; then a grant for that document; then a grant for every document of its kind (which also covers drafts that have no file yet); then the role's default. Defaults: lead author full; editor contribute; advisor and co-author comment; contributor and nation reviewer no access, except that a nation reviewer comments on and approves their own nation's record. A grant of "no access" is how access is restricted. A grant can end on a date.

**A contributor role** for people who write or edit assigned material and see nothing else, such as an essay author from outside the project.

**Granting stays with the lead author.** Full access to a document does not let a person grant access to others. This keeps one place where access is decided and reviewed.

**Every check runs on the server, on every request**, reading the person and their grants from the database, so a removed person or a lowered grant takes effect on the next request even mid-session (OWASP, Authorization Cheat Sheet). The editing rooms re-check on every save.

**Unauthorized changes** are resisted in four ways:

1. *Authorization checks* as above, with deny by default: a person with no role default and no grant has no access.
2. *Cross-site request forgery*: SvelteKit's own origin check for forms, plus a second check on every change in the workspace using the browser's `Sec-Fetch-Site` header, or `Origin` where that is missing (OWASP, Cross-Site Request Forgery Prevention Cheat Sheet); the session cookie is `SameSite=Lax`.
3. *Rate limits*: each signed-in person may make 30 changes a minute (Cloudflare Workers Rate Limiting binding, keyed by person, not address).
4. *A sealed activity log*: every change to people, access, reviews, requests and saved document versions, and every refused attempt, is an entry that the database refuses to change or delete, and each entry is sealed with a SHA-256 hash chained to the previous seal, so a change made directly in the database shows when the chain is checked (Schneier & Kelsey 1999; OWASP, Logging Cheat Sheet). The lead author can download the log with its seals and keep the latest seal outside Cloudflare.

**Reverting.** Published content changes only by pull request, so any change can be reverted with git. Drafts in the website editor keep named versions that someone with full access can restore (decision record 0021).

## Consequences

- The workspace gains an Access page (grants, an overview of people, grants and refused attempts, and whether the log is intact) and an Activity log page, both for the lead author only.
- Contribute and full matter once the website editor exists; until then the levels decide who can open and comment on each document in the workspace.
- Migration 0002 rebuilds the `people`, `reviews` and `events` tables. It was tested on a copy with data in it and with Wrangler's local database.
- Entries in the activity log can no longer be edited. Editors should not put requesters' contact details in request notes, because the 12-month deletion of personal details (docs/requests.md) cannot reach the log. If a legal duty ever requires removing an entry, that is a reviewed migration, and the seal check will then show where the log changed, as it should.
- The seal chain shows tampering; it does not prevent someone with full control of the Cloudflare account from rewriting both the log and its seals. A copy of the latest seal kept elsewhere, and D1 Time Travel, cover that case.

## Sources

- Cloudflare, *Rate Limiting*, Cloudflare Workers Docs, https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/ (last visited Nov. 21, 2026).
- Cloudflare, *Define foreign keys*, Cloudflare D1 Docs, https://developers.cloudflare.com/d1/sql-api/foreign-keys/ (last visited Nov. 21, 2026).
- Cloudflare, *Time Travel and backups*, Cloudflare D1 Docs, https://developers.cloudflare.com/d1/reference/time-travel/ (last visited Nov. 21, 2026).
- OWASP Foundation, *A01:2021 – Broken Access Control*, OWASP Top 10, https://top10.owasp.org/2021/A01_2021-Broken_Access_Control/index.html (last visited Nov. 21, 2026).
- OWASP Foundation, *Authorization Cheat Sheet*, https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html (last visited Nov. 21, 2026).
- OWASP Foundation, *Cross-Site Request Forgery Prevention Cheat Sheet*, https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html (last visited Nov. 21, 2026).
- OWASP Foundation, *Logging Cheat Sheet*, https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html (last visited Nov. 21, 2026).
- Karen Kent & Murugiah Souppaya, Nat'l Inst. of Standards & Tech., *Guide to Computer Security Log Management*, NIST Special Publication 800-92 (2006), https://csrc.nist.gov/pubs/sp/800/92/final.
- Bruce Schneier & John Kelsey, *Secure Audit Logs to Support Computer Forensics*, 2 ACM Transactions on Information & System Security 159 (1999).
- SQLite, *ALTER TABLE*, https://www.sqlite.org/lang_altertable.html (last visited Nov. 21, 2026).
- Svelte, *Configuration: csrf*, SvelteKit Docs, https://svelte.dev/docs/kit/configuration#csrf (last visited Nov. 21, 2026).
