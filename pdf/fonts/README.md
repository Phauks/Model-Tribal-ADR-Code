# Fonts

The print build embeds only the fonts in this folder: Typst runs with
`--ignore-system-fonts --ignore-embedded-fonts`, so the book looks the same on
every computer. Lulu requires every font to be embedded (Lulu, *Book Creation
Guide*, p. 23).

Atkinson Hyperlegible Next is the project's typeface (decision record 0005).
It covers 362 characters, so Noto Sans supplies characters it lacks, such as
ʻ (ʻokina), ʷ, ʔ and ō, and two Noto fonts supply the Cherokee syllabary and
Canadian syllabics (measured with fontTools, 2026-11-21).

All fonts are under the SIL Open Font License 1.1 ([OFL-Atkinson-Hyperlegible-Next.txt](OFL-Atkinson-Hyperlegible-Next.txt),
[OFL-Noto.txt](OFL-Noto.txt), full text also in [`LICENSES/OFL-1.1.txt`](../../LICENSES/OFL-1.1.txt)).
The license allows the fonts to be bundled and embedded in documents.

| File | Version | Source | SHA-256 |
| --- | --- | --- | --- |
| AtkinsonHyperlegibleNext-Regular.ttf | 2.001 | [googlefonts/atkinson-hyperlegible-next](https://github.com/googlefonts/atkinson-hyperlegible-next), `fonts/ttf/` | `88ed5c31a71584c7772963b02d04bef1eb7e3d2e9c8b9cb204339b1f82cf432c` |
| AtkinsonHyperlegibleNext-Italic.ttf | 2.001 | same | `b7f8f03ceb28ebadb2de2332b2e869a00e8dbfb5c8e00fdbb06385770c8227e7` |
| AtkinsonHyperlegibleNext-SemiBold.ttf | 2.001 | same | `8e2fff779f35ac25239656bb0f3b2bd35959a2009e3dd21a12141c3b9030362b` |
| AtkinsonHyperlegibleNext-SemiBoldItalic.ttf | 2.001 | same | `81255b975707232b59b1f673e36b8c83e34b64b01d90025b89420e1c6506d7a9` |
| AtkinsonHyperlegibleNext-Bold.ttf | 2.001 | same | `994414047df66bb4998d01c1cb1eeb4a2ddc4622d1aa56bbb8adbeca7645b041` |
| AtkinsonHyperlegibleNext-BoldItalic.ttf | 2.001 | same | `c2d3c596b54d1565ca20d383cdfb127b50b18b500b85a774fd07d4d976cd018b` |
| NotoSans-Regular.ttf | 2.015 | [notofonts/notofonts.github.io](https://github.com/notofonts/notofonts.github.io), `fonts/NotoSans/unhinted/ttf/` | `f3961a9cde016d41a4879aecda1474d3a36d6bf54fa0e4643de029cc2248b0e8` |
| NotoSans-Italic.ttf | 2.015 | same | `678288f868807d4d64a6f3b51466871d117d915780381ce9d0ed4b3bcbd06d37` |
| NotoSans-Bold.ttf | 2.015 | same | `87cb2d84472a7d66da659ee47b6cdb9552326e8c128245231f191b6ac72529d9` |
| NotoSans-BoldItalic.ttf | 2.015 | same | `3d367743f371f28671d2764e911a53d7c20ec9b6aa8791d059e7090389fc52a5` |
| NotoSansCherokee-Regular.ttf | 2.001 | same repository, `fonts/NotoSansCherokee/unhinted/ttf/` | `4460410f1a089f79af329d5d26e09381ba553a05baa7c1f3c352fc43bb96878d` |
| NotoSansCherokee-Bold.ttf | 2.001 | same | `70c6314d40f7ad12760ccde0bb647bc47dc9842ff2477244ce8960870258f0ca` |
| NotoSansCanadianAboriginal-Regular.ttf | 2.004 | same repository, `fonts/NotoSansCanadianAboriginal/unhinted/ttf/` | `dc212a1c1cd2d9c30d954b3fbda0abfbd2e30273032a3d4352e1a8644f50e39a` |
| NotoSansCanadianAboriginal-Bold.ttf | 2.004 | same | `e786d24b678fcb2bb68236c66e4fff31b676a7e5863a7073eac58edfd7f00f50` |

Downloaded 2026-11-21 from the repositories' `main` branches. The Atkinson
Hyperlegible Next files are identical to those used in the PDF and ebook test
builds. "Canadian Aboriginal" is the font's own name, taken from the Unicode
block name; the book's text uses the nations' own names.
