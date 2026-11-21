# Licenses

Different parts of this repository are licensed differently, because each part
has different users with different needs. The reasons for each choice are in
[decision record 0002](docs/decisions/0002-license-by-material.md).

| Material | Where it lives | License | Full text |
| --- | --- | --- | --- |
| Model provisions and forms (text a nation may enact or adapt) | `content/provisions/`, `content/forms/`, `content/variables/` | CC0 1.0 Universal public domain dedication. Any nation may enact, adapt or republish them without attribution | [LICENSES/CC0-1.0.txt](LICENSES/CC0-1.0.txt) |
| Commentary, illustrations and essays | `content/commentary/`, `content/essays/` | Creative Commons Attribution 4.0 International (CC BY 4.0) | [LICENSES/CC-BY-4.0.txt](LICENSES/CC-BY-4.0.txt) |
| Data: glossary, method records, tribe profiles, source records, bibliographies, comparative tables, research logs | `content/glossary/`, `content/methods/`, `content/tribes/`, `content/sources/`, `content/bibliographies/`, `research/` | CC BY 4.0 | [LICENSES/CC-BY-4.0.txt](LICENSES/CC-BY-4.0.txt) |
| Website, build and tooling code, schemas | `site/`, `pdf/`, `schemas/`, scripts | MIT License | [LICENSES/MIT.txt](LICENSES/MIT.txt) |
| Project documentation | `docs/`, root documents | CC BY 4.0 | [LICENSES/CC-BY-4.0.txt](LICENSES/CC-BY-4.0.txt) |
| Citation style and locale (third-party, modified) | `pdf/styles/*.csl`, `pdf/styles/*.xml` | CC BY-SA 3.0, the license of the originals ([pdf/styles/README.md](pdf/styles/README.md)) | [LICENSES/CC-BY-SA-3.0.txt](LICENSES/CC-BY-SA-3.0.txt) |
| Icons (third-party, unmodified) | Lucide, installed as `@lucide/svelte` for the website and `lucide-static` for the print edition | ISC License, and the MIT License for icons drawn from Feather | [LICENSES/Lucide.txt](LICENSES/Lucide.txt) |
| Fonts (third-party, unmodified) | `pdf/fonts/` | SIL Open Font License 1.1 ([pdf/fonts/README.md](pdf/fonts/README.md)) | [LICENSES/OFL-1.1.txt](LICENSES/OFL-1.1.txt) |

## Material these licenses do not cover

A license can only cover material its licensor owns. The licenses above do
**not** apply to:

- tribal codes, court rules, constitutions and other works of Native nations,
  which remain under each nation's authority and terms;
- quotations and excerpts from third-party works, which are used under fair use
  or with recorded permission (see each source record's `rights` field);
- artwork, including cover art, which is used under each artist's agreement; and
- any record marked with a Local Contexts Label or a "tribal review required"
  status, whose community protocols apply regardless of copyright.

Commitments to Indigenous data governance in the [charter](docs/charter.md)
apply to all material, whatever its license.

## License texts

The license texts in `LICENSES/` were copied from the
[SPDX License List data](https://github.com/spdx/license-list-data). The
canonical versions are published by
[Creative Commons](https://creativecommons.org/licenses/list.en) and the
[Open Source Initiative](https://opensource.org/license/mit).
