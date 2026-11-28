---
id: 2026-11-27-indian-affairs-manual
date: '2026-11-27'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session wrote scripts/law/indian_affairs_manual.py and ran it; no record was written by hand.
- kind: page-fetch
  name: bia.gov
  detail: The Bureau of Indian Affairs' Indian Affairs Manual page (https://www.bia.gov/policy-forms/manual) and the 233 chapter files it links, six at a time.
purpose: 'Trevor asked to close the tier 2 data gaps (project thread "Close the tier 2 data gaps", Nov. 27, 2026: "work on those tier 2 gaps"). The data roadmap listed the Indian Affairs Manual as high value and scriptable now. This session gives each chapter its own source record and a stored copy, served by the site.'
queries:
- The Indian Affairs Manual page, every part's table of chapters (bia.gov, Nov. 27, 2026)
sources_added: []
limits: 'The records carry the manual page''s facts (part, chapter, title, issued date); nobody has read the chapters, so every record is Unverified. Chapters the page lists without a file (most marked Reserved) have no record. The handbooks and national policy memoranda the manual names are on pages of their own and are not part of this session.'
---

# Records for the Indian Affairs Manual: session notes

## What was built

`scripts/law/indian_affairs_manual.py` has three steps. `fetch` reads the manual page, one table per part, and downloads the file each chapter row links. `file` stores each file in the bucket under `indian-affairs-manual/<part>-<chapter>-<file name>` and adds it to the capture index, served as a work of the United States government. `records` writes one source record per chapter, keyed `indian-affairs-manual-<part>-<chapter>`.

## Records

Each chapter is a `federal-agency-document` with the genre "Indian Affairs Manual chapter", author U.S. Department of the Interior, Indian Affairs, number "<part> IAM <chapter>" (the form the Department uses), the part's name as its section, and the issued date the page gives. The site lists them as the Indian Affairs Manual collection, with each chapter's part.

## Results

The page lists 358 chapter rows in 93 parts; 233 rows in 48 parts link a file (all PDFs), and the other 125 are Reserved or have no file. Every file downloaded and was stored. The issued dates run from Oct. 14, 1998 to Nov. 19, 2026. The parts with the most chapters are Education (25), Financial Management (15), Real Estate Services (12), Facilities Management (12), Delegations of Authority (10) and Forestry (10).

## Next

A person reads the chapters on trust land, probate, self-determination contracting, law enforcement and Tribal government services first, and links each to the regulations (25 C.F.R.) and statutes it carries out. A source watch for the manual page would catch new and revised chapters.
