# Terminology

**Decision:** every term, phrase and acronym the project defines has its own
record in [`content/glossary/`](../content/glossary/), and any text that uses
it links to that record. The website, the print edition and the ebook all
resolve the same links, so a definition is written once and can be found from
every place it is used (project choice).

The [style guide](style-guide.md) says how to write; this document says which
words to use and how to link them.

## Why a project dictionary

The words used for Native nations and their people carry legal and political
meaning. "The words tribe and nation are used interchangeably but hold very
different meanings for many Native people,"[^nmai] and "using appropriate
terminology to talk about Native nations shows respect for nations'
sovereignty."[^ngc-guide] Federal statutes add their own defined terms, which
differ from one statute to the next (see the `indian-tribe` entry). A shared
dictionary keeps the book consistent across many authors and editions
(project analysis).

## How terms are chosen

Sources are weighed in this order (project choice):

1. **A nation's own usage.** "The best term is always what an individual
   person or community uses to describe themselves."[^nmai] Reporting guides
   ask, for example, whether "some Navajos prefer to be called Diné."[^naja]
   A nation's own name, as it writes it, always wins over any general term.
2. **Native-led guidance**, such as the Native Governance Center's
   *Terminology Style Guide* and *How to Talk about Native Nations*, and the
   Native American Journalists Association's *Tribal Nations Media
   Guide*.[^ngc-style][^ngc-guide][^naja]
3. **Institutional guidance**, such as the Smithsonian National Museum of the
   American Indian's handout on terminology.[^nmai]
4. **Statutes and regulations**, for legal terms only. A legal term is used
   with the meaning of the statute cited, and the statute is named.
5. **Project choice**, where sources disagree or are silent. Each such choice
   is labeled in the entry's `basis` field and in its text.

When sources disagree, the entry quotes both and says which the project
follows. For example, one Native Governance Center guide does not recommend
"Tribe" for Native nations, while its style guide allows "Tribal nations" or
"Tribes" in some cases; the `tribe` entry records both.[^ngc-guide][^ngc-style]

## Main choices

| Use | Instead of | Basis |
| --- | --- | --- |
| Native nations; the nation's own name | "the tribes", "Indian tribes" (except legal terms and names) | Native Governance Center[^ngc-guide]; project choice |
| Native American, Native, Indigenous (for several nations) | American Indian, Indian (except legal terms, names, quotations) | Native Governance Center[^ngc-guide] |
| Tribal and Tribe, capitalized, in the project's own voice | tribal, tribe (quotations keep their original form) | Native Governance Center style guide[^ngc-style] |
| citizen (or the nation's own word) | member, enrolled member, unless the nation's law uses it | NAJA[^naja]; project choice |
| sovereignty, self-determination, self-governance, lowercase | capitalized forms | Native Governance Center style guide[^ngc-style] |
| Native nations in Minnesota | Minnesota's Native nations | Native Governance Center[^ngc-guide] |
| Indian country (legal term, with its statute) | Indian Country, unless the broader sense is meant | 18 U.S.C. § 1151; Native Governance Center style guide[^ngc-style] |

The full list, with definitions and sources, is the set of entries in
[`content/glossary/`](../content/glossary/).

## Linking terms in text

Four kinds of bracket syntax appear in content files. Each
resolves to a different kind of record (project design):

| Syntax | Resolves to | Example |
| --- | --- | --- |
| `[@key]` | A source record, rendered as a citation | `[@usc-18-1151, (a)]` |
| `[[id]]` | A glossary entry, shown as its headword | `[[native-nations]]` |
| `[[id\|text]]` | A glossary entry, shown as the given text | `[[native-nations\|Native nation]]` |
| `{{group.name}}` | A template variable, printed as its model text | `{{nation.name}}` |

How the builds render a glossary link (project design, to be built):

- **Website:** the term is a link to its page at `/glossary/<id>`, with a hover
  or tap card showing the definition. Each glossary page lists every place
  that links to it ("Used in"), generated at build time.
- **Acronyms:** the first link in each chapter or web page prints the
  expansion followed by the acronym, for example "alternative dispute
  resolution (ADR)"; later links print the acronym with the expansion
  available on hover. Authors write `[[adr]]` every time and the build decides.
- **Print:** the term prints as plain text, acronyms are expanded on first use
  in each chapter, and every adopted entry appears in a glossary in the back
  matter.
- **Ebook:** as print, with each linked term also linking to its glossary
  entry.

### When to link

- Link the **first use** of a defined term in each provision, commentary,
  essay or web page. Later uses in the same piece may be plain text.
- Always link a **legal term** (`kind: legal-term`) where its statutory
  meaning matters.
- Never put a link inside a quotation; quote as written and link the term in
  your own sentence if needed.

The planned text check (see [data-model.md](data-model.md#validation)) will
flag a link to a missing entry, an unlinked first use of a term or alias, and
an "avoid" term used outside a quotation.

## Adding or changing a term

1. Search [`content/glossary/`](../content/glossary/) for the term and its
   aliases first.
2. Copy an existing entry, name the file after its `id`, and fill in the
   fields described in [glossary.schema.json](../schemas/glossary.schema.json).
   Every definition cites a source with `[@key]` or is labeled
   `basis: project-analysis`.
3. Add any new sources to `content/sources/` and log the research in a
   session file, as for any other content
   ([CONTRIBUTING.md](../CONTRIBUTING.md)).
4. Open a pull request titled, for example,
   `feat(content): add glossary entry for restorative justice`.
5. Never reuse or delete an `id` once published. To retire an entry, set
   `status: retired` and `redirect_to` so old links keep working.

Anyone without a GitHub account can propose a term through the website once
it is live, or through the "Term or definition" issue form until then.

## Native nations' own terms

A nation may ask that its name, or a term from its language or law, be written
in a particular way, or not be used. That request is handled like any other
request under [charter commitment 6](charter.md#6-the-right-to-correct-restrict-or-withdraw)
and [requests.md](requests.md), and wins over this guide.

## References

[^ngc-guide]: Native Governance Center, *How to Talk about Native Nations: A Guide* 1, 3–5 (2021), [nativegov.org](https://nativegov.org/wp-content/uploads/2021/10/How-to-Talk-about-Native-Nations-A-Guide.pdf) (accessed Nov. 20, 2026). Pages counted from the cover. Source record: `ngc-how-to-talk-about-native-nations`.
[^ngc-style]: Native Governance Center, *Terminology Style Guide*, [nativegov.org](https://nativegov.org/resources/terminology-style-guide/) (accessed Nov. 20, 2026). Source record: `ngc-terminology-style-guide`.
[^nmai]: Smithsonian National Museum of the American Indian, *The Impact of Words and Tips for Using Appropriate Terminology: Am I Using the Right Word?* (Native Knowledge 360°), [americanindian.si.edu](https://americanindian.si.edu/nk360/resources/Impact-of-Words-and-Tips-for-Using-Appropriate-Terminology-Am-I-Using-the-Right-Word), text read from the [Arizona State Museum copy](https://statemuseum.arizona.edu/sites/default/files/Impact-of-Words-Tips-for-Using-Appropriate-Terminology.pdf) (accessed Nov. 20, 2026). Source record: `nmai-impact-of-words`.
[^naja]: Native American Journalists Association, *Tribal Nations Media Guide* (Oct. 2020), [indigenousjournalists.org](https://indigenousjournalists.org/wp-content/uploads/2020/10/2020-NAJA-Tribal-Nations-Media-Guide-1.pdf) (accessed Nov. 20, 2026). Source record: `naja-tribal-nations-media-guide`.
