# Data model

Every piece of content is a plain file with structured fields, checked against a JSON Schema in [`schemas/`](../schemas/). The website, the print edition and any future templates or API all read these same records. This document explains each record type; the schemas are the exact definition.

Schemas use [JSON Schema draft 2020-12](https://json-schema.org/draft/2020-12), and records are written in YAML (or YAML front matter on a Markdown file). One valid example of each record is in [`schemas/examples/`](../schemas/examples/).

## How the records connect

```text
research session ──found──▶ source ◀──cites── provision / commentary / essay
                              │                     │
                              ├─ rights (permission) ├─ variables (placeholders)
                              ├─ archives, history   └─ tribes ──▶ tribe profile
                              └─ tribes ─────────────────────────▶ (states, review)
```

- A **research session** records how a source was found; the source points back with `found_in`.
- A **source** holds the citation data, archived copies, change history and rights. Text cites a source by its key, written `[@key]`.
- **Provisions**, **commentary** and **essays** cite sources and name the tribes they discuss.
- A **tribe profile** cites sources for every fact, including recognition and state presence.
- A **glossary entry** defines a term or acronym and cites its sources. Any text links to it as `[[id]]` (see [terminology.md](terminology.md)).
- A **document history** lists every version of a document that changes over time (a compact and its amendments, a constitution and its revisions, a code and its editions). Each version cites its own source record, which names the version back (see below).
- A **method** record describes one way of resolving a dispute, from any tradition. Sources and provisions name the methods they concern in a `methods` list. The list of methods is open (see below).
- A **search log** records, for one nation and one topic, every place the project looked and what it found or why the search failed. It names the tribe profile by path (see below).

## Record types

| Record | Schema | Stored as | Purpose |
| --- | --- | --- | --- |
| Source | [source.schema.json](../schemas/source.schema.json) | `content/sources/<letter>/<key>.yaml` | Citation data (CSL-JSON), original URL, archives, change history, citator check, rights |
| Document history | [document-history.schema.json](../schemas/document-history.schema.json) | `content/documents/<letter>/<id>.yaml` | One document over time: every version with its dates, status, approval, what it amends or supersedes, a private capture, key clauses and how they changed |
| Rights | [permission.schema.json](../schemas/permission.schema.json) | the `rights` field of a source | Permission status, legal basis, redistribution, request log |
| Tribe profile | [tribe.schema.json](../schemas/tribe.schema.json) | `content/tribes/<letter>/<id>.yaml` | One Native nation or community: names, legal status, state presence, population, official contacts, government, justice institutions, dispute resolution practice, gaming, jurisdiction, consultation history; every fact cited with a confidence level |
| Provision | [provision.schema.json](../schemas/provision.schema.json) | `content/provisions/<chapter>-<section>.md` | Model text with alternatives and placeholders |
| Commentary | [commentary.schema.json](../schemas/commentary.schema.json) | `content/commentary/<chapter>-<section>.md` | Comment, Illustrations and Source Note for one provision |
| Glossary entry | [glossary.schema.json](../schemas/glossary.schema.json) | `content/glossary/<id>.yaml` | A defined term or acronym, its usage status and sources; linked from text as `[[id]]` |
| Method | [method.schema.json](../schemas/method.schema.json) | `content/methods/<id>.yaml` | One dispute resolution method: names (including in the community's language), classification, tradition, how it works, sources |
| Variables | [variable.schema.json](../schemas/variable.schema.json) | `content/variables/<group>.yaml` | Placeholders such as `{{nation.name}}` and their model text |
| Research session | [research-session.schema.json](../schemas/research-session.schema.json) | `research/sessions/<yyyy>/<yyyy-mm-dd>-<topic>.md` | How research was done and what it produced |
| Search log | [search-log.schema.json](../schemas/search-log.schema.json) | `research/search-logs/<topic>/<letter>/<profile id>.yaml` | How the project searched for one kind of information about one nation: each place looked, the outcome (found, not found, blocked, dead link and others) and why ([decision record 0025](decisions/0025-search-logs.md)) |
| Outreach organization | [outreach-organization.schema.json](../schemas/outreach-organization.schema.json) | `research/outreach/<id>.yaml` | An organization, office or nation the project may ask for help, why it matters, and its public contact path; not published on the website |
| Outreach plan (private) | [outreach-plan.schema.json](../schemas/outreach-plan.schema.json) | Outside git ([decision record 0012](decisions/0012-outreach-list-split-public-and-private.md)) | Named people, suggested asks, priority and contact log, keyed to outreach records |
| Contribution filing (private) | [contribution-filing.schema.json](../schemas/contribution-filing.schema.json) | Outside git ([decision record 0020](decisions/0020-file-every-contribution-from-a-person.md)) | Signed forms, items, permissions and log for material that came from a person rather than from a published source ([contributions.md](contributions.md)) |
| Shared types | [common.schema.json](../schemas/common.schema.json) | n/a | Slugs, dates, versions, state codes, review status, sensitivity flags, and the public-safe contribution fields (filing id, credit, permitted uses, access level, cultural authority) |

## Tribe profiles

A profile describes one Native nation or community. Its folder is called `tribes/` for continuity, but not every record is a Tribe: `entity_type` says what the record is (project design).

| `entity_type` | Used for | Status recorded as |
| --- | --- | --- |
| `native-nation` | Tribal nations, bands, pueblos, rancherias, communities and Alaska Native villages, whatever their recognition | `federal`, `state`, `petitioning` or `unrecognized` |
| `native-hawaiian` | The Native Hawaiian community, which has no government in a formal government-to-government relationship with the United States | `congressional-special-relationship`, and Hawaiʻi state law as `state` |
| `territorial-indigenous-people` | Indigenous peoples of U.S. territories, such as CHamoru, Refaluwasch and Samoan people | `territorial-law` |
| `alaska-native-corporation` | Corporations formed under the Alaska Native Claims Settlement Act, which are not governments | Reserved; not yet used |

Native Hawaiians are never described with Tribal status categories. The federal and state laws that describe their status are cited in their own `recognition` entries. The Department of the Interior's 2016 rule sets a procedure for reestablishing a government-to-government relationship and says Native Hawaiians would not be added to the list of federally recognized tribes, while also taking the view that Congress has treated the community as an Indian tribe for constitutional purposes ([81 Fed. Reg. 71278](https://www.govinfo.gov/content/pkg/FR-2016-10-14/pdf/2016-23720.pdf)). No government has been reestablished under it; the Justice Department's Office of Legal Counsel wrote in December 2025 that "no Native Hawaiian community has availed itself of this opportunity" ([slip opinion](https://www.justice.gov/media/1421576/dl)). The profile records these sources side by side without resolving the question (project choice).

Where the list of recognized entities names bands only inside another entity's entry, as it does for the six component reservations of the Minnesota Chippewa Tribe, each band has its own profile with `part_of` set to that entity's id. Its recognition cites the same entry, and counts of recognized entities leave it out so that no entity is counted twice ([decision record 0016](decisions/0016-component-bands-own-profiles.md)).

### Every fact is cited

Every value in a profile carries the same citation fields (`common.schema.json#/$defs/cited`):

| Field | Meaning |
| --- | --- |
| `source` | Key of the source record the value comes from |
| `confidence` | `high`, `medium` or `low`, defined below |
| `verification` | How closely the value was checked: `read-in-full`, `title-only`, `bulk-import` or `inferred`, defined below. Required on every new or changed fact |
| `as_of` | When the value was true or published: a year, year and month, or full date |
| `locator` | Where in the source: page, section, table or row |
| `note` | Anything a reader needs to weigh the value, such as a name match or a conflict |

Confidence levels (project choice):

- **high**: stated directly by a primary official source (the nation itself, a statute, a regulation, the Federal Register, or a federal or state agency list) published or updated within about five years.
- **medium**: a reputable secondary source, a primary source older than about five years, or a value that needed names matched between sources.
- **low**: a single unofficial source, an undated source, conflicting sources (explained in the note), or a search-result snippet.

Verification levels (project choice, decision record 0014). Confidence says how good the source is; verification says how closely the value was checked against it, so a high-confidence list can still be a bulk import:

- **read-in-full**: the part of the document that states the value was read.
- **title-only**: only a title, link text, heading or table-of-contents line was seen; the document itself was not opened.
- **bulk-import**: copied from a row of a list, directory, database or data table without opening the underlying document.
- **inferred**: derived rather than stated: matched to the nation by name, assigned by a rule (such as a state's Public Law 280 status), or taken from another nation's document.

When two apply, record the weaker one (inferred, then title-only, then bulk-import). Facts recorded before Nov. 21, 2026 have no level yet; `scripts/coverage_report.py` guesses theirs from their notes until they are reviewed.

A value no source supports is left out. An empty field means "not found", not "none".

### Contacts

Contacts are the government's official, publicly published office contact points only: website, street and mailing address, main telephone and fax, and a general office email address. Names, personal email addresses and personal telephone numbers of officials are never recorded (charter, commitment 1).

### Population

Population figures measure different things and are never added together: `citizens` (the nation's own count of its citizens or enrolled members), `resident-population` (everyone living in an area, Native or not), census self-identification counts, and service-area figures. Each figure keeps its date.

### Government

`government_structure` records the legal form a federal source gives, such as a constitution approved under the Indian Reorganization Act. `governance` records how the government is set up, one plain fact per item: an `aspect` (form, governing body and its size, selection and term, general council, head of government and its selection and term, other officers, elections, voting age, election authority, branches, separation of powers, the courts and their judges, amendment, the Secretary of the Interior's approval, recall and removal) and a `value` of a few words in the source's own names. A fact taken from a document's text also carries `quote`, the words that state it, copied exactly, and names the document's version in `document_version`; `scripts/governance/apply.py` keeps it only when the quote is in the text. Values are never summaries of a document ([decision record 0042](decisions/0042-governance-facts-from-governing-documents.md)). The search for each nation is logged in `research/search-logs/governance/`.

### Courts and other services

`justice_institutions` lists the nation's courts, courts of appeals, peacemaking programs, traditional forums and healing to wellness courts, each with a `kind`, its `name` and a `link`; `dispute_resolution.forums` (below) lists its dispute resolution forums, also with a `link`. Every service listed has a link, so a reader can reach it and a reviewer can check it (the lead author's rule, Nov. 22, 2026: "If we list a service, it should have a link"). The link is, in this order:

1. the service's own official page, on the nation's website or the court's or program's own website, fetched and showing the service;
2. only where no such page exists, the official directory entry that lists the service, such as a state court system's tribal court directory, the Bureau of Indian Affairs list of Courts of Indian Offenses, or an intertribal court's page listing the nations it serves. The fact's `note` says that the link is a directory entry and when no page of the service's own was found;
3. where neither is found, no link. The service stays in the profile, and the nation's search log (`research/search-logs/courts/` or `research/search-logs/dispute-resolution/`) records every place looked.

`scripts/lint_records.py` reports a service with no link (check `service-link`): an error for a service a pull request adds or changes, a warning for one already on `main`.

### Dispute resolution

The `dispute_resolution` section records how a nation resolves disputes outside, alongside or within its courts: its forums (with the nation's own name for each, its legal basis, the kinds of cases it hears, how cases arrive, how it relates to the Tribal court and how agreements are enforced), specific code provisions, dispute resolution clauses and waivers of sovereign immunity in commercial and other codes, training programs, and published rules and forms. Gaming compact dispute terms are kept with each compact under `gaming`.

Entries copied in bulk from a database of tribal laws, without opening the law itself, go in `database_listings`, not `provisions`. They keep the database's own tags (`practice_area`, `phase`, `form_of_practice`) as it writes them and carry `verification: bulk-import`. A listing becomes a provision only after the law is read ([decision record 0015](decisions/0015-database-listings-apart-from-provisions.md)).

The vocabularies for kinds of forum, case types, participation, provisions and clauses are open: any lowercase hyphenated term validates, so a method the project has not anticipated can be recorded in its own terms. The schema lists suggested terms; a term that becomes common gets a glossary record rather than a schema change (project design). Traditional or ceremonial practice is recorded only as far as the nation itself has made it public ([charter, commitment 5](charter.md#5-cultural-knowledge-and-restricted-material)).

### Courts and the path of appeal

`justice_institutions` lists the nation's courts and justice bodies, each with its kind, name, link and source. A court that several nations share, such as the Southwest Intertribal Court of Appeals, is listed in the profile of each nation it serves, with the kind `intertribal-court` or `intertribal-court-of-appeals`.

One court of a group that sources also list as a whole, such as one of the Navajo Nation's judicial district courts, names the group's entry in `part_of`, written exactly as that entry's `name` is written in the same profile; the page lists the court under its group and the court shares the group's place on the path of appeal, unless the court has an `appeals_to` of its own. `location` records where a court sits (`place`, `state` and, when the source gives one, `address`), only as its own source gives it, never from the nation's address or the court's name (individual courts review, Nov. 22, 2026).

A court's `appeals_to` names the court that hears appeals from it, written exactly as that court's `name` is written in the same profile, and carries its own citation: the constitution, court code or court website that says where appeals go. The highest court has no `appeals_to`. The field is filled only from a source that says so and is never worked out from a court's name or kind; when a search finds nothing, the search goes in the nation's search log under the topic `courts` ([decision record 0025](decisions/0025-search-logs.md)). The nation's page uses these facts to show how appeals move, from the court that hears a case first to the highest court, and groups the nation's courts and services under one heading for each kind of service (Courts, Peacemaking, Mediation and so on), so the kind is not repeated after each name.

### Jurisdiction and federal ties

`jurisdiction` holds facts on who has authority over what, each with a `topic`, a short `value` and a plain-English `detail` that ends in, or rests on, its citation. The page groups them by topic in this order:

| Topic | Values |
| --- | --- |
| `public-law-280` | `mandatory-state` (18 U.S.C. § 1162(a), 28 U.S.C. § 1360(a)), `excepted` (a reservation the statute leaves out), `optional-state` (a state that chose to take some jurisdiction), `optional-state-consent-not-given`, `assumption-held-invalid`, `retroceded` (returned to the United States and the nation), `concurrent-federal-jurisdiction-accepted` (18 U.S.C. § 1162(d)), `not-a-public-law-280-state` (a state on neither of the Bureau of Indian Affairs' lists) |
| `state-jurisdiction-statute` | A federal law other than Public Law 280 that gives a state jurisdiction, such as the Kansas Act or a land claims settlement act: `state-criminal-jurisdiction`, `state-civil-jurisdiction`, `state-criminal-and-civil-jurisdiction`, `repealed` |
| `violence-against-women-act-special-tribal-criminal-jurisdiction` | `exercising`; `implementation-grant` for a Tribal Jurisdiction Program grant, which can fund planning and so never counts as exercising |
| `tribal-law-and-order-act-enhanced-sentencing` | `implementing` |
| `indian-child-welfare-act` | `designated-agent-listed`, `reassumed-jurisdiction` |

Public Law 280 facts apply to the nation's Indian country in the state the detail names. When the profile places the nation in a state only by its office address, the fact is medium confidence. A negative (`not-a-public-law-280-state`) is inferred from an official list and says so in its note.

`jurisdiction_agreements` lists agreements between the nation and a state, county, city or federal agency that share or allocate jurisdiction, one fact per agreement per source. `kind` is `cross-deputization` (cross-deputization and other law enforcement agreements), `tax-agreement` (tax agreements and compacts other than gaming compacts), `child-welfare-agreement` (Indian Child Welfare Act and Title IV-E agreements, including a nation's own federal Title IV-E plan) or `other`. `other_party` names the agency as the source does; `agreement`, `state`, `date` and `status` (`in-effect`, `expired`, `unknown`) are filled when the source gives them. A source that only authorizes agreements without saying which nations signed is a lead in the search log, not a fact. The page shows these after the jurisdiction topics, grouped by kind, and marks only expired agreements, because most sources do not say whether an agreement is still in force.

`treaties` lists ratified United States treaties signed by the nation or the tribes and bands it descends from, each with its title as Kappler gives it, the date signed, the Statutes at Large citation and a link to the text in Kappler's *Indian Affairs: Laws and Treaties*. `signatory` copies how the treaty names the party; a link from a historic signatory to a modern nation is a matched fact with its own confidence. `land_establishment` records how a reservation or other land base was set aside (treaty, executive order, act of Congress, agreement, proclamation, purchase) and the instrument. `indian_health_service` records the Indian Health Service Area and, where the Service names it, the service unit and whether the nation or a Tribal organization runs it. The page shows these three under "Treaties and federal ties"; the Bureau of Indian Affairs region stays in At a glance.

### Names and languages

Names in a nation's own language are kept exactly as the nation writes them, in Unicode Normalization Form C, with a BCP 47 language tag (for example `chr`, `nv`, `haw`) and a romanized form only when the source gives one.

`names.pronunciation` records how to say a name, and only as an authoritative source publishes it. The nation's own sources come first: its website, its language program, or a recording it published. Each entry names the name it pronounces and copies at least one of a sound-it-out `respelling`, a `phonetic_transcription` or a link to a `recording`, exactly as the source gives it. A pronunciation is never worked out from the spelling, and the field is left out when no such source is found. A nation can ask for an entry to be corrected or removed like any other fact ([charter, commitment 6](charter.md#6-the-right-to-correct-restrict-or-withdraw)).

### Seals, emblems, flags and logos

`official_images` records the nation's seal, emblem, flag or logo as its own website publishes it: the link, the retrieval date, a SHA-256 fingerprint and the path of a private copy that is never committed. Its `reuse` object lists every signal about reusing the image (terms of use, trademark notices and symbols, the nation's laws, the USPTO tribal insignia database, the nation's own requests) and a status that follows from them; only some statuses allow the image to be shown. `tribal_insignia_database_entries` lists the nation's entries in that database. How signals are detected and the display rule are in [official-images.md](official-images.md).

### Building profiles

The first profiles were generated from cited facts in `research/raw/` (see its README) by `scripts/tribes/build_profiles.py`. After that, profiles are edited by hand like any other record.

## Document histories

A source record describes one text at one moment. Where a document has several versions, a document history in `content/documents/` ties them together ([decision record 0018](decisions/0018-document-version-history.md)). Use one for any document whose versions matter: gaming compacts and their amendments, extensions and replacements; Secretarial Procedures; gaming ordinances; constitutions and their amendments; codes, code titles and court rules and their revisions or editions; and any other source that changes.

| Field | Meaning |
| --- | --- |
| `kind` | Open list: constitution, law-code, code-title, ordinance, gaming-compact, gaming-ordinance, secretarial-procedures, court-rules, statute, regulation and others |
| `nations`, `states` | The parties |
| `versions` | Every known version, oldest first |
| `related` | Other histories this one depends on, such as the gaming ordinance a compact requires, or Secretarial Procedures that replaced a compact |

Each version is a cited fact (its `source` is the source record of that version's text, with the Indigo Book citation and archived copies) plus:

| Field | Meaning |
| --- | --- |
| `id`, `label` | A stable id such as `2003-replacement`, and the name readers know |
| `event` | `original`, `amendment` (changes some provisions; the earlier text stays in effect as amended), `revision` (a new full text by the same process), `restatement` (an "amended and restated" text), `replacement` (a new instrument in place of the old), `extension`, `renewal`, `edition` (a recodification or reissue), `repeal`, `expiration`, `disapproval`, `withdrawal`, `other` |
| `status` | `in-effect`, `superseded`, `expired`, `repealed`, `terminated`, `disapproved`, `withdrawn`, `proposed` or `unknown` |
| `dates` | Only the dates a source states: `signed`, `adopted`, `submitted`, `approved`, `published`, `effective`, `ended`, and `listed` for a date a list gives without saying what it marks |
| `approval` | The approving authority, its action (`approved`, `deemed-approved`, `disapproved`, `not-required`, `pending`) and the source of the approval or its notice |
| `amends`, `supersedes` | Ids of earlier versions in the same record |
| `capture` | The project's private copy: path in the working files, SHA-256 and pages; never committed |
| `clauses` | Key clauses by topic (open list led by `dispute-resolution`), with locator, a neutral summary and a verification level |
| `changes` | For each tracked topic, how it differs from an earlier version: `added`, `removed`, `changed`, `reworded` (different words, same process), `renumbered`, `unchanged` or `not-compared` |

The source record of a version names it in `document_version`, and any cited fact may name the version it describes in the same field. A fact that cites a version no longer in effect without naming it is reported by the record lint (`superseded-citation`), so a summary taken from an old edition cannot pass for the current text. A source's own `history` field is different: it tracks changes to the web page or file at the source's address, not versions of the law.

## Search logs

A profile field left empty does not say whether anyone looked. Each search for a kind of information about a nation (its dispute resolution practice, courts, contacts, codes) is logged in one record per nation and topic, `research/search-logs/<topic>/<letter>/<profile id>.yaml` ([decision record 0025](decisions/0025-search-logs.md); [research/search-logs/](../research/search-logs/README.md)).

| Field | Holds |
| --- | --- |
| `profile` | Repository path of the tribe profile, for example `content/tribes/a/example-nation.yaml` |
| `topic` | Open slug; equals the folder name. First in use: `dispute-resolution` |
| `status` | `found` (a search found something), `none-found` (every planned place searched, nothing found), `partly-searched` (places remain; see `next_steps`) or `not-searched` |
| `last_searched` | Date of the latest search; required unless `not-searched` |
| `searches` | One entry per place and query: `date`, `searched_by` (a person's chosen name or "Claude (AI assistant)"), `method` (`script`, `browser`, `ai-review`, `by-hand`), `place_kind` (open slug), `address`, optional `query`, `outcome`, one-sentence `reason`, optional `records` it led to |
| `next_steps` | Where to look next and what that needs |

Outcomes are `found`, `not-found`, `no-site`, `blocked` (the site refused the project's honestly named link checker or showed a bot challenge; the project does not try to get past it), `dead-link`, `paywalled`, `scanned-unreadable`, `not-public` and `error`. Searches that succeed are logged too. A log is a research record, not a fact about the nation: "none found" means only that the places listed showed nothing on that date. What a search finds goes to a review before it reaches a profile.

## Source fields for bibliographies

Besides citation data, a source record can carry the fields an annotated bibliography needs: `jurisdictions` (federal, state, territory, tribal, intertribal, multiple, international), `methods`, free `topics` tags, an `annotation`, and `access`, which says whether the full text is free online or must be pulled from Westlaw, Lexis, HeinOnline, a library or the publisher.

## Dispute resolution methods: an open list

The project does not fix the list of dispute resolution methods ([decision record 0012](decisions/0012-open-list-of-dispute-resolution-methods.md)). Each method is a record in `content/methods/`, so a process nobody has recorded is added as a new file with `status: proposed`, without changing any schema. Each record says:

- **what it is called**, in English and in the language of the people who practice it;
- **how the project classifies it**: as ADR, as its own tradition (such as peacemaking or a customary process, which the project does not call ADR), as a court process, as a governmental process, or as unsettled;
- **where it comes from** (`tradition`), which may be more than one;
- **how it works**, as facets that any process can be described by: who decides, whether the outcome binds, what a neutral or leader does, whether taking part is voluntary or required, and where it happens. Every facet allows `varies` and `other`, with a note; and
- **how it relates** to other methods: a kind of (`broader`), a hybrid of (`combines`), or `related`.

The provision `track` list stays closed because it organizes the book; the processes a provision governs are named through `methods`.

## Permission statuses

The build refuses to publish a quotation beyond a short passage unless the source's rights status allows it.

| Status | Meaning |
| --- | --- |
| `not-assessed` | Default for a new source |
| `no-permission-needed` | Facts only, fair use, public domain, a U.S. government work, or an open license; the `basis` field says which |
| `permission-requested` | Request sent; the `log` records when and to which office |
| `granted` | Permission given; `scope` and `conditions` record its limits |
| `denied` | Link only; never reproduce |
| `tribal-review-required` | Community material that needs the nation's approval regardless of copyright |

The legal bases come from U.S. copyright law: no copyright in works of the U.S. government ([17 U.S.C. § 105](https://www.law.cornell.edu/uscode/text/17/105)), fair use ([17 U.S.C. § 107](https://www.law.cornell.edu/uscode/text/17/107)), and the government edicts doctrine applied to official state legal texts in [Georgia v. Public.Resource.Org, Inc., 590 U.S. 255 (2020)](https://www.supremecourt.gov/opinions/19pdf/18-1150_7m58.pdf). Whether the edicts doctrine reaches tribal law is unsettled, and respect for tribal sovereignty points toward asking, so the default for tribal legal texts is `link-only` until a nation says otherwise (project analysis, not legal advice). That default governs quotation. Serving the project's saved copy of a whole document is decided by the capture index instead (decision record [0031](decisions/0031-serve-copies-of-documents-from-the-private-bucket.md)).

## Review statuses

Records about a nation carry a consultation status, from `drafted-from-public-sources` through `sent-to-nation`, `reviewed-by-nation` and `approved-by-nation`, or `withdrawn-at-request` when a nation asks for a record to be removed. A withdrawal request always wins (see the [charter](charter.md)).

## Sensitivity flags

`sensitivity.restricted: true` means a record is never published, exported, cached for offline use or served through any API. `tribal_review_required` holds a record back until the nation approves. `local_contexts_notices` are Notices this project applies; `local_contexts_labels` are Labels a community applies through the [Local Contexts Hub](https://localcontexts.org/labels/about-the-labels/), which only communities can do ([DataCite guidance](https://support.datacite.org/docs/local-contexts-notices-and-labels)).

## Built for templates

Provisions and forms write nation-specific words as placeholders, such as `{{nation.name}}`, defined in `content/variables/`. The book prints each placeholder's model text (for example "[Name of Nation]"); a future template builder can substitute a nation's own values. Alternatives carry letter ids so a builder can let a nation choose among them.

## Map data

The tribal map is drawn from each profile's `states` list: it shows which states a nation has a presence in and does not draw boundaries ([decision record 0007](decisions/0007-map-shows-state-presence.md)).

## Validation

A check in continuous integration (to be added) will validate every record against its schema, confirm every `[@key]` in the text resolves to a source, confirm every `[[id]]` resolves to a glossary entry, flag unlinked first uses of glossary terms and any use of an "avoid" term outside a quotation, and confirm every `found_in` names an existing research session.
