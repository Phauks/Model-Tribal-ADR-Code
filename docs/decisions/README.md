# Decision records

Short, numbered records of why key choices were made, in the style Michael Nygard described as "architecture decision records" ([Cognitect, 2011](https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions)). They are called decision records here because "ADR" in this project means alternative dispute resolution.

A record is never rewritten after it is accepted. A later record supersedes it and says so.

| No. | Decision | Status |
| --- | --- | --- |
| [0001](0001-adopt-care-principles.md) | Adopt the CARE Principles through a project charter | Accepted |
| [0002](0002-license-by-material.md) | License each kind of material differently | Accepted |
| [0003](0003-three-version-tracks.md) | Version content, website and print separately from 0.0.1 | Accepted |
| [0004](0004-content-as-plain-files.md) | Keep content as plain files in git, one file per entity | Accepted |
| [0005](0005-print-with-lulu.md) | Print and distribute through Lulu, typeset with Typst | Accepted |
| [0006](0006-secrets-only-in-cloudflare.md) | Keep secrets only in Cloudflare | Accepted |
| [0007](0007-map-shows-state-presence.md) | Map shows state presence, not boundaries | Accepted; amended by 0029 |
| [0008](0008-pull-requests-without-required-approval.md) | Require pull requests and checks, not a second approval | Accepted |
| [0009](0009-private-requests-from-nations.md) | Take requests from nations privately, not in public issues | Accepted |
| [0010](0010-glossary-records-and-term-links.md) | Define terms once, as records, and link them from text | Accepted |
| [0011](0011-ebook-custom-pipeline.md) | Build the ebook with a custom pipeline | Accepted |
| [0012](0012-outreach-list-split-public-and-private.md) | Keep outreach organizations public and the outreach plan private | Accepted |
| [0012](0012-open-list-of-dispute-resolution-methods.md) | Keep the list of dispute resolution methods open | Accepted |
| [0013](0013-sign-in-with-auth0.md) | Sign in co-authors with Auth0; keep roles in the site's database | Superseded by 0024 (sign-in); roles part stands |
| [0014](0014-verification-levels-and-record-lint.md) | Record how each fact was checked, and lint for unchecked data | Accepted |
| [0015](0015-database-listings-apart-from-provisions.md) | Keep bulk database entries apart from dispute resolution provisions | Accepted |
| [0016](0016-component-bands-own-profiles.md) | Give component bands their own profiles | Accepted |
| [0017](0017-serve-nation-images-from-the-private-bucket.md) | Serve nations' seals and logos from the private bucket | Accepted |
| [0018](0018-document-version-history.md) | Record every version of a document, and how its key clauses changed | Accepted |
| [0019](0019-story-records.md) | Record stories in their tellers' own words, with credit, permissions and protocols | Accepted; website display amended by 0029 |
| [0020](0020-file-every-contribution-from-a-person.md) | Keep a signed filing for every contribution that comes from a person | Proposed |
| [0021](0021-edit-drafts-in-the-browser-keep-essays-in-the-bucket.md) | Edit essays on the website; keep them in the private bucket | Accepted |
| [0022](0022-open-registration-for-contributors.md) | Let people register to help; keep workspace access with the lead author | Accepted |
| [0023](0023-permission-levels-per-document.md) | Give each person a level on each document; keep a sealed activity log | Accepted |
| [0024](0024-own-sign-in.md) | Sign people in with the site's own email codes and passwords, not Auth0 | Accepted |
| [0025](0025-search-logs.md) | Log every search for a nation's information, including the ones that fail | Accepted |
| [0026](0026-model-peacemaking-code.md) | Write model peacemaking provisions as part of the project's model code | Accepted |
| [0027](0027-diversion-and-restorative-justice-in-the-research-base.md) | Keep diversion and restorative justice records in the research base; apply the provision pre-review | Accepted |
| [0028](0028-map-adds-census-land-areas.md) | Add a land areas view to the map, from the Census Bureau's boundaries | Accepted |
| [0029](0029-show-stories-while-nations-review-them.md) | Show story records on the website while their nations review them | Accepted |
| [0030](0030-keep-research-captures-in-the-private-bucket.md) | Keep research captures in the private bucket, with an index in git | Accepted |
| [0031](0031-serve-copies-of-documents-from-the-private-bucket.md) | Serve the project's copies of cited documents, including nations' constitutions and laws | Accepted; amended by 0042 |
| [0032](0032-starred-pages-and-shared-collections-on-the-reader-s-device.md) | Starred pages, private notes and shared collections, kept on the reader's device | Accepted |
| [0033](0033-nation-page-map-has-the-big-maps-views.md) | Give the map on each nation's page the big map's views | Accepted |
| [0034](0034-show-stories-in-full-where-rights-allow.md) | Show the whole story on its page where the rights allow | Accepted; amended by 0036 |
| [0035](0035-follow-pages-with-notices-that-never-quote.md) | Following pages, with notices that never say what changed | Accepted |
| [0036](0036-show-every-story-in-full.md) | Show every story in full on the website | Accepted |
| [0037](0037-keep-a-copy-of-every-directly-cited-page.md) | Keep our own copy of every page a record directly cites | Accepted |
| [0038](0038-files-people-send-stored-in-the-bucket-with-youtube-links.md) | Files people send are stored in the private bucket, and a video can be a YouTube link | Accepted |
| [0039](0039-website-map-uses-maplibre-and-our-own-tiles.md) | Draw the website's map with MapLibre and the project's own map tiles | Accepted |
| [0040](0040-project-inbox-on-cloudflare.md) | Keep the project's email in the website, with outreach through a separate mailbox | Accepted |
| [0041](0041-nation-teams-keep-their-own-pages.md) | Let each nation choose a team that keeps its own page, with delegation inside that nation only | Accepted |
| [0042](0042-governance-facts-from-governing-documents.md) | Record how each nation's government is set up, as plain facts from its own documents | Accepted |
| [0042](0042-link-to-the-national-indian-law-library-for-its-copies.md) | Link to the National Indian Law Library for copies taken from it | Accepted |
| [0043](0043-link-to-the-national-indian-law-library-for-its-copies.md) | Link to the National Indian Law Library for copies taken from it | Accepted |
| [0044](0044-order-printed-copies-through-the-lulu-print-api.md) | Order printed copies on the website through the Lulu Print API | Proposed |
| [0045](0045-separate-settings-from-account-settings.md) | Keep display settings on the device and account settings on Account pages | Accepted |
| [0046](0046-scan-files-with-clamav-in-a-cloudflare-container.md) | Scan files for malware with ClamAV in a Cloudflare Container, and hold them until clean | Accepted |
| [0047](0047-show-tribal-court-opinions-from-the-caselaw-access-project.md) | Show tribal court opinions from the Caselaw Access Project on the website | Accepted |
| [0048](0048-events-and-registration.md) | List events on the website and take registrations, with continuing legal education later | Accepted |
| [0049](0049-draft-model-court-forms-before-gate-2.md) | Draft model court forms for people using Tribal courts before Gate 2 | Accepted |
| [0050](0050-sponsor-accounts-on-the-account-pages.md) | Give sponsors an account page, with billing on Stripe's own pages | Proposed |
| [0051](0051-search-the-source-documents-through-a-private-full-text-library.md) | Search the source documents through a private full-text library | Accepted |
| [0054](0054-edit-the-site-text-from-the-website.md) | Edit the site text from the website, and rebuild the site to publish it | Accepted |
| [0055](0055-limit-scripts-and-framing-with-security-headers.md) | Limit scripts and framing with a Content Security Policy and security headers | Accepted |
| [0056](0056-let-nations-restrict-their-laws-and-opinions.md) | Let a nation choose how the site shows its own laws and court opinions | Accepted |
| [0057](0057-replace-names-in-tribal-court-opinions-with-initials.md) | Replace names in Tribal court opinions with initials | Accepted |
| [0058](0058-draw-item-pages-on-request.md) | Draw the large families of item pages when a reader opens them | Accepted |
| [0059](0059-watch-for-new-legal-sources-with-plug-in-watchers.md) | Watch for new and changed legal sources with plug-in watchers, and review every find by hand | Accepted |
| [0060](0060-serve-state-agreements-and-state-court-opinions.md) | Serve copies of Oklahoma's filed state-tribal agreements and of published state court opinions | Accepted |
| [0061](0061-keep-public-worker-answers-at-the-edge.md) | Keep the Worker's public answers at Cloudflare's edge, and nothing personal | Accepted |
| [0062](0062-add-passkeys-outside-sign-in-and-a-person-check.md) | Add passkeys, Google and Microsoft sign-in, and Cloudflare Turnstile on public forms | Accepted |
| [0066](0066-show-case-opinions-in-full-on-the-case-page.md) | Show a case's opinions in full on its page, read from the copy the site serves | Accepted |

Template: Status, Date, Context, Decision, Consequences, Sources.
