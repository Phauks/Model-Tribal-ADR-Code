---
id: 2026-11-23-blacks-law-dictionary
date: '2026-11-23'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: legal-database
  name: Westlaw
  detail: Trevor printed Black's Law Dictionary (12th ed. 2024) entries from Westlaw on Nov. 23, 2026; the prints are filed privately in the sources bucket under westlaw/blacks-law-dictionary-12/.
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: Read the text of each print with pdftotext, matched entries to glossary terms, chose a short phrase from each and checked that it appears word for word in the print.
purpose: 'Trevor asked to add Black''s Law Dictionary definitions to the glossary (Nov. 23, 2026). The current edition is under copyright, so each entry is cited and quoted only as a short phrase of at most 20 words; Trevor chose not to use the public domain 1891 and 1910 editions.'
queries:
- 'Black''s Law Dictionary (12th ed. 2024) headwords matching the glossary entries (research/documents-to-get.md, section 5d)'
sources_added:
- blacks-law-dictionary-2024-alternative-dispute-resolution
- blacks-law-dictionary-2024-bureau-of-indian-affairs
- blacks-law-dictionary-2024-citizen
- blacks-law-dictionary-2024-indian
- blacks-law-dictionary-2024-indian-country
- blacks-law-dictionary-2024-indian-reservation
- blacks-law-dictionary-2024-indian-sovereignty-doctrine
- blacks-law-dictionary-2024-indian-tribe
- blacks-law-dictionary-2024-nation
- blacks-law-dictionary-2024-native
- blacks-law-dictionary-2024-sovereignty
- blacks-law-dictionary-2024-tribal-court
- blacks-law-dictionary-2024-tribe
limits: 'Covers the 41 prints Trevor sent. Black''s has no headword for Native American, Native Hawaiian, Alaska Native or indigenous (Trevor searched, Nov. 23, 2026), no entry for peacemaking (only "peacemaker", in a general sense) and no tribal sense of "recognition". Its "aborigine" entry was not used for Indigenous, because Black''s itself notes the word is considered pejorative in Australian usage. Arbitration and mediation have prints but no glossary entry of their own. Every reading awaits the lead author''s review.'
---

# Black's Law Dictionary in the glossary: session notes

Black's Law Dictionary is under copyright (Thomson Reuters), so the glossary does not reproduce its definitions. Each matching glossary entry cites the Black's entry and quotes a short phrase from it, as courts do. The quotation is in the entry's `law_dictionary` field, and `scripts/validate_records.py` refuses one longer than 20 words. The Westlaw prints are kept privately as the record of what each quotation was checked against.

| Glossary entry | Black's headword | Phrase quoted (words) |
|---|---|---|
| ADR | alternative dispute resolution | 16 |
| BIA | Bureau of Indian Affairs | 20 |
| citizen | citizen (sense 1) | 14 |
| Indian tribe | Indian tribe | 12 |
| federally recognized tribe | Indian tribe (Black's sends "federally recognized tribe" there) | 18 |
| Alaska Native village | Indian tribe | 17 |
| Indian country | Indian country (sense 1) | 18 |
| Indian | Indian (sense 2) | 13 |
| American Indian | Indian (sense 2) | 9 |
| Tribe | tribe (sense 2) | 17 |
| reservation | Indian reservation | 15 |
| Tribal court | tribal court | 20 |
| Native | native (sense 4) | 13 |
| nation | nation (sense 2) | 14 |
| sovereignty | sovereignty (sense 1) | 5 |
| sovereignty | Indian-sovereignty doctrine | 14 |

Black's defines "tribal court" only under the Indian Child Welfare Act, so the phrase quoted is the one describing Tribal courts generally: not part of any state's judicial system. Its "peacemaker" entry is about anyone who persuades others to stop fighting, not Tribal peacemaking, so the peacemaking entry does not cite it.
