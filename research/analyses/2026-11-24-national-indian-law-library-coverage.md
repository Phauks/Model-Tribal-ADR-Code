# National Indian Law Library: how much of it we cover, which model codes nations adopted, and what to collect next

**Status:** research spike, written Nov. 24, 2026, in answer to Trevor's question "How much of NILL do we cover?" and his two follow-ups: what other subjects we could benefit from collecting, and how many nations adopted each of the model codes the library holds. No site or content was changed. Updated the same day after a later thread read the last 138 Gateway pages (sections 1, 2 and 5). Numbers in brackets point to the Sources list in section 7, which marks what I read or counted directly and what I inferred. "Project analysis" marks my own reasoning from those numbers.

## 1. Short answer

The National Indian Law Library (NILL) is the Native American Rights Fund's law library. Its four public collections are the Tribal Law Gateway (codes, constitutions and court information for each nation), the Indian Law Bulletins, its research guides, and its catalog [1][2][3]. We cover its nation-level holdings almost completely, its court opinions poorly, and its catalog not at all.

| NILL collection | NILL's size | What we hold | Coverage |
| --- | --- | --- | --- |
| Tribal Law Gateway: nations listed | 596 nation pages [1] | All 596 matched to a nation profile (7 by hand on Nov. 24) and read: 458 recorded as source records on Nov. 21, the last 138 on Nov. 24 | 100% matched; 100% read |
| Gateway: constitutions | NILL says "400+ constitutions" searchable [4]; 343 of the 596 pages list one | 305 of those 343 nations have documents in our governing documents index (1,279 documents for 396 nations, 922 read in full) | 89% of nations |
| Gateway: codes | NILL says "240+ tribal codes" [4]; 294 of the 596 pages list a code (on NILL's site or elsewhere) | 271 of those 294 nations have code text captured in our tribal law index; private research copies of 189 code folders (2,005 files) hosted by NILL | 92% of nations; about 79% of NILL's own code folders |
| Gateway: the last 138 pages (read Nov. 24) | 34 list a constitution or code with a link (42 of the 47 links go to NILL's own tables of contents); 104 list nothing with a link, 27 of them only pointing to NILL's catalog | 11 links new to the profiles of 9 nations; the other 35 were already on profiles from NILL's table of contents pages | Done |
| Tribal Courts Bulletin (selected opinions, 2016 to now, plus 40 older cases of note) | 407 cases from 52 nations [5] | 37 are in our 2,368-opinion Caselaw Access Project index; every bulletin case with an *American Tribal Law Reporter* citation in volumes 1-13 is there | 9% of cases; 20 of 52 nations have any opinions with us |
| Supreme Court Bulletin (1997-98 term to now) | 30 terms plus a 1988-98 summary [6] | Of 69 cases my parser read with a U.S. Reports citation, 28 are on our list of Supreme Court Native cases and 13 have records | Covered by the separate thread "Cover every Supreme Court Native case" |
| Federal Courts, State Courts, Legislation, Regulatory, Law Review and News Bulletins | About 210 federal court cases, 58 state court cases and 63 Federal Register documents in 2025 alone; archives back to 2001-2003 [6] | None as records | Not covered (tiers 2 and 3) |
| Catalog (books, codes in print, pleadings, legislative histories) | Not measurable: the catalog sits behind a CAPTCHA [7] | None | Unknown |

The short version: for "what law does this nation have and where is it," we already match NILL, because earlier threads built the nation profiles partly from its Gateway pages. What NILL has that we lack is court opinions after 2017, the federal and state court bulletins, and its print catalog.

## 2. Why the Gateway numbers look the way they do

On Nov. 21, 2026, an earlier thread read 458 of the Gateway's nation pages and recorded each as a source record (`content/sources/*/national-indian-law-library-*.yaml`), copying every listed code and constitution link into the nation's profile with a note saying where NILL pointed (counted). A crawl then followed those links: `research/tribal-law/documents.json` holds 2,042 NILL code addresses, of which 2,005 returned files (counted). Those NILL copies are private research copies, not served, and the nation pages link to NILL instead, under decision record 0043, because NILL's terms say a nation's permission to NILL "does not serve as implied consent to use the materials in any other way" [1].

Most of what the Gateway lists is not on NILL's own site. Of the code and constitution entries on our profiles that came from NILL, most say "At tribe's website" or point to the University of Oklahoma Law Library or the Library of Congress (counted from profile notes). Only 46 nations have a code entry whose note says "At NILL website" (counted), while 186 nations have NILL-hosted code files in our crawl, so the profile notes undercount what NILL hosts (project analysis).

The 138 pages this note first counted as never read had in fact been fetched on Nov. 21; that session dropped their source records because 126 of them listed nothing usable on their own and their table-of-contents listings were recorded under separate source records (research/sessions/2026/2026-11-21-justice-and-law.md). A Nov. 24 thread read the 138 again, one page at a time and six seconds apart, and recorded each as a source record (`scripts/review/nill_gateway_fetch.py`, `scripts/review/nill_gateway_apply.py`, research/reviews/2026-11-24-nill-gateway-remaining.json). Only 34 list a constitution or code with a link, and 42 of their 47 links go to NILL's own table-of-contents pages, which profiles already held; the 11 links new to profiles went to 9 nations, all of them state-recognized or not federally recognized groups (counted). The governance search log of every matched nation now records what its page listed.

The constitution share fell from the 97% first reported to 89% because the first count set 305 indexed nations, which included nations whose pages had not been read, against the 314 read pages that list a constitution; counted the same way over all 596 pages it is 305 of 343 (project analysis, from the counts file).

Matching is complete: every Gateway entry now has a profile. Seven entries the name match missed were matched by hand on Nov. 24 (Duwamish Tribe to the Duwamish Tribal Organization, Eastern Pequot Indian Tribe to the Eastern Pequot Tribal Nation, Haliwa-Saponi, Iqugmiut, Los Coyotes, the St. Francis/Sokoki Band to the Missisquoi, St. Francis-Sokoki Band, and the Snoqualmoo Nation to the Snoqualmoo Tribe of Whidbey Island), and four name matches that found two profiles were narrowed to one (Tuscarora, Northfork, Mission Creek) or split by link (Nipmuc). The reasons are in `MATCHES` in `scripts/review/nill_gateway_apply.py`. The other name matches have not been checked by hand (counted).

## 3. Court opinions

NILL does not hold a bulk collection of Tribal court opinions. Its court page sends readers to each nation's court, the Northwest Intertribal Court System's opinion database, the Southwest Intertribal Court of Appeals reporter, the Tribal Law and Policy Institute, and fee-based services (Westlaw for 21+ nations, Lexis for 32+, Casemaker for 62+, VersusLaw for about 22) [8]. What NILL itself publishes is the Tribal Courts Bulletin: a selection of notable opinions, each with its name, court, date, citations and topics [5].

I parsed every year of that bulletin (407 cases). The cases cluster in a few courts: Fort Peck (73), Mashantucket Pequot (42), Colville (40), Mohegan (29), Cherokee Nation (26), Eastern Band of Cherokee (21), Navajo (18), Tulalip (18) and Muscogee (16) (counted). Our Caselaw Access Project index ends in January 2017 with volume 13 of the *American Tribal Law Reporter*, so 299 bulletin cases decided after 2017 cannot be in it, and 32 of the bulletin's 52 nations have no opinions with us at all (counted). The most common topics are Tribal law, the Indian Civil Rights Act, negligence, child custody, sovereign immunity, jurisdiction and elections (counted from the bulletin's own topic labels).

The bulletin is a good list of what to collect, not a source to copy. Each entry names a citation (often Westlaw only) and sometimes a link to the nation's court or Turtle Talk. Under the Nov. 24 opinion-republishing note and decision record 0047, opinions from sources other than the Caselaw Access Project need each nation's permission and a privacy review (project analysis, from those notes).

## 4. Model codes: how many nations adopted each

NILL keeps its model codes in its catalog, under the subject "Model ordinances - Tribes" and the drafting guide's search for "Tribal law drafting" limited to codes [9]. The catalog now shows a CAPTCHA to scripts [7], so I could not list them and did not try to get around it. A person can open the catalog link in section 7 and send the list, and the counts below can then be extended to each one.

For the model codes that a federal office publishes and whose adoption it tracks, the numbers are:

| Model | Who wrote it | Nations that adopted or implemented it | Nations whose code text we hold mentions it |
| --- | --- | --- | --- |
| Model Tribal Sex Offender Registration Code (2017 revision) | Justice Department SMART Office [10] | 135 Tribal jurisdictions have "substantially implemented" the Sex Offender Registration and Notification Act [10] | 16 |
| HEARTH Act leasing regulations (built from the Bureau of Indian Affairs' sample regulations, memory) | Bureau of Indian Affairs [11][12] | The 100th approval was in 2023 [12]; 22 more approvals for 20 nations since [11]. Approvals count regulations, not nations, so nations are fewer than approvals | 8 |
| Model Tribal Secured Transactions Act (2005, revised 2017) | Uniform Law Commission committee with 10 nations [13][14] | No public count. The Crow Nation adopted it first, in 2006 [14]; the Interior Department funded 12 nations to explore adopting it in 2005-2006 [13]. A 2014 interview says the true number is "difficult to assess" because "there is no comprehensive, up-to-date repository of all tribal laws" [15] | 11 name a secured transactions act or code; 64 cite the Uniform Commercial Code or Article 9 |
| Tribal probate codes under the American Indian Probate Reform Act (2004) | Each nation, usually from model drafts (memory) | 8 approved codes plus 1 approved single-heir rule [16] | 5 |
| A code of judicial conduct (most follow the ABA model or the 1981 model for Indian court judges, memory) | ABA; National American Indian Court Judges Association | No public count | 25 |
| Uniform Child Custody Jurisdiction and Enforcement Act | Uniform Law Commission | No public count for nations | 6 |

The last column comes from a scan of the 1,497 law texts the project holds for 283 nations (`scripts/analysis/model_code_mentions.py`, counted). A mention is a lead, not proof of adoption, and nations whose codes are not online cannot show up. So the column is a floor, and it says most about which models are worth checking nation by nation (project analysis).

The pattern matters for our own model code. The federal models with high uptake (sex offender registration, HEARTH leasing) come with a federal benefit for adopting and a federal office that reviews each nation's law. The Uniform Law Commission's secured transactions act, with no such benefit, has no reliable count two decades on (project analysis, from [10]-[15]).

## 5. What we could legitimately add

From NILL itself, without copying its documents:

1. ~~**Read the 138 unread Gateway pages**~~ Done Nov. 24, 2026 (section 2). The 27 pages that point only to NILL's catalog name print copies (mostly constitutions) that a person could ask NILL about.
2. **Link each nation page to its NILL Gateway page**, which we already do for nations whose copies came from NILL (decision record 0043).
3. **Use the Tribal Courts Bulletin as a collection list.** Record its 407 cases as leads (name, court, date, citation, topics: facts), and ask each nation's court for its opinions, starting with the 32 nations we have none for. Mashantucket Pequot, Mohegan, Muscogee, Sault Ste. Marie, Tohono O'odham and Hoopa Valley publish opinions on their own court sites (memory; check each).
4. **Ask NILL.** The Ask NILL service will answer a limited number of requests [1]. Two useful asks: the list of model codes in its catalog, and whether NARF would agree to our linking to or listing its catalog records.
5. **The Indian Law Reporter cumulative index** that NILL keeps for Tribal court cases from 1981 to 2013 [8] is a list of citations we could use as leads, since our Caselaw Access Project set starts later for most nations.

What not to do: no scripted crawl of NILL (its terms refuse "frequent or systematic" requests [1]); no serving of NILL-hosted copies without the nation's own consent [1]; no copying of bulletin summaries, which are NILL's writing and partly vendor material.

## 6. Other subjects worth collecting

NILL's research guides list the subjects it thinks a reader of Indian law needs: federal recognition, enrollment, the Indian Claims Commission, trust funds, education, the Indian Child Welfare Act, repatriation, international law, peacemaking, jurisdiction, citizenship, prisoners' rights, environment, water, sacred sites, civilization policy and United States-Tribal relations [3]. Comparing that list and the bulletin topics with what we hold, these are the gaps most worth filling, in order (project analysis):

1. **Tribal court opinions after 2017**, from nations' own court sites and with their permission (section 3). This is the largest gap and the one most tied to the model code.
2. **Enrollment and disenrollment**: membership codes and the opinions applying them. It recurs in the bulletin (elections, disenrollment, Indian status) and in NILL's guides, and our profiles do not track it as a subject.
3. **Tribal court rules** (NILL has a separate court rules page [1]; we have 3 court rules entries across all profiles, counted). Rules of procedure are directly useful for the model code.
4. **Indian Child Welfare Act codes and state-Tribal agreements**: 97 of 283 nations' texts we hold mention the Act (counted), and child custody is the bulletin's fourth most common topic.
5. **Compacts and agreements beyond gaming**: tax, cross-deputization, child welfare and law enforcement agreements (NILL keeps a compacts page [1]); our `jurisdiction_agreements` field holds some.
6. **Federal court decisions on Indian law** (tier 2): NILL's Federal Courts Bulletin lists about 210 a year, a ready selection.
7. **Federal recognition and acknowledgment decisions** (tier 2): already on the federal coverage note's list.
8. **Water rights, sacred sites and repatriation**: each has a NILL guide and steady case law, but they sit furthest from the model code, so they come last.

## 7. Sources

"Read" means I fetched and read the page on Nov. 24, 2026. "Counted" means I counted from the page or the repository with a script. "Memory" means from my training knowledge, not checked in this session. I fetched 59 NILL pages in all, three seconds apart, once each.

1. National Indian Law Library, *Tribal Law Gateway*, https://narf.org/nill/triballaw/index.html. Read: the consent statement, and that NILL "will deny requests that appear to be frequent or systematic." Counted: 596 distinct nation pages, 6 marked state recognized and 3 not recognized; sub-pages for codes and constitutions, court opinions, court rules, compacts and agreements, treaties and legal histories.
2. National Indian Law Library, *About NILL*, https://narf.org/nill/about/index.html. Read: the three services (research help, Indian Law Bulletins, Tribal Law Gateway) and collection highlights, including "Legal pleadings from important Indian law cases (1970s - 1990s)" and federal legislative histories.
3. National Indian Law Library, *Research Guides*, https://narf.org/nill/resources/index.html. Read: the list of subject guides in section 6.
4. National Indian Law Library, *Researching Tribal Codes and Constitutions*, https://narf.org/nill/triballaw/codes.html. Read: "Find provisions in 240+ tribal codes and 400+ constitutions."
5. National Indian Law Library, *Tribal Courts Bulletin*, yearly pages 2016-2026 and "pre-2016," https://narf.org/nill/bulletins/tribal/2024.html and siblings. Counted: 407 cases; parsed into `research/nill-coverage/tribal-bulletin.csv` (name, court, date, citations, topics) by `scripts/analysis/national_indian_law_library_coverage.py`.
6. National Indian Law Library, *Archives for the Indian Law Bulletins*, https://narf.org/nill/bulletins/archive.html, and the 2025 Federal Courts, State Courts and Regulatory pages. Read: the year ranges. Counted: about 210, 58 and 63 dated entries in 2025. The Supreme Court Bulletin parse found 69 cases with a U.S. Reports citation, a partial count because older terms use other layouts (`research/nill-coverage/supreme-court-bulletin.csv`).
7. NILL online catalog (Softlink Liberty), http://nill.softlinkliberty.net/liberty/OpacLogin?corporation=NARF&noLogin=true. Read: a script request returns a "Human Verification" CAPTCHA page.
8. National Indian Law Library, *Tribal Court Opinion Resources*, https://narf.org/nill/triballaw/court.html. Read: the services and coverage counts in section 3 and the Indian Law Reporter index.
9. National Indian Law Library, *Drafting Tribal Law & Model Codes*, https://narf.org/nill/triballaw/drafting.html. Read: the catalog search instructions; its sample search link resolves to the catalog subject "Model ordinances - Tribes."
10. SMART Office, *Indian Tribes/Nations/Pueblos Implementing SORNA*, https://smart.ojp.gov/library/indian-country/sorna. Read: "There are currently 135 tribal jurisdictions that have substantially implemented SORNA's requirements," and the 2017 revised Model Tribal Sex Offender Registration Code.
11. Bureau of Indian Affairs, *Approved HEARTH Act Regulations*, https://www.bia.gov/service/HEARTH-Act/approved-regulations. Counted: 22 approvals for 20 nations listed from Oct. 2023 to June 2026; earlier years are not on the page.
12. Bureau of Indian Affairs, *Indian Affairs announces 100th HEARTH Act approval* (May 31, 2023), https://www.bia.gov/news/indian-affairs-announces-100th-hearth-act-approval. Read: the Pueblo of Santa Clara's ordinance was the 100th approved.
13. Office of Indian Energy and Economic Development, *Why Tribes Should Adopt a Secured Transactions Code* (Apr. 8, 2019), https://www.bia.gov/sites/bia.gov/files/assets/as-ia/ieed/pdf/Why%20Tribes%20Should%20Adopt%20a%20Secured%20Transactions%20Code%204.8.19.pdf. Read: the model was "created in 2004 and revised in 2017"; the 2005-2006 funded nations (Chippewa Cree, Crow, Northern Arapaho, Eastern Shoshone, Warm Springs, Seminole Nation of Oklahoma, Sac and Fox Nation, Oglala Sioux, Blackfeet, Umatilla, Tulalip).
14. Federal Reserve Bank of Minneapolis, *Crow Nation is first to adopt model secured transactions code* (July 1, 2006), https://www.minneapolisfed.org/article/2006/crow-nation-is-first-to-adopt-model-secured-transactions-code. Read.
15. Montana Legislature, State-Tribal Relations Committee, *Secured Transactions Codes: Overview* (interview with Woodrow, Jan. 2014), https://archive.legmt.gov/content/Committees/Interim/2013-2014/State-Tribal-Relations/Meetings/January-2014/Secured%20Transactions%20Codes_Overview_Woodrow.pdf. Read: the quoted sentence, and that Crow, Chippewa Cree, Oglala Sioux, Cheyenne River Sioux and Leech Lake had filing agreements with their states.
16. Bureau of Indian Affairs, Branch of Probate Services, *Approved Tribal Probate Codes*, https://www.bia.gov/bia/ots/dps/approved-tribal-probate-codes. Read: Agua Caliente, Umatilla, Fond du Lac, Northern Cheyenne, Red Cliff, Salt River Pima-Maricopa, Shoshone-Bannock and Yurok, plus Three Affiliated Tribes (single heir rule only).
17. Repository data, main at commit 556c971d: nation profiles (`content/tribes/`), NILL source records (`content/sources/`), `research/tribal-law/documents.json`, `research/constitutions/documents.csv`, `research/tribal-court-opinions/opinions.csv`, `research/supreme-court-coverage/native-cases-scdb.csv`. Counted by `scripts/analysis/national_indian_law_library_coverage.py` into `research/nill-coverage/` (`gateway-nations.csv`, `counts.json`) and by `scripts/analysis/model_code_mentions.py` into `research/nill-coverage/model-code-mentions.json`.
18. Earlier project notes: `research/analyses/2026-11-23-similar-legal-projects.md`, `research/analyses/2026-11-23-free-legal-information-sources.md`, `research/analyses/2026-11-24-republishing-tribal-court-opinions.md`, and decision records 0043 and 0047.
