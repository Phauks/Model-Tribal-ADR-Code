# Data model

Every piece of content is a plain file with structured fields, checked against
a JSON Schema in [`schemas/`](../schemas/). The website, the print edition and
any future templates or API all read these same records. This document explains
each record type; the schemas are the exact definition.

Schemas use [JSON Schema draft 2020-12](https://json-schema.org/draft/2020-12),
and records are written in YAML (or YAML front matter on a Markdown file). One
valid example of each record is in [`schemas/examples/`](../schemas/examples/).

## How the records connect

```text
research session ──found──▶ source ◀──cites── provision / commentary / essay
                              │                     │
                              ├─ rights (permission) ├─ variables (placeholders)
                              ├─ archives, history   └─ tribes ──▶ tribe profile
                              └─ tribes ─────────────────────────▶ (states, review)
```

- A **research session** records how a source was found; the source points back
  with `found_in`.
- A **source** holds the citation data, archived copies, change history and
  rights. Text cites a source by its key, written `[@key]`.
- **Provisions**, **commentary** and **essays** cite sources and name the tribes
  they discuss.
- A **tribe profile** cites sources for every fact, including recognition and
  state presence.
- A **glossary entry** defines a term or acronym and cites its sources. Any
  text links to it as `[[id]]` (see [terminology.md](terminology.md)).
- A **method** record describes one way of resolving a dispute, from any
  tradition. Sources and provisions name the methods they concern in a
  `methods` list. The list of methods is open
  (see below).

## Record types

| Record | Schema | Stored as | Purpose |
| --- | --- | --- | --- |
| Source | [source.schema.json](../schemas/source.schema.json) | `content/sources/<letter>/<key>.yaml` | Citation data (CSL-JSON), original URL, archives, change history, citator check, rights |
| Rights | [permission.schema.json](../schemas/permission.schema.json) | the `rights` field of a source | Permission status, legal basis, redistribution, request log |
| Tribe profile | [tribe.schema.json](../schemas/tribe.schema.json) | `content/tribes/<letter>/<id>.yaml` | One Native nation or community: names, legal status, state presence, population, official contacts, government, justice institutions, dispute resolution practice, gaming, jurisdiction, consultation history; every fact cited with a confidence level |
| Provision | [provision.schema.json](../schemas/provision.schema.json) | `content/provisions/<chapter>-<section>.md` | Model text with alternatives and placeholders |
| Commentary | [commentary.schema.json](../schemas/commentary.schema.json) | `content/commentary/<chapter>-<section>.md` | Comment, Illustrations and Source Note for one provision |
| Glossary entry | [glossary.schema.json](../schemas/glossary.schema.json) | `content/glossary/<id>.yaml` | A defined term or acronym, its usage status and sources; linked from text as `[[id]]` |
| Method | [method.schema.json](../schemas/method.schema.json) | `content/methods/<id>.yaml` | One dispute resolution method: names (including in the community's language), classification, tradition, how it works, sources |
| Variables | [variable.schema.json](../schemas/variable.schema.json) | `content/variables/<group>.yaml` | Placeholders such as `{{nation.name}}` and their model text |
| Research session | [research-session.schema.json](../schemas/research-session.schema.json) | `research/sessions/<yyyy>/<yyyy-mm-dd>-<topic>.md` | How research was done and what it produced |
| Outreach organization | [outreach-organization.schema.json](../schemas/outreach-organization.schema.json) | `research/outreach/<id>.yaml` | An organization, office or nation the project may ask for help, why it matters, and its public contact path; not published on the website |
| Outreach plan (private) | [outreach-plan.schema.json](../schemas/outreach-plan.schema.json) | Outside git ([decision record 0012](decisions/0012-outreach-list-split-public-and-private.md)) | Named people, suggested asks, priority and contact log, keyed to outreach records |
| Shared types | [common.schema.json](../schemas/common.schema.json) | n/a | Slugs, dates, versions, state codes, review status, sensitivity flags |

## Tribe profiles

A profile describes one Native nation or community. Its folder is called
`tribes/` for continuity, but not every record is a Tribe: `entity_type` says
what the record is (project design).

| `entity_type` | Used for | Status recorded as |
| --- | --- | --- |
| `native-nation` | Tribal nations, bands, pueblos, rancherias, communities and Alaska Native villages, whatever their recognition | `federal`, `state`, `petitioning` or `unrecognized` |
| `native-hawaiian` | The Native Hawaiian community, which has no government in a formal government-to-government relationship with the United States | `congressional-special-relationship`, and Hawaiʻi state law as `state` |
| `territorial-indigenous-people` | Indigenous peoples of U.S. territories, such as CHamoru, Refaluwasch and Samoan people | `territorial-law` |
| `alaska-native-corporation` | Corporations formed under the Alaska Native Claims Settlement Act, which are not governments | Reserved; not yet used |

Native Hawaiians are never described with Tribal status categories. The
federal and state laws that describe their status are cited in their own
`recognition` entries. The Department of the Interior's 2016 rule sets a
procedure for reestablishing a government-to-government relationship and says
Native Hawaiians would not be added to the list of federally recognized
tribes, while also taking the view that Congress has treated the community as
an Indian tribe for constitutional purposes
([81 Fed. Reg. 71278](https://www.govinfo.gov/content/pkg/FR-2016-10-14/pdf/2016-23720.pdf)).
No government has been reestablished under it; the Justice Department's
Office of Legal Counsel wrote in December 2025 that "no Native Hawaiian
community has availed itself of this opportunity"
([slip opinion](https://www.justice.gov/media/1421576/dl)). The profile
records these sources side by side without resolving the question (project
choice).

### Every fact is cited

Every value in a profile carries the same citation fields
(`common.schema.json#/$defs/cited`):

| Field | Meaning |
| --- | --- |
| `source` | Key of the source record the value comes from |
| `confidence` | `high`, `medium` or `low`, defined below |
| `verification` | How closely the value was checked: `read-in-full`, `title-only`, `bulk-import` or `inferred`, defined below. Required on every new or changed fact |
| `as_of` | When the value was true or published: a year, year and month, or full date |
| `locator` | Where in the source: page, section, table or row |
| `note` | Anything a reader needs to weigh the value, such as a name match or a conflict |

Confidence levels (project choice):

- **high**: stated directly by a primary official source (the nation itself, a
  statute, a regulation, the Federal Register, or a federal or state agency
  list) published or updated within about five years.
- **medium**: a reputable secondary source, a primary source older than about
  five years, or a value that needed names matched between sources.
- **low**: a single unofficial source, an undated source, conflicting sources
  (explained in the note), or a search-result snippet.

Verification levels (project choice, decision record 0014). Confidence says
how good the source is; verification says how closely the value was checked
against it, so a high-confidence list can still be a bulk import:

- **read-in-full**: the part of the document that states the value was read.
- **title-only**: only a title, link text, heading or table-of-contents line
  was seen; the document itself was not opened.
- **bulk-import**: copied from a row of a list, directory, database or data
  table without opening the underlying document.
- **inferred**: derived rather than stated: matched to the nation by name,
  assigned by a rule (such as a state's Public Law 280 status), or taken from
  another nation's document.

When two apply, record the weaker one (inferred, then title-only, then
bulk-import). Facts recorded before Nov. 21, 2026 have no level yet;
`scripts/coverage_report.py` guesses theirs from their notes until they are
reviewed.

A value no source supports is left out. An empty field means "not found", not
"none".

### Contacts

Contacts are the government's official, publicly published office contact
points only: website, street and mailing address, main telephone and fax, and
a general office email address. Names, personal email addresses and personal
telephone numbers of officials are never recorded (charter, commitment 1).

### Population

Population figures measure different things and are never added together:
`citizens` (the nation's own count of its citizens or enrolled members),
`resident-population` (everyone living in an area, Native or not), census
self-identification counts, and service-area figures. Each figure keeps its
date.

### Dispute resolution

The `dispute_resolution` section records how a nation resolves disputes
outside, alongside or within its courts: its forums (with the nation's own
name for each, its legal basis, the kinds of cases it hears, how cases arrive,
how it relates to the Tribal court and how agreements are enforced), specific
code provisions, dispute resolution clauses and waivers of sovereign immunity
in commercial and other codes, training programs, and published rules and
forms. Gaming compact dispute terms are kept with each compact under `gaming`.

Entries copied in bulk from a database of tribal laws, without opening the law
itself, go in `database_listings`, not `provisions`. They keep the database's
own tags (`practice_area`, `phase`, `form_of_practice`) as it writes them and
carry `verification: bulk-import`. A listing becomes a provision only after the
law is read ([decision record 0015](decisions/0015-database-listings-apart-from-provisions.md)).

The vocabularies for kinds of forum, case types, participation, provisions
and clauses are open: any lowercase hyphenated term validates, so a method the
project has not anticipated can be recorded in its own terms. The schema lists
suggested terms; a term that becomes common gets a glossary record rather than
a schema change (project design). Traditional or ceremonial practice is
recorded only as far as the nation itself has made it public
([charter, commitment 5](charter.md#5-cultural-knowledge-and-restricted-material)).

### Names and languages

Names in a nation's own language are kept exactly as the nation writes them,
in Unicode Normalization Form C, with a BCP 47 language tag (for example
`chr`, `nv`, `haw`) and a romanized form only when the source gives one.

`names.pronunciation` records how to say a name, and only as an authoritative
source publishes it. The nation's own sources come first: its website, its
language program, or a recording it published. Each entry names the name it
pronounces and copies at least one of a sound-it-out `respelling`, a
`phonetic_transcription` or a link to a `recording`, exactly as the source
gives it. A pronunciation is never worked out from the spelling, and the
field is left out when no such source is found. A nation can ask for an entry
to be corrected or removed like any other fact
([charter, commitment 6](charter.md#6-the-right-to-correct-restrict-or-withdraw)).

### Seals, emblems, flags and logos

`official_images` records the nation's seal, emblem, flag or logo as its own
website publishes it: the link, the retrieval date, a SHA-256 fingerprint and
the path of a private copy that is never committed. Its `reuse` object lists
every signal about reusing the image (terms of use, trademark notices and
symbols, the nation's laws, the USPTO tribal insignia database, the nation's
own requests) and a status that follows from them; only some statuses allow the
image to be shown. `tribal_insignia_database_entries` lists the nation's
entries in that database. How signals are detected and the display rule are in
[official-images.md](official-images.md).

### Building profiles

The first profiles were generated from cited facts in `research/raw/`
(see its README) by `scripts/tribes/build_profiles.py`. After that, profiles
are edited by hand like any other record.

## Source fields for bibliographies

Besides citation data, a source record can carry the fields an annotated
bibliography needs: `jurisdictions` (federal, state, territory, tribal,
intertribal, multiple, international), `methods`, free `topics` tags, an
`annotation`, and `access`, which says whether the full text is free online or
must be pulled from Westlaw, Lexis, HeinOnline, a library or the publisher.

## Dispute resolution methods: an open list

The project does not fix the list of dispute resolution methods
([decision record 0012](decisions/0012-open-list-of-dispute-resolution-methods.md)).
Each method is a record in `content/methods/`, so a process nobody has
recorded is added as a new file with `status: proposed`, without changing any
schema. Each record says:

- **what it is called**, in English and in the language of the people who
  practice it;
- **how the project classifies it**: as ADR, as its own tradition (such as
  peacemaking or a customary process, which the project does not call ADR), as
  a court process, as a governmental process, or as unsettled;
- **where it comes from** (`tradition`), which may be more than one;
- **how it works**, as facets that any process can be described by: who
  decides, whether the outcome binds, what a neutral or leader does, whether
  taking part is voluntary or required, and where it happens. Every facet
  allows `varies` and `other`, with a note; and
- **how it relates** to other methods: a kind of (`broader`), a hybrid of
  (`combines`), or `related`.

The provision `track` list stays closed because it organizes the book; the
processes a provision governs are named through `methods`.

## Permission statuses

The build refuses to publish a quotation beyond a short passage unless the
source's rights status allows it.

| Status | Meaning |
| --- | --- |
| `not-assessed` | Default for a new source |
| `no-permission-needed` | Facts only, fair use, public domain, a U.S. government work, or an open license; the `basis` field says which |
| `permission-requested` | Request sent; the `log` records when and to which office |
| `granted` | Permission given; `scope` and `conditions` record its limits |
| `denied` | Link only; never reproduce |
| `tribal-review-required` | Community material that needs the nation's approval regardless of copyright |

The legal bases come from U.S. copyright law: no copyright in works of the
U.S. government ([17 U.S.C. § 105](https://www.law.cornell.edu/uscode/text/17/105)),
fair use ([17 U.S.C. § 107](https://www.law.cornell.edu/uscode/text/17/107)),
and the government edicts doctrine applied to official state legal texts in
[Georgia v. Public.Resource.Org, Inc., 590 U.S. 255 (2020)](https://www.supremecourt.gov/opinions/19pdf/18-1150_7m58.pdf).
Whether the edicts doctrine reaches tribal law is unsettled, and respect for
tribal sovereignty points toward asking, so the default for tribal legal texts
is `link-only` until a nation says otherwise (project analysis, not legal
advice).

## Review statuses

Records about a nation carry a consultation status, from
`drafted-from-public-sources` through `sent-to-nation`, `reviewed-by-nation` and
`approved-by-nation`, or `withdrawn-at-request` when a nation asks for a record
to be removed. A withdrawal request always wins (see the
[charter](charter.md)).

## Sensitivity flags

`sensitivity.restricted: true` means a record is never published, exported,
cached for offline use or served through any API. `tribal_review_required`
holds a record back until the nation approves. `local_contexts_notices` are
Notices this project applies; `local_contexts_labels` are Labels a community
applies through the [Local Contexts Hub](https://localcontexts.org/labels/about-the-labels/),
which only communities can do
([DataCite guidance](https://support.datacite.org/docs/local-contexts-notices-and-labels)).

## Built for templates

Provisions and forms write nation-specific words as placeholders, such as
`{{nation.name}}`, defined in `content/variables/`. The book prints each
placeholder's model text (for example "[Name of Nation]"); a future template
builder can substitute a nation's own values. Alternatives carry letter ids so a
builder can let a nation choose among them.

## Map data

The tribal map is drawn from each profile's `states` list: it shows which
states a nation has a presence in and does not draw boundaries
([decision record 0007](decisions/0007-map-shows-state-presence.md)).

## Validation

A check in continuous integration (to be added) will validate every record
against its schema, confirm every `[@key]` in the text resolves to a source,
confirm every `[[id]]` resolves to a glossary entry, flag unlinked first uses
of glossary terms and any use of an "avoid" term outside a quotation, and
confirm every `found_in` names an existing research session.
