# Requests from Native nations and contributors

**Status:** specification for the website, not yet built. Until it is, use the
[interim route](#until-the-website-is-live).

This page specifies how a Native nation, or anyone connected to one, asks the
project to correct, restrict or remove material, or offers to contribute. It
implements [charter commitment 6](charter.md#6-the-right-to-correct-restrict-or-withdraw).
Everything here is project design unless a source is cited.

## Principles

1. **Private by default.** Requests never go through public GitHub issues,
   because a request may itself describe restricted knowledge or identify the
   person asking ([decision record 0009](decisions/0009-private-requests-from-nations.md)).
2. **Protect first, review second.** A request to restrict or remove takes the
   material out of public view before it is reviewed (charter, commitment 6).
3. **The nation decides.** A request about a nation is confirmed with the
   nation's own office before it is final (charter, commitment 4).
4. **No account needed.** Nobody needs a GitHub account or any other account to
   send a request.

## Where the request starts

- A link in the footer of every page: "Request a correction or removal".
- A button on every Tribe profile, and on any page that names a nation: "Is
  this about your nation?"
- A link on every glossary entry: "Suggest a change to this term".
- A "Contribute" link in the main menu.

Each link opens `/requests` with the page and record already filled in.

## The form, step by step

1. **What would you like to do?** Correct something; Restrict or remove
   something; Contribute (sources, review, terms, writing); Ask a question.
2. **Which material?** Pre-filled from the page that opened the form; more
   pages can be added. For a restriction, the form asks the person **not** to
   repeat the sensitive material, only to say where it is.
3. **Who are you?** Name; nation; role; whether they are writing on behalf of
   the nation's government or one of its offices; how to reach them (email or
   phone). Only a way to reply is required.
4. **Details.** What is wrong, what should change, or what they offer.
   Optional file upload (for example a nation's resolution or a corrected
   citation).
5. **Credit and permission** (Contribute only). How they want to be credited
   (name, nation, role, or not at all), and whether the material may be
   published under the project's licenses or shared for review only.
6. **Confirmation.** A reference number, the date, and what happens next, also
   sent by email if an address was given.

## What happens after a request

| Step | Who | Target |
| --- | --- | --- |
| Acknowledge the request | Maintainer | Within 7 days |
| Hide material named in a restrict or remove request | Maintainer | Within 7 days, before review |
| Confirm with the nation's office, if the requester is not that office | Maintainer | When needed |
| Decide and make the change (correct, restrict, withdraw, add) | Maintainer, with the nation | Within 30 days, or tell the requester why it will take longer |
| Release the change | Release process | Next release, or a correction release |
| Close the request and tell the requester | Maintainer | At release |

These targets are the project's own and assume a single volunteer maintainer;
they will be reviewed once the request page is in use.

### Request statuses

`received` → `acknowledged` → `hidden-pending-review` (restrict and remove
only) → `confirming-with-nation` (when needed) → `resolved`, with one of
`corrected`, `restricted`, `withdrawn`, `added`, `answered` or
`declined` (with the reason given to the requester).

### Effect on records

| Outcome | Record change |
| --- | --- |
| Corrected | The record is edited; the source of the correction is cited or recorded in the record's notes. |
| Restricted | `sensitivity.restricted: true`, or `sensitivity.tribal_review_required: true` while review continues ([data-model.md](data-model.md#sensitivity-flags)). |
| Withdrawn | `review.status: withdrawn-at-request`; the record's text is removed. |
| Added | New or updated records, with the contributor credited as they chose. |

### Public log

Each resolved request that changes content appears in the content changelog
and on a public "Requests log" page with the date, the record identifier and
the action (for example "Record withdrawn at the request of the nation"). It
never repeats withdrawn content or names the requester. Whether the nation is
named is the nation's choice.

## How it is built

The design below fits the website stack already chosen (SvelteKit on
Cloudflare Workers, with D1 for application data and R2 for files) and keeps
all secrets in Cloudflare
([decision record 0006](decisions/0006-secrets-only-in-cloudflare.md)).

- **Form:** a server-rendered SvelteKit page that works without JavaScript,
  protected from spam by a bot check that does not require an account.
- **Storage:** requests in a D1 table, never in git. Uploaded files in a
  private R2 bucket. Neither is exposed through any public API.
- **Notification:** the maintainer is emailed a link to the request, not its
  contents.
- **Maintainer view:** a `/admin/requests` page behind Cloudflare's access
  control, listing requests by status.
- **Retention:** personal details are deleted 12 months after a request is
  resolved, unless the person is credited as a contributor (project choice).
- **Changes to content** are still made by pull request, with a commit message
  that does not repeat withdrawn material, for example
  `fix(content): withdraw record at the request of the nation`.

## Until the website is live

- **Restricted or sensitive material:** report it privately through GitHub's
  private vulnerability reporting (Security tab, "Report a vulnerability"), as
  [SECURITY.md](../SECURITY.md) already describes for privacy problems, or
  contact the maintainer through [the maintainer's GitHub profile](https://github.com/Phauks).
  Do not open a public issue.
- **Public corrections and contributions** that involve no sensitive material
  can use the repository's issue forms.

A dedicated project contact address will replace the interim route when the
project domain is set up.
