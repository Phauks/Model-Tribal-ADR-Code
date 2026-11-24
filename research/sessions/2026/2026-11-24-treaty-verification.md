---
id: 2026-11-24-treaty-verification
date: '2026-11-24'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: A session that did not build the treaty records wrote scripts/law/verify_treaties.py, ran it, and read by hand the page images and database pages the script could not settle. Three Haiku readers read the Statutes at Large text of the 44 ratified treaties the script could not settle; every mismatch they reported was read again by this session.
- kind: page-fetch
  name: treaties.okstate.edu and its CONTENTdm collection (cdm17279.contentdm.oclc.org)
  detail: The database page of all 688 treaties and agreements, the item record (with the scan's text) of each linked scan, and 32 scan PDFs, at about one request a second.
purpose: 'An independent check of the 688 treaty and agreement records from PR #460 against the texts themselves. Trevor approved steps 1 to 3 of the plan (Nov. 24, 2026): for each ratified treaty with a stored Statutes at Large text, the parties, the date signed, the citation and the ratification and proclamation dates; the Kappler page on the Oklahoma State University scan; and, for the unratified treaties and agreements, that each is a real document with the right date and status. Step 4, the links from treaties to today''s nations, comes later.'
queries:
- Does the stored Statutes at Large text begin at the cited page, with the treaty's date signed, and name the parties the title names?
- Are the ratification and proclamation dates in Kappler's header printed in the Statutes at Large?
- Does the database's scan of Kappler begin on the page the record gives?
- Does the database hold each unratified treaty and agreement, with a matching date and the status the record gives?
sources_added: []
sources_updated: []
limits: 'Nothing here marks a record Verified: under the project''s rule only the nation''s own review does that, so every record stays Unverified and says what was checked. The script reads the scans'' text layers, which misread digits and split words; its matches allow for that, and every case it could not settle was read by a person or a reader. Four unratified papers that the database marks ratified (Oneida 1798 and 1802, Seneca Aug. 20, 1802, Cherokee Dec. 2, 1807) were not checked against the Senate Executive Journal, so their status is recorded as open. The links from treaties to nations were not checked (step 4).'
---

# Treaty records checked against their texts: session notes

## How it was checked

`scripts/law/verify_treaties.py` has four steps. `texts` reads the stored Statutes at Large copies (downloaded from the bucket and matched to the index by SHA-256), `fetch` saves each database page and the item record of its Kappler scan, `report` writes the two check files, and `apply` writes a dated "Text check" sentence into every record's notes, with the corrections below. A rerun of `scripts/law/treaty_records.py records` rewrites the notes, so run `verify_treaties.py apply` after it.

For a ratified treaty, the script passes the citation when the first page's running head carries the cited page number (or the next page carries the next number, or the granule is a single unnumbered page GovInfo files at that page). It passes the date signed when the margin or headnote prints it on the first page, the parties when each party word of the title appears in the text (with the older spellings the Statutes at Large use), and the ratification and proclamation dates when the text prints them either as figures or written out ("the twenty-first day of June ... one thousand eight hundred and fifty-four"). For the Kappler page it reads the running head of the scan's first page.

## Results

[Ratified treaties](../../reviews/2026-11-24-treaty-verification-ratified.csv): all 370 confirmed. The script settled 323 against the text; Haiku readers settled the other 44, and I read every mismatch they reported against the text myself. 32 Kappler pages that the scan's text misread were read on the page images. Three treaties not printed in the Statutes at Large (Fort Laramie 1851, Eastern and Western Shoshoni 1863) were checked against Kappler only.

What differs from the data, all now noted on the records:

1. The 1815 and 1825 "Makah" treaties are with the Mahas (Omaha), as the build thread also found.
2. Kappler's header and the Statutes at Large disagree on seven dates. The Statutes at Large print the Senate's consent to the Delaware treaty of 1860 as June 27, 1860 (Kappler: July 27) and to the Eastern Shoshoni and Bannock treaty of 1868 as Feb. 16, 1869 (Kappler: Feb. 26, after the proclamation); the Choctaw treaty of 1802 as ratified Jan. 20, 1803 (Kappler: June 20); and the Comanche, Kiowa and Apache proclamation as Feb. 12, 1854 (Kappler: 1855 with 1854 in brackets). The Quapaw treaty of 1818 is printed as proclaimed Jan. 5, 1818, before it was signed; Kappler corrects it to 1819. The headers' 1877 (Ponca 1817) and 1319 (Miami 1818) are misreadings of 1817 and 1819.
3. The Statutes at Large do not print the ratification date of the early treaties in volume 7 or the proclamation of the Menominee supplementary articles of Feb. 17, 1831; the records say so.
4. The database page for the Noisy Pawnee treaty of 1818 links the Pawnee Marhar scan; Kappler p. 157 was read on the scan titled "Treaty with the Grand Pawnee, 1818". The Winnebago treaty of 1816 had no Kappler page; the scan gives p. 130.

[Unratified treaties and agreements](../../reviews/2026-11-24-treaty-verification-other.csv): the database holds all 318 (each with a scan, another source or a full transcription), every date matches the year, and 304 needed no change. Corrected:

1. Seven are treaties of the Hawaiian Kingdom with Great Britain, Sweden and Norway, Russia, Japan (1871 and 1886), Denmark and Hamburg, and on the rights of neutrals at sea, not treaties of the United States with a Native nation. Their author is now the Hawaiian Kingdom and their notes say what each is.
2. The Sioux treaty of 1805 (Pike's) was ratified by the Senate on Apr. 16, 1808 and never proclaimed, so "unratified" was wrong.
3. Four papers the database marks ratified, though Kappler's list leaves them out, now say their status is open: the Oneida treaties of June 1, 1798 and June 4, 1802, the Seneca treaty at Albany of Aug. 20, 1802, and the Cherokee treaty of Dec. 2, 1807. The Senate Executive Journal would settle them.
4. The Christian Indians treaty is dated Dec. 16, 1856, not 1854.
5. The Creek agreement of Sept. 27, 1897 is marked "not ratified - considered valid" in the database.
