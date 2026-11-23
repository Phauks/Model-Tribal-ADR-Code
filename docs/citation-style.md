# Citation style

**Decision:** follow the *Indigo Book*'s rules for legal citation, render citations automatically from structured source records, and keep the style in one replaceable file so it can change without editing any text.

## Why the Indigo Book

The *Indigo Book* is "a free, Creative Commons-dedicated implementation of the uniform system of citation commonly used in United States legal documents," and is published under "a CC-0 public domain dedication."[^indigo] Legal readers get the citation forms they expect, and because the rules are in the public domain the project can quote and adapt them in its own guide without permission (project analysis). The Bluebook itself is a proprietary publication.

The *Indigo Book* page consulted identifies itself as the second edition with 2023 updates (Aug. 21, 2023), though the same page also refers to it as "2d ed. 2021"; the project cites it as the second edition and will recheck for newer updates before the 1st Edition.[^indigo]

## How citations work

1. **One record per source.** Each source has a file in `content/sources/` whose `citation` field holds its citation data in [Citation Style Language (CSL) JSON](https://citationstyles.org/). See [data-model.md](data-model.md).
2. **Text cites keys, not formatted citations.** Authors write `[@narf-ipi-tribal-peacemaking-laws]`, or with a pinpoint, `[@navajo-peacemaking-plan, sec. 3]`. This is the citation syntax used by Pandoc's Markdown (project choice; Pandoc's documentation was not reviewed for this decision).
3. **The build formats them.** A CSL processor turns each key into a footnote in the PDF. On the website it becomes a numbered marker in square brackets whose citation opens beside it, and the full citation goes in the page's Sources list ([site/DESIGN.md, "Citations"](../site/DESIGN.md#6-components)). The processor handles short forms and *id.* automatically. The processor is [citeproc-js](https://github.com/Juris-M/citeproc-js), which "when run in CSL-M mode … can handle multilingual and legal content."[^citeproc]
4. **Changing style is one file.** Switching to another style means replacing the style file and rebuilding; no text changes.

## Style file

The print build uses `pdf/styles/project-law-review.csl`, a modified copy of `bluebook-law-review.csl` from the official CSL styles repository (CC BY-SA 3.0).[^bluebook-csl] The changes bring its statute, *id.* and *supra* forms in line with the *Indigo Book* (R6.2.2, R6.2.3, R16, R17, R18.4)[^indigo] and are listed, with the upstream file's date and checksum, in [pdf/styles/README.md](../pdf/styles/README.md). The website and the ebook will use the same file. The modified copy stays under CC BY-SA 3.0, separate from the project's MIT-licensed code (project analysis).

| Option | Status | License | Notes |
| --- | --- | --- | --- |
| `project-law-review.csl` (modified `bluebook-law-review.csl`) | In use since 2026-11-21 | CC BY-SA 3.0[^bluebook-csl] | Fixes statute pinpoints and short forms; tested in `pdf/tests/citations.test.mjs` |
| Juris-M CSL-M "IndigoBook (for law reviews)" | Listed by Juris-M,[^cslm] not yet tested | Check the file's own license before use | Still worth testing: it targets the chosen rules, but needs citeproc-js in CSL-M mode |

### Recording a statute

A section of a code needs the code's abbreviation and title number, so that it prints as `25 U.S.C. § 5130(2)`:

```yaml
citation:
  type: legislation
  container-title: United States Code
  container-title-short: U.S.C.
  volume: "25"
  section: "5130"
```

The abbreviation in `container-title-short` is what prints. `section` holds only the number, or numbers for several sections ("654–658", "471, 473"); the build adds "§" or "§§".

An act cited by name has no `section`, and prints as `Unif. Mediation Act § 4 (Unif. L. Comm'n 2001)`:

```yaml
citation:
  type: legislation
  title: Uniform Mediation Act
  title-short: Unif. Mediation Act
  authority: Unif. L. Comm'n
  issued:
    date-parts: [[2001]]
```

In the text, cite a code section's subdivision as `[@key, (2)]` and an act's section as `[@key, § 4]`.

## Rules the project adds

- **Every web source is archived.** A citation to a web page includes, or links to, an archived copy and the date it was accessed (see the `archives` field).
- **Tribal law is cited as the nation cites it.** Where a nation's code or court publishes its own citation form, use it, and note the source of that form. Checking what the *Indigo Book* says about tribal sources is an open task before drafting begins.
- **Analysis is labeled.** Commentary distinguishes what a source says from the project's analysis, for example with "(project analysis)" or by framing such as "in the project's view."
- **Negative treatment is dated.** A citation to a case or statute relies on the citator check recorded in its source record.

## Open tasks

- Obtain and test the CSL-M IndigoBook style with citeproc-js on sample sources.
- Done 2026-11-21: statute source records. U.S. Code, C.F.R., Nevada and Hawaii records carry the printed abbreviation in `container-title-short`; Guam, Northern Mariana Islands and American Samoa records use each code's own form ("7 GCA § 42101", "8 CMC § 2904", "A.S.C.A. § 43.0302"), following the rule above for citing a jurisdiction's law as it cites it (project choice). Current U.S. Code sections carry no year (Indigo Book R16.1.2).
- Done 2026-11-21: statute citations. `bluebook-law-review.csl` dropped a "§ 4" pinpoint from a statute and printed nothing for its short form (citeproc-js reported "reference with no printed form"); `project-law-review.csl` fixes both.
- Confirm how the *Indigo Book* treats tribal codes, tribal court decisions and web-published tribal materials.
- Done 2026-11-22: the website's footnote display. Markers in square brackets follow the claim, as Wikipedia shows them. The citation opens in a small window beside the marker on wide screens and in a drawer from the bottom on phones. The Sources list at the end links back to each marker (Trevor; [site/DESIGN.md, "Citations"](../site/DESIGN.md#6-components)).

## References

[^indigo]: Christopher Jon Sprigman, Jennifer Romig et al. (eds.), *The Indigo Book: A Manual of Legal Citation* (2d ed., 2023 updates), Public.Resource.Org, [law.resource.org/pub/us/code/blue/indigobook-2.1.html](https://law.resource.org/pub/us/code/blue/indigobook-2.1.html) (accessed Nov. 20, 2026).
[^citeproc]: Juris-M, *citeproc-js* (README), [github.com/Juris-M/citeproc-js](https://github.com/Juris-M/citeproc-js) (accessed Nov. 20, 2026).
[^cslm]: Juris-M, *CSL-M styles*, [juris-m.github.io/styles](https://juris-m.github.io/styles) (accessed Nov. 20, 2026).
[^bluebook-csl]: Citation Style Language styles repository, `bluebook-law-review.csl`, [github.com/citation-style-language/styles](https://github.com/citation-style-language/styles/blob/master/bluebook-law-review.csl); metadata at [zotero.org/styles/bluebook-law-review](https://www.zotero.org/styles/bluebook-law-review?source=1) (accessed Nov. 20, 2026).
