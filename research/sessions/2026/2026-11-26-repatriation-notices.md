---
id: 2026-11-26-repatriation-notices
date: '2026-11-26'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session wrote scripts/law/repatriation_notices.py and ran it; no record was written by hand.
- kind: other
  name: Federal Register API
  detail: The National Park Service's documents since 1994 that name the Native American Graves Protection and Repatriation Act, with their numbers, dates, citations, abstracts and GovInfo PDFs.
purpose: 'Trevor asked to add the sources missing from the data roadmap and to collect the ones that are high value and scriptable (project thread "Add the new data sources to the roadmap and collect them", Nov. 26, 2026). This session gives each repatriation notice its own record and a stored copy, so a nation''s page can list the repatriations that concern it.'
queries:
- 'Federal Register API, agency national-park-service, term "Native American Graves Protection", each year 1994-2026, Nov. 26, 2026: 6,936 documents'
sources_added: []
limits: 'Every record is Unverified. Nations are matched by name in each notice''s text, cut from its PDF between the document before it and its own "[FR Doc." line; a notice names the nations consulted as well as those that may claim, and the records do not tell them apart. For 75 notices the cut failed (columns out of order, or no PDF) and only the title and abstract were matched.'
---

# Records for the repatriation notices: session notes

## What was built

`scripts/law/repatriation_notices.py` asks the Federal Register API, year by year, for the National Park Service's documents that name the Native American Graves Protection and Repatriation Act, and downloads each GovInfo PDF. It reuses `scripts/law/federal_register_documents.py` for the record's shape and key (`federal-register-<document number>`), with the topic `repatriation`. `file` stores each PDF in the bucket under `repatriation-notices/<document number>.pdf`, served as a work of the United States government. The pages show each notice's facts and its text; the notices describe ancestors' remains and sacred objects, and the site adds no pictures.

The abstracts rarely name a nation ("Indian Tribes in this notice"), so `records` reads each notice's own text from its PDF. A Federal Register PDF holds whole pages, with the end of the document before and the start of the one after, so the text is cut at the "[FR Doc." lines. federalregister.gov's own text pages turn scripts away (they redirect to unblock.federalregister.gov), so the PDF is read instead.

The site lists these as their own collection, "Repatriation Notices", under Federal law, and leaves them out of "Federal Register Notices".

## Results

6,936 documents, 1994 to 2026: 4,763 notices of inventory completion, 1,880 notices of intent to repatriate or of intended repatriation, 135 notices of intended disposition and the rest corrections, amendments and the Act's rules. 6,928 PDFs were downloaded (1.3 GB); eight documents have none. 6,237 records name at least one of 594 nations.

The nation name matcher took the Confederated Salish and Kootenai Tribes' own collective name, "the Tribes", as a name for them, so every notice saying "Indian Tribes" named them. The matcher now leaves out names made only of generic words (`scripts/law/nation_names.py`).

## Next

Tell the nations a notice says are affiliated from those it only consulted, and link each notice to its corrections.
