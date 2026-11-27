---
id: 2026-11-27-treaty-signer-offices
date: '2026-11-27'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session wrote scripts/biographies/check_signer_offices.py and add_signer_offices.py, matched U.S. signers to members of Congress by hand, and had six Haiku readers list the offices each treaty gives its U.S. signers.
- kind: page-fetch
  name: Oklahoma State University Tribal Treaties Database
  detail: Kappler's text of the 370 ratified treaties, saved by scripts/biographies/signer_count/fetch_osu.py.
- kind: page-fetch
  name: congress-legislators (legislators-historical.yaml)
  detail: The public-domain export of the Biographical Directory of the United States Congress, for terms of service.
purpose: 'Trevor asked on Nov. 27, 2026 that treaty signer pages state the signer''s position of power where possible, not only "Commissioner" (project thread "Add pages for treaty signers"). This session adds the offices each treaty''s text gives its U.S. signers, the terms in Congress of the U.S. signers who sat there, and leads that open with the position, for U.S. and Native signers.'
queries:
- The opening and signature section of each of the 358 treaties with a U.S. signer, read for the offices the text gives each signer
- Members of Congress with the signer's family name and agreeing given names, serving within 40 years of the signer's treaties
sources_added:
- biographical-directory-of-the-united-states-congress
limits: 'Offices come only from the treaty text and the Congress directory. Governorships, cabinet posts and military ranks a treaty does not print are not added: the directory''s prose biographies (which list them) could not be read automatically, and no state rosters were used. Term spans are the Congresses the member was elected to, not the exact days served. Native positions are the titles printed with the signatures; nations'' own histories were not used. Every page stays Unverified.'
---

# Offices and positions of treaty signers: session notes

## Offices the treaties print

Each treaty's opening and signature section in Kappler's text was read by a Haiku reader (`research/biographies/2026-11-27/us-signer-office-reader-instructions.md`), who listed every office the text gives each U.S. signer. `scripts/biographies/check_signer_offices.py` keeps an office only when its words appear in that treaty in order (ignoring case, spacing, punctuation and a plural printed for a group): 943 offices on 358 treaties kept, 8 dropped (`us-signer-offices-dropped.csv`), mostly where the reader filled in "the said territory".

## Congress

Of the 224 U.S. signer pages, 64 share a family name and agreeing given names with a member of Congress serving within 40 years of the signer's treaties. I read each by hand (`us-signer-congress-matches.csv`): 51 are the same person, and 13 are not, for example William Clark of Pennsylvania (not the explorer), Return J. Meigs Jr. (the senator, son of the Cherokee agent who signed), Luke Lea of Tennessee (uncle of the 1851 Commissioner of Indian Affairs) and John Coffee of Georgia (cousin of General John Coffee). Each term becomes a life event cited to the directory by Bioguide ID; a territory's delegate is named as one.

## Leads

`scripts/biographies/add_signer_offices.py` rewrites leads the signer scripts wrote: a U.S. signer's lead opens with their seats in Congress and up to three offices the treaties name (the commissioner role itself is left to the signing); a Native signer's lead opens with the title printed with their latest titled signature ("Head chief of the Middle Oregons, as listed in the Treaty with the Middle Oregon Tribes, 1865."). 807 pages changed.

## Next

The directory's prose biographies list governorships, state offices and cabinet posts; reading them (or state rosters of governors) would fill the gap for signers like Albion K. Parris, Governor of Maine. Titles printed only as group headings in Kappler ("Chiefs and headmen") and nations' own histories could add Native positions.
