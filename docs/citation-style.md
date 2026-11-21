# Citation style

**Decision:** follow the *Indigo Book*'s rules for legal citation, render
citations automatically from structured source records, and keep the style in
one replaceable file so it can change without editing any text.

## Why the Indigo Book

The *Indigo Book* is "a free, Creative Commons-dedicated implementation of the
uniform system of citation commonly used in United States legal documents," and
is published under "a CC-0 public domain dedication."[^indigo] Legal readers get
the citation forms they expect, and because the rules are in the public domain
the project can quote and adapt them in its own guide without permission
(project analysis). The Bluebook itself is a proprietary publication.

The *Indigo Book* page consulted identifies itself as the second edition with
2023 updates (Aug. 21, 2023), though the same page also refers to it as "2d ed.
2021"; the project cites it as the second edition and will recheck for newer
updates before the 1st Edition.[^indigo]

## How citations work

1. **One record per source.** Each source has a file in `content/sources/`
   whose `citation` field holds its citation data in
   [Citation Style Language (CSL) JSON](https://citationstyles.org/). See
   [data-model.md](data-model.md).
2. **Text cites keys, not formatted citations.** Authors write
   `[@narf-ipi-tribal-peacemaking-laws]`, or with a pinpoint,
   `[@navajo-peacemaking-plan, sec. 3]`. This is the citation syntax used by
   Pandoc's Markdown (project choice; Pandoc's documentation was not reviewed
   for this decision).
3. **The build formats them.** A CSL processor turns each key into a footnote in
   the PDF and a hover card plus footnote on the website, handling short forms
   and *id.* automatically. The processor is
   [citeproc-js](https://github.com/Juris-M/citeproc-js), which "when run in
   CSL-M mode … can handle multilingual and legal content."[^citeproc]
4. **Changing style is one file.** Switching to another style means replacing
   the style file and rebuilding; no text changes.

## Style file

| Option | Status | License | Notes |
| --- | --- | --- | --- |
| Juris-M CSL-M "IndigoBook (for law reviews)" | Listed by Juris-M[^cslm] | Check the file's own license before use | First choice: matches the chosen rules and supports legal material in CSL-M mode |
| `bluebook-law-review.csl` from the official CSL styles repository | Exists ("The Bluebook legal citation style for law reviews"), updated 2025-08-22[^bluebook-csl] | CC BY-SA 3.0[^bluebook-csl] | Fallback; Bluebook-compatible output |

Whichever file is chosen lives at `pdf/styles/` (shared with the website build)
with its own license notice. A modified copy of a CC BY-SA style must stay under
CC BY-SA, separate from the project's MIT-licensed code (project analysis).

## Rules the project adds

- **Every web source is archived.** A citation to a web page includes, or links
  to, an archived copy and the date it was accessed (see the `archives` field).
- **Tribal law is cited as the nation cites it.** Where a nation's code or court
  publishes its own citation form, use it, and note the source of that form.
  Checking what the *Indigo Book* says about tribal sources is an open task
  before drafting begins.
- **Analysis is labeled.** Commentary distinguishes what a source says from the
  project's analysis, for example with "(project analysis)" or by framing such
  as "in the project's view."
- **Negative treatment is dated.** A citation to a case or statute relies on the
  citator check recorded in its source record.

## Open tasks

- Obtain and test the CSL-M IndigoBook style with citeproc-js on sample sources.
- Fix statute citations: in the ebook test build, `bluebook-law-review.csl`
  dropped a "§ 4" pinpoint from a statute and printed nothing for its short
  form (citeproc-js reported "reference with no printed form") (measured,
  2026-11-21).
- Confirm how the *Indigo Book* treats tribal codes, tribal court decisions and
  web-published tribal materials.
- Decide the website's footnote display (hover card, side note or end of page).

## References

[^indigo]: Christopher Jon Sprigman, Jennifer Romig et al. (eds.), *The Indigo Book: A Manual of Legal Citation* (2d ed., 2023 updates), Public.Resource.Org, [law.resource.org/pub/us/code/blue/indigobook-2.1.html](https://law.resource.org/pub/us/code/blue/indigobook-2.1.html) (accessed Nov. 20, 2026).
[^citeproc]: Juris-M, *citeproc-js* (README), [github.com/Juris-M/citeproc-js](https://github.com/Juris-M/citeproc-js) (accessed Nov. 20, 2026).
[^cslm]: Juris-M, *CSL-M styles*, [juris-m.github.io/styles](https://juris-m.github.io/styles) (accessed Nov. 20, 2026).
[^bluebook-csl]: Citation Style Language styles repository, `bluebook-law-review.csl`, [github.com/citation-style-language/styles](https://github.com/citation-style-language/styles/blob/master/bluebook-law-review.csl); metadata at [zotero.org/styles/bluebook-law-review](https://www.zotero.org/styles/bluebook-law-review?source=1) (accessed Nov. 20, 2026).
