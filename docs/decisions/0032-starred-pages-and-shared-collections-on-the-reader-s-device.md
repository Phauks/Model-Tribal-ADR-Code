# 0032. Starred pages, private notes and shared collections, kept on the reader's device

- **Status:** Accepted
- **Date:** 2026-11-22

## Context

The workspace's permission levels (decision record 0023) have no view-only level, because anyone who can open a draft can comment. Trevor then saw a use for a lighter, reader-facing account: a member of the public who reads the published site could "save certain statutes, notes, like star certain aspects" for their own work (project chat, 2026-11-21). A proposal set out a reader tier outside the permission model, in two steps. First come stars and notes on the reader's own device, with no account. Then an optional sign-in keeps them in step across devices, once the model code has final section numbers, so a star never points at a section that later moves. Trevor approved the two steps. He decided that readers, contributors and workspace members share one sign-in, so contributors get the same benefits, and that a reader can share a collection as an anonymous link "since the whole thing is public anyways" (2026-11-21 and 2026-11-22). He then asked for step 1 to be built.

## Decision

- **Step 1 is on the device.** A reader stars a page with a lasting address with the Star button in the masthead: a nation, a glossary entry, a story and, once published, a section of the code, an essay, a form or a source. Each can carry a plain-text note of up to 2,000 characters. Both live in the browser's local storage under `starred-items`, at most 500 pages. Nothing is sent to the site, the project holds no personal data, and no account is needed (`site/src/lib/starred-items.ts`, `/starred`).
- **Readers' data moves the way their settings do.** Settings, Data exports stars and notes in the reader data file, imports them by adding them to the reader's own (the reader's notes win), and deletes them on request (`site/src/lib/reader-data.ts`).
- **A shared collection is a link that carries its own list.** The title (up to 120 characters), an optional description (up to 500) and up to 100 page addresses are written as base64url JSON after `#c=` in `/starred/shared`. A fragment is not sent to the server, so the site stores nothing and cannot see what was shared (RFC 3986, section 3.5). The link names no one and never includes notes; it is a snapshot that cannot be withdrawn, which is acceptable because it lists only public pages (`site/src/lib/shared-collection.ts`).
- **A link cannot put words on the site beyond its title and description.** Only addresses a reader could star are kept, and each page is named from the site's own search index. The title and description are plain text, capped, and shown under "A reader's collection, shared by link." The site carries `noindex`.
- **Step 2 waits.** Syncing through the reader's sign-in, keyed by the same Auth0 subject the contributor profiles and workspace use, needs new tables and a migration, and starts after the model code has final section numbers. Its rules are already settled: owner-only reads and writes, the lead author sees counts only, saves and notes stay out of the sealed activity log, and deleting the account deletes them.

## Consequences

- Stars and notes are lost if the reader clears the browser's site data, as with the reading settings; the Starred page and Settings tell the reader to export to keep them.
- A reader on two devices carries stars by export and import until step 2.
- Large collections need a stored short link later; the shared page would not change.
- Nothing in the workspace permission model changes.

## Sources

- Trevor Goldsmith, project chat and the "Design permission tiers and admin controls" thread, 2026-11-21 and 2026-11-22.
- Proposal, "Reader accounts: saved items and private notes," 2026-11-22 (Claude Docs).
- Decision records [0001](0001-adopt-care-principles.md) and [0023](0023-permission-levels-per-document.md).
- T. Berners-Lee, R. Fielding & L. Masinter, *Uniform Resource Identifier (URI): Generic Syntax*, RFC 3986, § 3.5 (2005), <https://www.rfc-editor.org/rfc/rfc3986#section-3.5>.
- OWASP Foundation, *Cross Site Scripting Prevention Cheat Sheet*, <https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html>.
