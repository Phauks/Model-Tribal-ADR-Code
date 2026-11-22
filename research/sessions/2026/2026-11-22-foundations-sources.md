---
id: 2026-11-22-foundations-sources
date: '2026-11-22'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: The lead session audited the three drafts with scripts (keys, quotations, pinpoints), verified books in library catalogs by script, read the MacKenzie treatise, and wrote the additions. Two research helpers on a mid-size model gathered treaty clauses and bad-men cases, and territorial sources, under written rules (quote only from fetched text, give the URL, report what failed); the lead session spot-checked their quotations (Canandaigua art. VII, Richard, Tuaua, Flying Horse) against the sources before use.
- kind: page-fetch
  name: curl and pdftotext
- kind: library-database
  name: Berkeley Law library catalog (lawcat), MARC export
- kind: library-database
  name: Open Library search API
- kind: archive
  name: Internet Archive metadata API
- kind: web-search
  name: web search (research helpers only, to find addresses)
- kind: other
  name: EPUB text extraction
  detail: 'The lead author''s copy of Native Hawaiian Law: A Treatise, unzipped and converted to text in the session''s scratch folder; not committed.'
purpose: 'Strengthen Part I, Foundations: audit the sources of the three drafted chapters, find and verify the standard treatises and scholarship, fill the gaps logged for the legal history work (treaty dispute clauses, Hawaiʻi and the territories, compact clauses, the Cherokee and Worcester decision dates), and plan the two chapters that wait on Gate 1 without stating findings.'
queries:
- https://www.supremecourt.gov/opinions/datesofdecisions.pdf
- tile.loc.gov U.S. Reports scans for every Supreme Court case in volumes 1-570 cited in the drafts
- each cited record's original_link (Cornell LII, govinfo, Library of Congress, tribal and state sites)
- 'lawcat.berkeley.edu search, MARC XML: prucha great father; prucha american indian treaties; deloria lytle american indians american justice; deloria lytle nations within; wilkinson american indians time and the law; wilkins lomawaima uneven ground; fletcher federal indian law; fletcher american indian tribal law; harring crow dog''s case; norgren cherokee cases; robertson conquest by law; williams linking arms together; kappler indian affairs; deloria demallie documents; handbook of federal indian law 1942; pommersheim broken landscape; pevar rights of indians; duthu; wilkinson blood struggle; van dyke crown lands; reconsidering the insular cases; williams american indian in western legal thought; barsh henderson the road; prucha documents; indian law stories; merry colonizing hawaii; wilkins american indian sovereignty supreme court; pommersheim tribal justice; american indian law deskbook (not added)'
- 'lawcat with no hit: osorio dismembering; aloha betrayed; kauanui paradoxes; native hawaiian law treatise; native hawaiian rights handbook; sovereignty matters barker; ball constitution courts indian tribes'
- 'openlibrary.org/search.json: dismembering lahui osorio; aloha betrayed silva; paradoxes of hawaiian sovereignty; native hawaiian law a treatise; native hawaiian rights handbook; nana i ke kumu'
- 'archive.org advancedsearch: Cohen handbook 1942; Kappler laws and treaties'
- https://courts.navajo-nsn.gov/history.htm and ?p=88965 (frameset); publicguide.htm
- https://nill.narf.org/resources/civilization_policy.html
- 'Cornell LII: 18 U.S.C. 1152; 25 U.S.C. 1322, 5203, 349; 48 U.S.C. 1421a, 1661, 1801; 25 C.F.R. 83.1, 83.3, 83.4; 43 C.F.R. 50.1 (page text not usable)'
- 'treaties.okstate.edu: treaties of 1778, 1785, 1791, 1794, 1795, 1867 (Kiowa and Comanche; Kiowa, Comanche and Apache), 1868 (Ute, Sioux and Arapaho, Navajo)'
- static.case.law and cafc.uscourts.gov for Tsosie, Elk, Richard, Jones (2017, 2022), Flying Horse, Scott; Tuaua, Wabol, Davis
- history.state.gov FRUS 1929 vol. I docs. 853, 855; asbar.org A.S.C.A. 1.0202, 3.0207, 3.0208; cnmilaw.org 7 CMC 3401, 8 CMC 2302, 2902, 2904; govinfo Fitisemanu slip opinion
- govinfo STATUTE-107-Pg1510 (Apology Resolution); lrb.hawaii.gov/constitution; data.capitol.hawaii.gov HRS 10H-1
sources_added:
- asca-1-0202-preservation-of-samoan-customs
- barsh-henderson-the-road-1980
- cfr-25-83-1
- cmc-7-3401-applicability-of-common-law
- cohen-handbook-of-federal-indian-law-1942
- davis-v-guam-2019
- deloria-demallie-documents-of-american-indian-diplomacy-1999
- deloria-lytle-american-indians-american-justice-1983
- deloria-lytle-nations-within-1984
- downes-v-bidwell-1901
- duthu-american-indians-and-the-law-2008
- elk-v-united-states-2009
- fitisemanu-v-united-states-2021
- fletcher-american-indian-tribal-law-2d-2020
- fletcher-federal-indian-law-2016
- flying-horse-v-united-states-2017
- goldberg-washburn-frickey-indian-law-stories-2011
- harring-crow-dogs-case-1994
- instrument-of-cession-manua-1904
- instrument-of-cession-tutuila-1900
- jones-v-united-states-2017
- kappler-indian-affairs-laws-and-treaties-vol-2-1904
- kauanui-paradoxes-of-hawaiian-sovereignty-2018
- mackenzie-native-hawaiian-law-treatise-2015
- merry-colonizing-hawaii-2000
- navajo-nation-judicial-branch-history-of-the-courts
- neuman-brown-nagin-reconsidering-the-insular-cases-2015
- nill-civilization-regulations-and-policy
- norgren-cherokee-cases-2004
- osorio-dismembering-lahui-2002
- pevar-rights-of-indians-and-tribes-5th-2024
- pommersheim-broken-landscape-2009
- pommersheim-tribal-justice-2016
- prucha-american-indian-treaties-1994
- prucha-documents-of-united-states-indian-policy-3d-2000
- prucha-great-father-1984
- richard-v-united-states-2012
- robertson-conquest-by-law-2005
- silva-aloha-betrayed-2004
- supreme-court-library-dates-of-decisions-1791-1882
- treaty-with-the-cherokee-1785
- treaty-with-the-cherokee-1791
- treaty-with-the-delawares-1778
- treaty-with-the-kiowa-and-comanche-1867
- treaty-with-the-navaho-1868
- treaty-with-the-sioux-and-arapaho-1868
- treaty-with-the-six-nations-1794
- treaty-with-the-ute-1868
- treaty-with-the-wyandot-etc-1795
- tsosie-v-united-states-1987
- tuaua-v-united-states-2015
- usc-18-1152
- usc-25-1322
- usc-48-1421a
- usc-48-1661
- van-dyke-who-owns-the-crown-lands-of-hawaii-2008
- wabol-v-villacrusis-1990
- wilkins-american-indian-sovereignty-and-the-supreme-court-1997
- wilkins-lomawaima-uneven-ground-2001
- wilkinson-american-indians-time-and-the-law-1987
- wilkinson-blood-struggle-2005
- williams-american-indian-in-western-legal-thought-1990
- williams-linking-arms-together-1997
sources_updated:
- cherokee-nation-v-georgia
- worcester-v-georgia
limits: 'Most of the 32 standard works were confirmed in a catalog but not read; their annotations rest on catalog data and general knowledge, labeled as such. The quotation check is a text search: it confirms words, not context, and 95 quotations could not be machine-checked (no usable text, too short, or noisy scans). Pinpoints were checked only for Supreme Court cases in volumes the Library of Congress has scanned. Treaty page numbers in Kappler come from the treaty database''s addresses, checked against a page image for one treaty only. The territories material was gathered by a research helper; mirrors (Justia, FAOLEX, asbar.org) stand in for official code texts in places. The MacKenzie treatise was read from an EPUB without print pages and is current to about 2014. No KeyCite checks were run in this session.'
---

## What was done

1. **Audit.** Listed every citation key in the three Foundations drafts and checked each against its record; checked 384 quotations against fetched texts and 92 Supreme Court pinpoints against the Library of Congress scans. Results: `research/reviews/2026-11-22-foundations-source-audit.md` and `research/reviews/2026-11-22-foundations-quote-check.json`.
2. **Standard works.** Verified 30 books in the Berkeley Law catalog or Open Library, plus Kappler (govinfo and Oklahoma State University records) and the MacKenzie treatise (EPUB metadata and Open Library). Wrote the annotated list `content/bibliographies/federal-indian-law-standard-works.md`. The five treatises already on file from Nov. 21 (Cohen 2024, Canby, Getches et al., Richland and Deer, Pommersheim 1995) are included; none had been cited in the drafts.
3. **Gaps.** Verified the Cherokee and Worcester decision dates from the Supreme Court Library's table. Added nine treaties' dispute clauses and five bad-men decisions; a Hawaiʻi section from the MacKenzie treatise and existing primary records; a territories section from new and existing records.
4. **Fixes.** Moved five citations to the right records, removed internal file references from the essays, and brought the comparison essay's compact counts up to date.
5. **Plan.** `research/analyses/2026-11-22-foundations-part-plan.md` sets out the two Gate 1 chapters without findings.

## Reconciliation

- Before adding a record, the existing keys were searched. Hawaiʻi and territorial primary records from the Nov. 21 Hawaiian and territorial session were reused (`apology-resolution-1993`, `hawaii-constitution`, `hawaii-admission-act-1959`, `hawaiian-homes-commission-act-1920`, `cfr-43-part-50`, `interior-native-hawaiian-final-rule-2016`, `hawaii-revised-statutes-10h-1`, `cnmi-covenant`, `guam-code-21-chapter-75`, `asca-title-3-judiciary-land-titles-village-courts`, `asca-43-0302-certificate-irreconcilable-dispute`, `cmc-8-2904-carolinian-custom-family-land`). The five treatises from Nov. 21 were reused, not duplicated.
- The 1942 Cohen Handbook gets its own key (`cohen-handbook-of-federal-indian-law-1942`), separate from the 2024 edition (`cohens-handbook-of-federal-indian-law-2024`).
- The research helpers' notes and downloads stay in the session's scratch folder; their verified facts are in the records' notes.

## Follow-ups

On the pull list: KeyCite for the remaining digest cases and the cases added here; library copies of Cohen 2024 and Deloria and Lytle 1983; clean page images for the NCAI guide and the noisy Statutes at Large passages; the CNMI Constitution text; print pages for the MacKenzie treatise.
