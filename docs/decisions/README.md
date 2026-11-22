# Decision records

Short, numbered records of why key choices were made, in the style Michael
Nygard described as "architecture decision records"
([Cognitect, 2011](https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions)).
They are called decision records here because "ADR" in this project means
alternative dispute resolution.

A record is never rewritten after it is accepted. A later record supersedes it
and says so.

| No. | Decision | Status |
| --- | --- | --- |
| [0001](0001-adopt-care-principles.md) | Adopt the CARE Principles through a project charter | Accepted |
| [0002](0002-license-by-material.md) | License each kind of material differently | Accepted |
| [0003](0003-three-version-tracks.md) | Version content, website and print separately from 0.0.1 | Accepted |
| [0004](0004-content-as-plain-files.md) | Keep content as plain files in git, one file per entity | Accepted |
| [0005](0005-print-with-lulu.md) | Print and distribute through Lulu, typeset with Typst | Accepted |
| [0006](0006-secrets-only-in-cloudflare.md) | Keep secrets only in Cloudflare | Accepted |
| [0007](0007-map-shows-state-presence.md) | Map shows state presence, not boundaries | Accepted |
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
| [0019](0019-story-records.md) | Record stories in their tellers' own words, with credit, permissions and protocols | Accepted |
| [0020](0020-file-every-contribution-from-a-person.md) | Keep a signed filing for every contribution that comes from a person | Proposed |
| [0022](0022-open-registration-for-contributors.md) | Let people register to help; keep workspace access with the lead author | Proposed |
| [0023](0023-permission-levels-per-document.md) | Give each person a level on each document; keep a sealed activity log | Accepted |
| [0024](0024-own-sign-in.md) | Sign people in with the site's own email codes and passwords, not Auth0 | Accepted |

Template: Status, Date, Context, Decision, Consequences, Sources.
