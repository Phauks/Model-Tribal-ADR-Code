# Treaty signers: how many people, how many repeat, how reliably names can be matched

**Status:** research spike, written Nov. 26, 2026, in answer to Trevor's question whether to make a stub page for every signer of a treaty, not only people who signed more than one. No pages were built and no site code was changed. The stub decision of Nov. 24 (no automatic stub pages for people) stands until Trevor decides otherwise.

## 1. Short answer

| | Native signers | U.S. signers |
|---|---|---|
| Signer lines (mentions) | 9,173 on 368 of the 370 ratified treaties | 792 on 358 treaties |
| Distinct people, best estimate | **about 7,500** (range about 7,000 to 7,800) | **about 223** (up to about 290 if every "unsure" name counts) |
| Signed two or more treaties | **about 800 to 900** | **about 113** |
| Already have a page | 926 biographies (they hold 1,526 of the 9,173 mentions) | 1 (Andrew Jackson's President page) |
| Would need a new page if every signer got one | **about 6,500** | **about 222** |

So a page for every signer means about 6,700 new pages, more than double the 2,997 entries on the Stubs list today, and about 7,000 of the roughly 7,700 people signed only one treaty, so their page could say little more than "signed this treaty for this nation."

Name matching is reliable only at the strict end. Exact spellings and same-sound spellings are right about 95 to 98% of the time in a judged sample; matches on the English rendering alone are wrong about 1 time in 5; looser spelling matches are wrong about half the time (section 4).

## 2. Where the numbers come from

- **Native signer lines.** The list Haiku read from the OCR text of the Statutes at Large on Nov. 24 for the biographies thread, [treaty-signers.json](../biographies/2026-11-24/treaty-signers.json): 9,250 lines, of which 8,851 passed the script check that the name appears on the page (the other 399 are left out here). It had no signers for 17 treaties, so I added 322 marked names for those from Kappler's text by script ([treaty-signers-kappler-fill.json](../biographies/2026-11-26/treaty-signers-kappler-fill.json)). Total 9,173. Two treaties have no Native signatures in either text.
- **U.S. signer lines.** These had never been collected. I saved each treaty's page from the Oklahoma State University Tribal Treaties Database (Kappler's transcription, linked from `osu_url` in [treaties.json](../raw/2026-11-23/treaties.json)), cut out the signature sections by script, and had Haiku list the people who signed for the United States, leaving out witnesses, interpreters and secretaries ([instructions](../biographies/2026-11-26/us-signer-reader-instructions.md)). A script confirmed all 792 names appear in the text. Haiku put 67 more names in "unsure" (mostly people after the Native marks with no "In presence of" heading, and New York State commissioners in 1796 to 1797). Twelve treaties came back with no U.S. signer, mostly because the signature lines are not printed in the transcription. Result: [treaty-us-signers.json](../biographies/2026-11-26/treaty-us-signers.json).
- **Biographies.** The 926 biographies that hold treaty signings (content/biographies; linked to treaty pages in PR #496), matched back to signer lines by treaty and printed or English name; all 1,430 signing events matched a line. For U.S. signers I checked the Justices and Presidents data ([people.yaml](../../content/supreme-court/people.yaml)): only Andrew Jackson, who signed six treaties as a commissioner from 1814 to 1820, has a page. William Henry Harrison signed 14 but is not in that file, since he appointed no Justice.
- Scripts: [scripts/biographies/signer_count](../../scripts/biographies/signer_count/README.md).

## 3. Matching levels

Two Native lines are only ever matched when they come from different treaties, the nations they signed for share a nation family (Sioux bands count as one family, so do Chippewa bands, Sac and Fox, and so on), and the treaties are no more than 30 years apart, the same window the biographies script uses. Within that, five levels:

| Level | Rule | Distinct people | Signed 2+ treaties |
|---|---|---|---|
| L1 | Same printed name, letters only (hyphens, spaces, case ignored) | 8,587 | 424 |
| L2 | L1, or same English rendering ("Black Hoof") | 8,280 | 599 |
| L3 | L2, or same sound key (a simple spelling folding: ee/i, oo/u, c/k/q, doubled letters, h after a vowel) | 8,182 | 652 |
| Recommended | L1, or same sound key, or sound keys at least 85% alike; **no** English-only matches | 7,798 | 779 |
| L4 | L3, or sound keys at least 85% alike | 7,510 | 906 |
| (not used) | sound keys at least 75% alike | 5,985 | 982 |

The 75% level chains people together through near spellings (its largest group spans 103 treaties), so it is not a usable count.

For U.S. signers the names are English, so matching is simpler: exact full name (with Wm., Jno., Thos. and the like expanded) gives 245 people; same surname and first initial within 40 years gives 221. I read all 21 groups at that level that mix spellings: 17 are right ("Lew. Cass" and "Lewis Cass", "H. Dodge" and "Henry Dodge"), 3 join different people (D. B. Mitchell of the 1818 Creek treaty and D. D. Mitchell of 1851; John C. Calhoun and James S. Calhoun; Auguste and A. P. Chouteau), and 1 I cannot settle (E. E. L. Taylor and Edward B. Taylor). It also misses one OCR split (Minian and Ninian Edwards). That gives about 223. Surname alone joins brothers and relatives (Richard and Thomas Butler, Andrew and Thomas Lewis), so it is not usable.

## 4. How reliable the matching is

### 4a. The sample

I drew 250 pairs of Native signer lines from different treaties: 40 joined by exact name, 40 by English name only, 30 by sound key, 50 by sound keys at least 85% alike, 50 by 75 to 85% alike, and 40 near misses (60 to 75% alike, never joined). Two Haiku judges decided each pair separately (same person, different, or cannot tell) without seeing which group it came from ([instructions](../biographies/2026-11-26/signer-match-judge-instructions.md)). They agreed on 225 of 250; I settled the other 25 myself and read 20 of the agreed verdicts, all of which I would have given too. The pairs, both verdicts and reasons are in [signer-match-sample.csv](../biographies/2026-11-26/signer-match-sample.csv).

| Group | Pairs | Same | Different | Cannot tell | Wrong merges |
|---|---|---|---|---|---|
| Exact name | 40 | 38 | 1 | 1 | 2% to 5% |
| English name only | 40 | 30 | 7 | 3 | 18% to 25% |
| Same sound key | 30 | 29 | 1 | 0 | 3% |
| Sound keys 85%+ alike | 50 | 44 | 1 | 5 | 2% to 12% |
| Sound keys 75 to 85% alike | 50 | 17 | 23 | 10 | 46% to 66% |
| Near misses, 60 to 75% (not joined) | 40 | 4 | 31 | 5 | 10% to 22% are missed merges |

These verdicts are model judgments from the printed entries, checked by me, not findings from archival records, so the rates are estimates with wide margins (40 or 50 pairs per group).

### 4b. What makes it hard

- **Phonetic spelling.** The same signature reads differently in the two printings of the same treaty: 1,021 of the 8,851 Statutes at Large names (11.5%) do not appear letter for letter in Kappler's text of the same treaty. Across treaties, clerks spelled the same person very differently: Little Robe is "Hark-kah-o-me" in 1865 and "Hah-ket-home-mah" in 1867; Little Turtle is "Me-she-kun-nogh-quoh" in 1795 and "Mushekeuoghqua" in 1809.
- **Translated names.** The English rendering rescues cases like these (Black Hoof is "Ma-ka-te-we-ka-sha" in 1808 and "Cuttewekasa" in 1818), but common renderings ("Wolf", "Bear", "Sturgeon", "Crane", "Buffalo", "John") belong to many people, which is why English-only matches are wrong about 1 time in 5 even inside one nation family. Hereditary names make it worse: Hole-in-the-Day is printed for both the elder and the younger leader.
- **"His x mark" entries.** Removing the mark and seal text works: only 3 of 9,250 lines still carry it, and in those the whole name is "MARK" or similar, so they are reading errors to drop. The real problem with marked entries is that the person did not write the name; it is the clerk's hearing of it, which is the phonetic problem above.
- **Same name twice in one treaty.** 294 lines repeat a name already listed for the same nation in the same treaty. Kappler prints 182 of those twice (the same person signing a supplement, or two people with one name); 100 appear only once in Kappler, so they are double readings and inflate the count by about 100. The matching never joins lines from the same treaty, so it cannot tell these apart.
- **Name collisions with other pages.** The biography at /biographies/andrew-jackson is a Makah sub-chief, "Klah-pe-an-hie", whose English name is printed as Andrew Jackson in the 1855 Makah treaty, while the President who signed six treaties as a commissioner has his own page. Any automatic linking of U.S. signer names would have to tell these apart.
- **Disagreement with the biographies.** The biographies script matched names its own way (English or printed name plus first nation word). At the recommended level, 178 biographies' signings fall into more than one of my groups and 42 of my groups hold two or more biographies. Each of those is either a split or a merge by one of the two methods, and would need a person to look.

### 4c. Error estimate and suggested threshold

At the recommended level (exact name, same sound key, or sound keys 85%+ alike), about 2,000 joins are made; from the rates above, about 5% of them (roughly 2% to 9%) join different people, which is about 100 wrong merges. Splits remain: about a third of the pairs between 75% and 85% alike, and 1 in 10 near misses below that, are the same person, so several hundred people are still counted twice. That is why the best estimate (about 7,500) sits below the recommended level's 7,798.

From that, my suggestion if pages are ever made from matches:

1. **Join automatically** only on exact name or same sound key, within one nation family and 30 years (about 96% to 98% right in the sample).
2. **Send to a person** sound keys 85%+ alike and every English-only match (about 88% and 75% right).
3. **Never join** below 85% without a source that names the person (a biography, a nation's own history, or a scholarly edition of the treaty).

## 5. What this means for stub pages

This is my analysis, for Trevor's decision:

- **Every signer:** about 6,700 new pages, about 90% of them for people who appear once, with only a name, a nation as printed and one treaty. At the error rates above, about 1 in 20 pages joined from two or more treaties would mix two people, and several hundred people would get two pages. These are Native nations' ancestors, so wrong joins are a CARE concern, not only a data quality one.
- **Middle options, if Trevor wants more than today:**
  - **U.S. signers (about 222).** Few, English names, easy to match, well documented (Lewis Cass, William Clark, Isaac Stevens), and the 3 wrong joins found are easy to fix by hand.
  - **Native repeat signers not yet in a biography (about 400 to 450).** These are people the matching finds on two or more treaties whom the biographies script missed. They would need the person review in 4c step 2 first.
  - **Everyone else:** stay plain text on the treaty page, as now (PR #496).
