---
id: 2026-11-27-language-pages
date: '2026-11-27'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session wrote scripts/languages/build_registry.py and ran it; no language file was written by hand.
- kind: page-fetch
  name: zenodo.org, glottolog.org, iso639-3.sil.org and uaf.edu
  detail: The Glottolog 5.4 CLDF release (Zenodo record 24101243); Glottolog's page data for each of the 115 languoids (https://glottolog.org/resource/languoid/id/<glottocode>.json); the ISO 639-3 code table, Language Names Index and retirements table; the Alaska Native Language Center's list of Alaska Native languages.
purpose: 'Trevor approved the language pages on Nov. 27, 2026 (mockup v2, project thread "Link each nation to its language resources"; research/analyses/2026-11-27-language-resources.md, approach A). This session builds the registry the pages read: one file in content/languages/ for each of the 115 language tags in the nation records, with the ISO 639-3 code, the Glottolog entry and family, the language''s own name, its dialects, the Endangered Languages Project and Alaska Native Language Center links, and the grammars and dictionaries Glottolog lists.'
queries:
- For each language tag in the nation records, its ISO 639-3 code (mapping the BCP 47 two-letter tags ch, oj and sm to cha, oji and smo) and the Glottolog languoid that carries that code
- For each languoid, its family, the languoids one step below it, the name Lexvo gives it in its own language, and the references Glottolog links to it
sources_added:
- glottolog-5-4
- iso-639-3-code-tables
- alaska-native-language-center-languages
limits: 'Glottolog gives four of the 115 codes to a family rather than a language (del Common Delaware, hai Haida, ipk Inupiaq and, through its Ojibwa family, oji), and wnw to a dialect (Nuclear Wintu); the pages say what Glottolog says. The ISO 639-3 code wya, which the Wyandotte Nation record uses, was retired on Jan. 20, 2022 and split into Wyandot (wyn) and Wendat (wdt); the page links wyn and says so, and the record is unchanged. The grammars and dictionaries are Glottolog''s classes of its own references, not read by the project; guesses Glottolog''s software made from a title are kept only when the title word means dictionary. Endangerment figures were not taken (held for the Indigenous advisory council and Trevor). Nothing was archived: the Wayback Machine is not reachable from cloud sessions.'
---

# Language pages: session notes

## What was built

`scripts/languages/build_registry.py` reads the language tags in `content/tribes/`, the Glottolog 5.4 CLDF release, Glottolog's page data for each languoid and the ISO 639-3 tables, and writes `content/languages/<tag>.yaml`. The file is named by the tag the records use, so `ch`, `oj` and `sm` keep their BCP 47 form. Every fact in a file names the source record it comes from.

## Counted on Nov. 27, 2026

- 115 language tags, 115 files.
- 25 Glottolog families among them, and 9 isolates (the language is its own top-level family in Glottolog).
- 595 grammars and dictionaries in all; 6 languages have none that Glottolog classes as a grammar or dictionary.
- 95 languages link the Endangered Languages Project, through Glottolog's links.
- 20 languages link the Alaska Native Language Center.
- 7 languages have an own name in Glottolog's catalogs tagged with the language's code; the rest show only the names the records and ISO 639-3 give.
