# Citation style

The build formats every `[@key]` citation with citeproc-js and the style in
this folder (see [docs/citation-style.md](../../docs/citation-style.md)). The
website and the ebook will use the same files.

| File | What it is | Source | License |
| --- | --- | --- | --- |
| `project-law-review.csl` | The project's citation style: the CSL "Bluebook Law Review" style with the changes below | [citation-style-language/styles](https://github.com/citation-style-language/styles/blob/master/bluebook-law-review.csl), file dated 2025-05-06, SHA-256 of the unmodified file `9f842bac2287e12066140d26d940a69cd2cbd2367d27bff350fedab8f2419336`, downloaded 2026-11-21 | CC BY-SA 3.0 ([LICENSES/CC-BY-SA-3.0.txt](../../LICENSES/CC-BY-SA-3.0.txt)) |
| `locales-en-US.xml` | US English terms (such as "id." and "§") | [citation-style-language/locales](https://github.com/citation-style-language/locales/blob/master/locales-en-US.xml), file dated 2026-01-10, SHA-256 `ac864c7c21166b4390d82c31792cdc509400727fa0060b43d8aa17e07f9cb079`, unmodified | CC BY-SA 3.0 |

Both files keep their CC BY-SA 3.0 license, which requires a modified copy to
stay under the same license; they are not covered by the MIT license of the
rest of `pdf/` (project analysis; see [LICENSE.md](../../LICENSE.md)). The
style's original authors and contributors are credited in its `<info>` block.

## Changes from the original

Every change to the style file is marked with a "Model Tribal ADR Code" comment in the file.
Rule numbers are from *The Indigo Book* (2d ed. 2023 updates), the citation
manual the project follows.

1. **Statute pinpoints.** The original printed a statute's full citation
   without its pinpoint, so `[@uniform-mediation-act, § 4]` lost "§ 4". A
   statute is now printed one of two ways:
   - a section of a code, when the record has `section`:
     `25 U.S.C. § 5130(2)` (R16.1). The pinpoint is a subdivision of the
     section and is joined to it;
   - an act cited by name, when it has no `section`:
     `Unif. Mediation Act § 4 (Unif. L. Comm'n 2001)` (R18.4).
2. **Statute short forms.** The original's short form printed only the code
   and section, so an act with no section printed nothing ("reference with no
   printed form" in citeproc-js). Short forms are now `25 U.S.C. § 5130(3)`
   and `Unif. Mediation Act § 5`, without *supra* (R6.2.3, R16.2, R17.5).
3. **Parenthetical.** Statutes end with the issuing body or publisher and the
   year when the record has them, or the status and year for a repealed
   section: `(Unif. L. Comm'n 2001)`, `(West 2021)`, `(repealed 2015)`
   (R16.1.5, R17.3, R17.4, R18.4). A current U.S. Code section has no year
   (R16.1.2).
4. **"Id." with a section.** The original wrote "*Id.* at § 9"; it is now
   "*Id.* § 9", and "*Id.* § 5130(3)" for a code section (R6.2.2, R22.2).
   Page pinpoints still read "*Id.* at 52".
5. **Section and paragraph pinpoints elsewhere.** Books, articles and cases
   print "§ 4" or "¶ 3" for non-page pinpoints instead of a bare number.
6. **Several sections.** The build adds the section symbol before the style
   sees the record: "§ 5130", or "§§ 654–658" and "§§ 471, 473" for several
   sections (R16.1), because CSL cannot tell that "38.206–38.248" is plural. A
   record may give its section with or without the symbol; after "§§" a hyphen
   becomes an en dash, but a hyphen inside one section number, such as Hawaii's
   "10H-1", is kept (`normalizeSection` in `../pipeline/citations.mjs`).
7. **Comma after *supra*.** "Austin, *supra* note 2, at 14" (R6.2.3), where the
   original had no comma.

The tests in [`../tests/citations.test.mjs`](../tests/citations.test.mjs)
check each change, and check that every source record in `content/` prints a
full and a short form.

## How to record a statute

```yaml
# A section of a code: 25 U.S.C. § 5130(2)
citation:
  type: legislation
  title: Federally Recognized Indian Tribe List Act of 1994   # not printed
  container-title: United States Code
  container-title-short: U.S.C.  # the code's abbreviation, which is printed
  volume: "25"                   # the title number, if the code has one
  section: "5130"                # or "654–658", or "471, 473"; no "§" needed
```

```yaml
# An act cited by name: Unif. Mediation Act § 4 (Unif. L. Comm'n 2001)
citation:
  type: legislation
  title: Uniform Mediation Act
  title-short: Unif. Mediation Act   # the abbreviated name used in citations
  authority: Unif. L. Comm'n
  issued:
    date-parts: [[2001]]
```

In the text, cite a code section's subdivision as `[@key, (2)]` and an act's
section as `[@key, § 4]`.
