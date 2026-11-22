# Requests from Native nations and contributors

**Status:** specification for the website. The form and the maintainer's view
are built ([site/COLLABORATION.md](../site/COLLABORATION.md)); email
notification and the public log are not yet. Until the form is live on the
site, use the [interim route](#until-the-website-is-live).

This page specifies how a Native nation, or anyone connected to one, asks the
project to correct, restrict or remove material, asks to add a nation that is
missing, or offers to contribute. It
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
4. **A missing nation can ask to be added.** A nation the project's research
   missed can apply, with proof that a government source names it
   ([adding a nation that is missing](#adding-a-nation-that-is-missing)).
5. **No account needed.** Nobody needs a GitHub account or any other account to
   send a request.

## Where the request starts

- A link in the footer of every page: "Request a correction or removal".
- A button on every Tribe profile, and on any page that names a nation: "Is
  this about your nation?"
- A link on every glossary entry: "Suggest a change to this term".
- A "Contribute" link in the main menu.
- A line at the top of the nations directory, and on a search with no
  matching nation: "Is your nation missing? Ask to be added".

Each link opens `/requests` with the page and record already filled in.

## The form, step by step

1. **What would you like to do?** Correct something; Restrict or remove
   something; Add a nation that is missing; Contribute (sources, review,
   terms, writing); Ask a question. Adding a nation follows its own steps,
   described [below](#adding-a-nation-that-is-missing).
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
   published under the project's licenses or shared for review only. Material
   that is not already published (an interview, a story, an unpublished
   document) instead opens a filing with a signed contributor statement
   ([contributions.md](contributions.md)).
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
only) → `checking-proof` (adding a missing nation only) →
`confirming-with-nation` (when needed) → `resolved`, with one of
`corrected`, `restricted`, `withdrawn`, `added`, `answered` or
`declined` (with the reason given to the requester). While the project waits
for something only the requester can send, such as a readable copy of a
source, the request is `waiting-for-requester`.

### Effect on records

| Outcome | Record change |
| --- | --- |
| Corrected | The record is edited; the source of the correction is cited or recorded in the record's notes. |
| Restricted | `sensitivity.restricted: true`, or `sensitivity.tribal_review_required: true` while review continues ([data-model.md](data-model.md#sensitivity-flags)). |
| Withdrawn | `review.status: withdrawn-at-request`; the record's text is removed. |
| Added | New or updated records, with the contributor credited as they chose. |
| Added (a missing nation) | A new Tribe profile, drafted from the official source and sent to the nation before it is published; see [below](#if-the-nation-is-added). |

### Public log

Each resolved request that changes content appears in the content changelog
and on a public "Requests log" page with the date, the record identifier and
the action (for example "Record withdrawn at the request of the nation"). It
never repeats withdrawn content or names the requester. Whether the nation is
named is the nation's choice.

## Adding a nation that is missing

The project's list of Native nations was built from government sources, so it
can miss a nation. A nation that is not listed can ask to be added. This
section is project design; the sources it names are cited where they appear.

### Who can be added

A nation is added when **a federal or state government source names it as a
Native nation, Tribe, band or community**. This is the rule the dataset was
built with: a group is included "only when a federal government source"
names it, and groups "known only from their own websites or press were not
considered" (research log
`research/sessions/2026/2026-11-21-other-nonfederal-groups.md`, in the Tribe
profile dataset), widened here to state sources because the dataset already
records state recognition. The record shows what the source says, for example
federal recognition, state recognition or a pending petition, and makes no
judgment beyond it.

Self-identification alone is not enough under this rule. The project does not
decide who is a Native nation, and a government source is the evidence a
reader can check for themselves (project reasoning). A nation that does not
meet the rule today can apply again whenever a new source names it.

### What counts as proof

One source is enough. The applicant can cite it, upload it, or both.

| Kind of source | Examples | Recorded as |
| --- | --- | --- |
| Federal recognition | The nation's entry in the list of federally recognized Tribes that the Department of the Interior publishes in the Federal Register each year under [25 U.S.C. § 5131](https://www.law.cornell.edu/uscode/text/25/5131); an act of Congress recognizing or restoring the nation | `federal` |
| State recognition | A state statute or resolution recognizing the nation; a state Indian affairs commission's official list; a governor's executive order | `state` |
| Federal acknowledgment petition | The nation's petition record with the Office of Federal Acknowledgment under [25 C.F.R. part 83](https://www.ecfr.gov/current/title-25/chapter-I/subchapter-F/part-83), such as a letter of intent or a published finding | `petitioning` |
| Another official source | A termination statute that names the nation; a Census Bureau tribal statistical area named for it; a federal agency report, funding list or award record that names it as a Tribe | `unrecognized`, meaning "not federally recognized", with a note saying what the source states |

These do not count on their own: the nation's own website, articles or books,
membership in a private association, a registration as a nonprofit or
business, and genealogy or ancestry records. They are still welcome as
supporting material once a government source qualifies the nation.

A nation already on the federal list but missing from the site is the
project's mistake. It is handled as a correction and fixed in the next
correction release, without the full review below.

### The form

The request form branches to these steps when "Add a nation that is missing"
is chosen. Each step is one question, as in the rest of the form.

1. **The nation.** Its name as the government source writes it; the name the
   nation uses for itself, in any language or script (optional); the states
   where it is located.
2. **Proof.** One or more sources. For each: what kind it is (from the table
   above), its title, a citation or web address, its date, and where in it the
   nation is named (page, section or entry). An upload is accepted instead of,
   or as well as, a citation, as PDF or an image. The form explains that a
   readable copy helps when a source is not online.
3. **Who you are.** Name, role, how to reach them, and whether they are
   writing on behalf of the nation's government or an office it designates.
4. **Statement.** A required checkbox: "I am authorized by this nation's
   government to make this request, and the information I gave is accurate
   to the best of my knowledge." Someone who is not authorized can still tell
   the project about a missing nation by choosing "I am not writing for the
   nation's government"; the project then contacts the nation itself.
5. **Check your answers**, then a reference number and the date.

The confirmation says what happens next, how long it usually takes, and that
the application and any uploads are kept private.

### How the project reviews it

1. **Acknowledge** within 7 days.
2. **Check the proof** (`checking-proof`). The maintainer opens each source
   from the government's own publication, not only the uploaded copy, saves an
   archived copy as the methodology requires, and confirms that it names the
   nation. If a source cannot be found or read, the request moves to
   `waiting-for-requester` with a specific question.
3. **Check for a match.** The maintainer searches the dataset for the nation
   under other names, because sources spell names differently. A match is
   handled as a correction to that record.
4. **Confirm with the nation** (`confirming-with-nation`) when the requester
   is not writing for the nation's government. The nation is contacted through
   its public contact route. The nation is not added if its government says no.
5. **Decide** within 30 days of acknowledgment, or tell the requester why it
   will take longer.

Applications and uploads stay in the private request store described under
[how it is built](#how-it-is-built), never in git or a public issue.

### If the nation is added

- A new Tribe profile is drafted from the qualifying source, with the
  recognition fact citing it and the recognition status from the table above.
- The record's review status is `sent-to-nation`, and the draft is sent to the
  nation before it is published (charter, commitment 4).
- The nation can then add its own words, sources and preferred names through
  the usual requests, credited as it chooses.
- The public log records "Record added at the request of the nation", naming
  the nation only if it agrees.

No new record fields are needed: the application stays in the request store,
and the profile cites the government source, not the application.

### If the application is declined

The requester receives the decision in writing, with:

- which part of the rule the proof did not meet, for example "the source names
  an organization of that name but not as a Tribe";
- the sources the maintainer checked;
- what kind of source would meet the rule.

A declined application is never published or listed anywhere.

### Applying again or asking for reconsideration

- **Apply again** at any time with new or different proof, under the same
  reference number so the earlier review is kept with it.
- **Ask for reconsideration** within 60 days if the requester believes the
  rule was applied wrongly. A reconsideration is reviewed again from the
  start, with a project advisor who did not take part in the first decision
  where one is available, and answered within 30 days.
- **If the rule changes**, for example to accept other kinds of sources,
  every declined application is reviewed again under the new rule and the
  requester is told the outcome.

## How it is built

The design below fits the website stack already chosen (SvelteKit on
Cloudflare Workers, with D1 for application data and R2 for files) and keeps
all secrets in Cloudflare
([decision record 0006](decisions/0006-secrets-only-in-cloudflare.md)).

- **Form:** a server-rendered SvelteKit page that works without JavaScript,
  protected from spam without asking for an account or a puzzle: a hidden
  field that bots fill in, and a limit of five submissions a minute from one
  connection.
- **Storage:** requests in a D1 table, never in git. Uploaded files in a
  private R2 bucket. Neither is exposed through any public API.
- **Notification:** the maintainer is emailed a link to the request, not its
  contents.
- **Maintainer view:** `/workspace/requests`, for editors who sign in to the
  site ([decision record 0024](decisions/0024-own-sign-in.md)),
  listing requests by status with the targets above.
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
