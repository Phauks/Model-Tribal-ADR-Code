# Repository layout

All content is kept as plain files in git, and the website and the print
edition are two separate builds from the same files. This gives a line-by-line
history of every change, lets contributors propose changes by pull request,
and makes each edition reproducible
([decision record 0004](decisions/0004-content-as-plain-files.md)).

```text
.
├── content/                 Everything readers read (version + changelog)
│   ├── provisions/          Model provisions, one file per section      CC0
│   ├── commentary/          Comment, illustrations, source note         CC BY
│   ├── essays/              Part I essays, Part III methods and manners CC BY
│   ├── forms/               Fill-in forms with placeholders             CC0
│   ├── tribes/              One profile per nation or community         CC BY
│   ├── sources/             One record per cited source                 CC BY
│   ├── documents/           One version history per changing document   CC BY
│   ├── glossary/            One entry per defined term or acronym       CC BY
│   ├── methods/             One record per dispute resolution method    CC BY
│   ├── bibliographies/      Annotated reading lists                     CC BY
│   ├── variables/           Template placeholder definitions            CC0
│   ├── version.txt
│   └── CHANGELOG.md
├── site/                    Website code (version + changelog)          MIT
├── pdf/                     Print build for Lulu (version + changelog)  MIT
│   ├── book.yaml            Book size, paper, title page details        MIT
│   ├── book-sizes.yaml      Every eligible size and its layout rules    MIT
│   ├── pipeline/            Content to Typst, citations, page geometry  MIT
│   ├── typst/               The page template                           MIT
│   ├── styles/              Citation style and locale                   CC BY-SA
│   ├── fonts/               Embedded fonts                              OFL
│   ├── tools/               PDF checks against Lulu's rules             MIT
│   └── tests/               Tests and the typesetting specimen          MIT
├── schemas/                 JSON Schemas for every record type          MIT
├── scripts/                 Checks run on every pull request            MIT
│   └── examples/            One valid example per schema
├── research/
│   ├── sessions/YYYY/       One dated file per research session         CC BY
│   ├── raw/YYYY-MM-DD/      Cited facts before they become records      CC BY
│   ├── analyses/            Dated analyses of the records               CC BY
│   ├── outreach/            One record per organization to ask for help CC BY
│   └── reviews/             Dated reviews of records against sources    CC BY
├── docs/
│   ├── charter.md           Project charter
│   ├── data-model.md        Record types and fields
│   ├── citation-style.md    How sources are recorded and cited
│   ├── terminology.md       How terms are chosen, defined and linked
│   ├── style-guide.md       Tone and writing standards
│   ├── requests.md          Correction, restriction, removal and contribution flow
│   ├── roadmap.md           Order of work and review gates toward drafting
│   ├── repository-layout.md This file
│   └── decisions/           Numbered decision records
├── LICENSES/                Full license texts
├── LICENSE.md               Which license covers which folder
├── CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md
├── release-please-config.json, .release-please-manifest.json
└── .github/                 CODEOWNERS, templates, workflows
```

## Three version tracks

`content/`, `site/` and `pdf/` each have their own `version.txt` and
`CHANGELOG.md`, starting at 0.0.1
([decision record 0003](decisions/0003-three-version-tracks.md)). A change to
a file inside one of those folders counts toward that track's next release.
Changes elsewhere (docs, schemas, research logs) do not bump any track.

## Identifiers

File names are the stable identifiers that citations, the website and the API
(if one is built) use. Once published, an identifier never changes; a renamed
or removed record leaves a redirect entry instead.

| Record | File name pattern | Example |
| --- | --- | --- |
| Provision | `content/provisions/<chapter>-<section>.md` | `content/provisions/02-104.md` (§ 2-104) |
| Commentary | `content/commentary/<chapter>-<section>.md` | `content/commentary/02-104.md` |
| Essay | `content/essays/<part>-<slug>.md` | `content/essays/i-history-of-adr.md` |
| Form | `content/forms/<slug>.md` | `content/forms/agreement-to-participate.md` |
| Tribe | `content/tribes/<letter>/<slug>.yaml` | `content/tribes/n/navajo-nation.yaml` |
| Glossary entry | `content/glossary/<id>.yaml` | `content/glossary/native-nations.yaml` |
| Source | `content/sources/<letter>/<key>.yaml` | `content/sources/n/narf-ipi-tribal-peacemaking-laws.yaml` |
| Method | `content/methods/<id>.yaml` | `content/methods/mediation.yaml` |
| Bibliography | `content/bibliographies/<slug>.md` | `content/bibliographies/united-states-dispute-resolution.md` |
| Research session | `research/sessions/<yyyy>/<yyyy-mm-dd>-<topic>.md` | `research/sessions/2026/2026-11-20-foundational-scan.md` |
| Outreach organization | `research/outreach/<id>.yaml` | `research/outreach/native-american-rights-fund.yaml` |

Tribe profiles and source records sit in a subfolder named for the first
letter of their id or key (`content/tribes/n/`, `content/sources/u/`). An id or
key that starts with anything else (ids allow only a to z and 0 to 9, so in
practice a digit) goes in `_other/`, whose leading underscore sorts it above the letter folders. These
folders will hold thousands of records, and a folder that large is hard to
browse on GitHub and in editors. The first letter is the only grouping that
never moves a file: status, state and region can all change, but an id cannot.
Links and citations use the id or key, never the path (project choice).

Section numbers leave room for later editions: a new section between § 2-104
and § 2-105 becomes § 2-104A rather than renumbering what follows.
