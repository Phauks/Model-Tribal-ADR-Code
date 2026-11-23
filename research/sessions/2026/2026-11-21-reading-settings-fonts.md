---
id: 2026-11-21-reading-settings-fonts
date: 2026-11-21
researchers: [Trevor Goldsmith, Claude (AI assistant)]
tools:
  - kind: ai-assistant
    name: Claude (AI assistant)
    detail: Downloaded candidate font packages from npm, read their license files, and measured character coverage and file contents with fontTools.
  - kind: other
    name: npm registry
    detail: Versions and license fields read with npm view; packages downloaded with npm pack.
  - kind: page-fetch
    name: Web page fetch tool
    detail: Read the OpenDyslexic license file and website, and the SIL Open Font License FAQ. The GitHub API refused automated requests.
  - kind: web-search
    name: Web search
    detail: Found the study on OpenDyslexic and the WCAG text spacing criterion.
purpose: Choose the fonts a reader can pick in the website's Settings dialog, and check that each one's license allows the site to serve it.
sources_added: []
limits: >-
  Coverage was measured on the Fontsource web font files, not on the
  makers' original files. No readers were asked which fonts they prefer.
  These are design references cited in site/DESIGN.md, so no source records
  or archived copies were made.
---

# Fonts for the reading settings

- **Date:** Nov. 21, 2026
- **Question:** Besides Atkinson Hyperlegible Next, which fonts should a reader be able to pick in Settings, and may the site serve them?
- **Outcome:** Noto Serif, OpenDyslexic (asked for by Trevor on Nov. 21,
  2026) and the device's own font. Recorded in [site/DESIGN.md](../../../site/DESIGN.md), sections 6 and 7.

## Licenses

| Font | Package | License | Reserved Font Name |
| --- | --- | --- | --- |
| Noto Serif | `@fontsource/noto-serif` 5.3.0 | SIL Open Font License 1.1 | None |
| OpenDyslexic | `@fontsource/opendyslexic` 5.3.0 | SIL Open Font License 1.1 | "OpenDyslexic" |
| Literata (not chosen) | `@fontsource/literata` 5.3.0 | SIL Open Font License 1.1 | |
| Source Serif 4 (not chosen) | `@fontsource/source-serif-4` 5.3.1 | SIL Open Font License 1.1 | |

The OpenDyslexic license file opens: "Copyright (c) 2019-07-29, Abbie Gonzalez … with Reserved Font Name OpenDyslexic … This Font Software is licensed under the SIL Open Font License, Version 1.1."[^opendyslexic-license] Its website says it "now uses the SIL-OFL license, giving you freedom to use it for personal use, business use, education, commercial, books, ebook readers, applications."[^opendyslexic-site]

A Reserved Font Name matters for web fonts. The OFL FAQ says that "subsetting a webfont" is modification, which "would not normally allow the use of RFNs," but that a WOFF2 version can be made that "is not considered modification."[^ofl-faq] The Fontsource OpenDyslexic files are not subset: each holds the whole font (1,927 glyphs, 1,586 characters) with the original name and license records, version 0.920 (project measurement with fontTools). The site serves them as they are, so it may keep the name.

## Character coverage

Nation names use characters such as ʻ (ʻokina), ō, ʷ and ʔ, which Atkinson Hyperlegible Next lacks (pdf/fonts/README.md). Measured in the Fontsource files (project measurement):

| Font | ʻ | ō | ʷ | ʔ |
| --- | --- | --- | --- | --- |
| Noto Serif (latin and latin-ext files) | yes | yes | yes | yes |
| Literata | yes | yes | no | no |
| Source Serif 4 | yes | yes | yes | no |
| OpenDyslexic | yes | yes | yes | yes |

Noto Serif was chosen over Literata and Source Serif 4 because it covers all four and matches the Noto fonts the site already uses for missing characters, so a name does not switch between a serif and a sans serif mid-word (project analysis).

## What the research says about OpenDyslexic

A study of elementary students with dyslexia compared OpenDyslexic with Arial and Times New Roman and found "no improvement in reading rate or accuracy for individual students with dyslexia, as well as the group as a whole," and "none of the participants reported preferring to read material presented in that font."[^wery] The study was small (single-subject design), and the font is offered because Trevor asked for it and some readers may still choose it. The site describes it only as "a font designed for readers with dyslexia" and makes no claim that it helps reading (project choice).

## Text spacing

The "Wide" text spacing setting uses the values that WCAG 2.2 success criterion 1.4.12 tests: line height at least 1.5 times the font size, space after paragraphs 2 times, letter spacing 0.12 times and word spacing 0.16 times.[^wcag-1412]

[^opendyslexic-license]: Abbie Gonzalez, *OpenDyslexic*, OFL.txt, [github.com/antijingoist/opendyslexic](https://github.com/antijingoist/opendyslexic) (read Nov. 21, 2026).
[^opendyslexic-site]: *OpenDyslexic*, [opendyslexic.org](https://opendyslexic.org/) (read Nov. 21, 2026).
[^ofl-faq]: SIL International, *OFL-FAQ*, entries 2.2 and 2.6, [openfontlicense.org/ofl-faq](https://openfontlicense.org/ofl-faq/) (read Nov. 21, 2026).
[^wery]: J. J. Wery and J. A. Diliberto, *The effect of a specialized dyslexia font, OpenDyslexic, on reading rate and accuracy*, 67 Annals of Dyslexia 114 (2017), [doi.org/10.1007/s11881-016-0127-1](https://doi.org/10.1007/s11881-016-0127-1).
[^wcag-1412]: W3C, *Understanding Success Criterion 1.4.12: Text Spacing*, [w3.org/WAI/WCAG22/Understanding/text-spacing](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing).
