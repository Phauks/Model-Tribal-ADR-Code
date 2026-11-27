---
id: 2026-11-27-historic-nation-laws
date: '2026-11-27'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session searched the Internet Archive and the Library of Congress for the nations' own printed laws, chose the volumes by hand (title, year and page count), then wrote scripts/law/historic_nation_laws.py and ran it.
- kind: page-fetch
  name: www.loc.gov, tile.loc.gov and archive.org
  detail: The Library of Congress's item JSON and PDF for each item on the project's list of Library of Congress items not yet in our records; the Internet Archive's advanced search, item metadata and PDFs.
purpose: 'Trevor picked new data source category 4, the nations'' historic laws, from the ranked list of new kinds of sources (project thread "Collect approved tribal laws, water settlements and old nation codes", Nov. 27, 2026: "grab 1,2,4").'
queries:
- 'Internet Archive titles naming a nation (Cherokee, Choctaw, Chickasaw, Muskogee, Creek, Seminole, Osage, Seneca, Sac and Fox and 45 others) with laws, constitution, acts, resolutions, code, statutes or council, dated 1800 to 1925'
- Internet Archive items whose creator, publisher or subject is one of those nations, dated 1800 to 1925
- The Library of Congress items not yet in our records (research/harvard-resources/library-of-congress-items-not-in-our-records.csv) dated before 1934
- HathiTrust's catalog (not searched; it answers scripts with a bot check)
sources_added: []
limits: 'Every record is Unverified: only the catalog records were read, not the volumes. Nations are matched by the name in the title or the catalog subjects, with three set by hand. The Internet Archive copies of editions the Library of Congress also has are left out. HathiTrust was not searched, so volumes held only there are missing. Seminole Nation laws were not found in either place. The Library of Congress list''s 229 constitutions and corporate charters from 1934 on (Indian Reorganization Act era) are left to the constitutions catalog.'
---

# Nations' historic laws: session notes

## What was built

`scripts/law/historic_nation_laws.py` has three steps. `fetch` reads the Library of Congress items dated before 1934 on the project's list of Library of Congress items not yet in our records, plus ten Internet Archive volumes that list lacks, and downloads each PDF. `file` stores each PDF under `historic-nation-laws/` in the bucket. `records` writes one source record per volume (kind `tribal-code`, or `tribal-constitution` for a constitution alone) and `research/historic-nation-laws/volumes.csv`.

## Results

- 87 volumes from 1826 to 1906, each with a stored, served copy: Choctaw 35, Cherokee 27 (3 from before the Act of Union of 1839, which also name the Eastern Band and the United Keetoowah Band), Muskogee 12, Chickasaw 6, Seneca 2, Osage 2, Sac and Fox 1, and 2 journals of the intertribal General Council of the Indian Territory.
- Many are in the nation's own language: Cherokee, Choctaw, Chickasaw and Creek editions sit beside the English ones.
- One collection, "Nations’ Historic Laws" (`historic-nation-laws`). It is left out of "Codes and Laws" and "Constitutions" so nothing is counted twice.

Three items on the Library of Congress list are not a nation's own law and are left out: the Interior Department's 1907 leasing regulations for the Five Tribes, William Wirt's 1830 opinion for the Cherokee Nation, and a 1900 brief on Choctaw and Chickasaw citizenship.

## Next

HathiTrust holds more of these (Chickasaw and Seminole session laws especially), but its catalog refuses scripts; a person could search it. The 229 Indian Reorganization Act era constitutions and charters on the same Library of Congress list belong in the constitutions catalog.
