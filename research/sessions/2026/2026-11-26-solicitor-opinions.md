---
id: 2026-11-26-solicitor-opinions
date: '2026-11-26'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session wrote scripts/law/solicitor_opinions.py and ran it; no record was written by hand.
- kind: page-fetch
  name: thorpe.law.ou.edu
  detail: The University of Oklahoma Law Library's index of the 1917-1974 volumes and its 84 pages of their text, one request a second.
- kind: page-fetch
  name: doi.gov
  detail: The Solicitor's index of M-Opinions since 1993 and the PDFs of the opinions on Indian affairs.
purpose: 'Trevor asked to add the sources missing from the data roadmap and to collect the ones that are high value and scriptable (project thread "Add the new data sources to the roadmap and collect them", Nov. 26, 2026). This session gives each opinion of the Solicitor of the Department of the Interior on Indian affairs its own source record and a stored copy, served by the site.'
queries:
- https://thorpe.law.ou.edu/solicitor.html and the 84 page files it links (sol_opinions/p1-26.html through p2076-2100.htm), Nov. 26, 2026
- https://www.doi.gov/solicitor/opinions (the table "All Solicitor M-Opinions, 1993 to Present"), Nov. 26, 2026
sources_added: []
limits: 'Every record is Unverified. The 1917-1974 subjects, dates and pages were read by script from the University of Oklahoma web text, not from the printed volumes, and the subjects were set from capitals into title case by script, so a few read oddly. Nations are matched by name in the subject only, which links 18 records; most subjects name a nation by one word ("Osage", "Crow") that the matcher does not take alone.'
---

# Records for the Solicitor's opinions on Indian affairs: session notes

## What was built

`scripts/law/solicitor_opinions.py` has three steps. `fetch` reads both indexes. For 1917-1974 it joins the 84 pages of the University of Oklahoma text of *Opinions of the Solicitor of the Department of the Interior Relating to Indian Affairs 1917-1974* (2 volumes, 1979; volume 2 begins at page 1109) and cuts it at each opinion's heading: the subject in capitals, any *Interior Decisions* or *Land Decisions* citation, the M-number and the date. A citation of an opinion inside another one ("Solicitor's Opinion, M-28086, July 17, 1935") follows ordinary words rather than capitals, so it is not taken as a heading. Each opinion's text, with the printed page numbers marked "[page N]", is kept as a small web page. For the years since 1993 it keeps the opinions on the Solicitor's index whose subject is about Indian affairs (by the words in the script's `SUBJECT_WORDS`) and downloads each PDF. `file` stores the copies in the bucket under `solicitor-opinions/1917-1974/` and `solicitor-opinions/since-1993/`, served as works of the United States government. `records` writes one record per opinion, `solicitor-opinion-<m-number>`, of kind `federal-agency-document`, with the Office of the Solicitor as author, "Solicitor's opinion" as its kind and the volume and page where it is printed.

## Results

From the 1917-1974 volumes, 512 opinions (498 M-numbers, 232 in volume 1, 9 of them supplements), dated Oct. 7, 1917 to May 29, 1974. From the index since 1993, 38 of its 109 opinions are about Indian affairs, including the withdrawals and reinstatements of earlier ones; the index's "Under Suspension Review" mark is kept in the notes. In all 549 new records. Two opinions already had records and are left to them: Powers of Indian Tribes (M-27781, 1934) and M-37083 on the Native Hawaiian community.

## Gaps and checks

Fifteen M-numbers in the University of Oklahoma index were not found as headings in its text (M-12509, M-25281, M-27744, M-30655, M-33626, M-33633, M-33709, M-33717, M-33857, M-34814, M-35003, M-35032, M-36341, M-36606, M-36811), so their text stays inside the opinion before them. Eight records have no subject (M-27145, M-31039 and its supplement, M-36049, M-36186, M-36803 supplement, M-36810 and M-36813), and a few subjects keep part of the line before them, such as M-31838's, which begins with a citation. A person reading each opinion against the printed volumes fixes these. The opinions of 1975-1992 are not online as a set and need a library pull. Thirteen PDFs from the index were stored in an early run and then left out as not about Indian affairs; they sit in the bucket under `solicitor-opinions/since-1993/` with no index row.

## Next

Read each opinion's nations from its text, not only its subject, and link the Solicitor's later withdrawals to the opinions they withdraw.
