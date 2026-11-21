---
id: 2026-11-21-hawaiian-and-territorial
date: '2026-11-21'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: page-fetch
  name: page fetch (curl)
- kind: page-fetch
  name: WebFetch
- kind: web-search
  name: web search
- kind: other
  name: pdftotext
- kind: other
  name: Federal Register API
- kind: other
  name: data.census.gov API
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: A research sub-agent searched, opened sources and returned cited facts in the raw file; the
    lead session reviewed the output and built the records.
purpose: Record the legal basis of the status of the Native Hawaiian community and of Indigenous peoples
  of U.S. territories, without Tribal status categories.
queries:
- https://www.law.cornell.edu/uscode/text/20/7512
- https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title20-section7512 (404)
- https://www.govinfo.gov/content/pkg/STATUTE-107/pdf/STATUTE-107-Pg1510.pdf
- https://www.govinfo.gov/content/pkg/STATUTE-73/pdf/STATUTE-73-Pg4.pdf
- https://www.govinfo.gov/content/pkg/STATUTE-42/pdf/STATUTE-42-Pg108.pdf
- 'federalregister.gov API: term ''Reestablishing a Formal Government-to-Government Relationship''; cfr
  title 43 part 50'
- https://www.govinfo.gov/content/pkg/FR-2016-10-14/pdf/2016-23720.pdf
- https://www.law.cornell.edu/cfr/text/43/part-50
- 'web search: Office of Native Hawaiian Relations 43 CFR part 50 no request submitted'
- 'web search: M-37083 Solicitor opinion Native Hawaiian withdrawn or suspended 2025'
- 'web search: December 2025 Office of Legal Counsel memorandum Native Hawaiian programs race'
- https://www.doi.gov/hawaiian, /mission, /contact-us, /NHOL, /nhonl, /procedures-reestablishing-...
- https://www.capitol.hawaii.gov/hrscurrent/.../HRS_0010H-0001.htm (403); Wayback (connection reset);
  data.capitol.hawaii.gov HRS_0010H-0001..0008 (200)
- https://lrb.hawaii.gov/constitution
- https://www.oha.org/contact/ (curl 403; WebFetch ok)
- https://dhhl.hawaii.gov/contact/
- api.census.gov/data/2020/dec/ddhca (missing key); data.census.gov api for DECENNIALDDHCA2020.T01001
  (population-group parameter not accepted)
- https://www.census.gov/library/stories/2023/09/2020-census-dhc-a-nhpi-population.html
- https://files.hawaii.gov/dbedt/census/census_2020/data/reports/Native_Hawaiian_Population_in_Hawaii_in_2020.pdf
- 'census.gov press releases 2022: 2020-island-areas-guam, -northern-mariana, -american-samoa'
- 'data.census.gov api: DECENNIALDPMP2020.DP1, DECENNIALDPGU2020.DP1, DECENNIALDPAS2020.DP1'
- https://cnmilaw.gov/constitution; https://cnmilaw.gov/covenant
- 'web search: CNMI Indigenous Affairs Office / Carolinian Affairs Office Refaluwasch'
- opd.gov.mp citizen-centric reports (IAO 2019, CAO 2021); opa.cnmi.gov FY2025 (404); opacnmi.com (TLS
  name mismatch)
- 'web search: Guam Public Law CHamoru spelling; ''CHamoru Heritage Act of 2016'' Public Law 33'
- statecodesfiles.justia.com Guam 5 GCA ch 88 (2019), 21 GCA ch 75 (2021), 1 GCA ch 21 (2019); guamcourts.gov
  copies (404); guamlegislature.com (403)
- https://kumisionchamoru.guam.gov
- https://www.justice.gov/crt/case-document/davis-v-guam-court-appeals-decision
- https://paclii.org/as/legis/consol_act/rcoas361 (WebFetch); asbar.org (403); americansamoa.gov 2022
  Constitutional Review Committee report (proposed text, not used for current law)
- https://faolex.fao.org/docs/pdf/ams51552.pdf
- https://iso639-3.sil.org/code/haw, cha, cal, smo
sources_added:
- american-samoa-code-37-0204
- american-samoa-revised-constitution
- apology-resolution-1993
- census-2020-cnmi-demographic-profile-dp1
- census-2020-detailed-dhc-a-nhpi-story
- census-2020-island-areas-american-samoa-profile-release
- census-2020-island-areas-cnmi-profile-release
- census-2020-island-areas-guam-profile-release
- cfr-43-part-50
- cnmi-carolinian-affairs-office-report-2021
- cnmi-constitution
- cnmi-covenant
- cnmi-indigenous-affairs-office-report-2019
- department-of-hawaiian-home-lands-contact
- guam-code-1-chapter-21
- guam-code-21-chapter-75
- guam-code-5-chapter-88
- hawaii-admission-act-1959
- hawaii-constitution
- hawaii-dbedt-native-hawaiian-population-2020
- hawaii-revised-statutes-10h-1
- hawaii-revised-statutes-10h-3
- hawaii-revised-statutes-10h-8
- hawaiian-homes-commission-act-1920
- interior-native-hawaiian-final-rule-2016
- interior-native-hawaiian-organization-notification-list
- interior-onhr-contact
- interior-onhr-mission
- interior-solicitor-opinion-m-37083
- justice-olc-race-based-education-programs-2025
- kumision-i-fino-chamoru-website
- office-of-hawaiian-affairs-contact
- us-code-20-7512-native-hawaiian-education-findings
limits: 'Not checked or not verified: (1) uscode.house.gov section page (404), so 20 U.S.C. § 7512 was
  read on LII; (2) capitol.hawaii.gov blocked plain requests and the Wayback route reset, so HRS chapter
  10H was read on the legislature''s data.capitol.hawaii.gov host; (3) Census API requires a key here,
  so national Native Hawaiian counts come from the Census Bureau article and Hawaii counts from the state
  data center report, not from a direct table pull; (4) Guam code text comes from Justia reproductions
  (2019/2021 compiler revisions) because guamcourts.gov and guamlegislature.com returned 404/403, so Guam
  statute facts are medium confidence and later amendments (for example 21 G.C.A. ch. 75A, any 2019-2026
  changes to 1 G.C.A. ch. 21) were not reviewed; P.L. 33-236''s own text was not opened, only the compiler''s
  note on it; (5) American Samoa constitution read on PacLII through WebFetch (consolidation date not
  stated) and the land code through FAOLEX; no official American Samoa Office of Samoan Affairs page was
  found, so no Samoan Affairs agency fact was recorded; (6) no Guam statute declaring Chamorro an official
  language was located, and Guam agency contacts other than the language commission website were not collected;
  (7) CNMI office contacts come from FY2019/FY2021 reports and the Carolinian Affairs Office website was
  not opened; (8) Hawaiian Homes Commission''s current statutory placement within the Department of Hawaiian
  Home Lands (Haw. Rev. Stat. § 26-17) was not opened; (9) whether the Native Hawaiian roll commission
  has been dissolved was not checked. Schema notes for the lead: population kinds used here are new values
  (census-native-hawaiian-alone, census-native-hawaiian-alone-or-in-any-combination, census-chamorro-alone,
  census-chamorro-alone-or-in-any-combination, census-carolinian-alone, census-samoan-alone, census-samoan-alone-or-in-any-combination);
  population geography (United States versus Hawaii, Guam, CNMI, American Samoa) is in the locator. The
  2016 rule is recorded under governing-document (kind other) and the absence of a reestablished government
  under government-structure (kind other), because the contract has no closer field. Related-entity relations
  federal-agency, territorial-agency, state-commission and federal-consultation-list are new relation
  strings. Source kind ''other'' is used for state and territorial constitutions, territorial codes and
  a court opinion. Recognition facts for territories carry the territory code in ''state''. Agency contacts
  are attached to the people''s record with the agency named in ''label''.'
---

## What was done

Congress describes Native Hawaiians as 'a distinct and unique indigenous people' with whom the United States has a trust relationship, and says services are extended not because of race but because of that status (us-code-20-7512-native-hawaiian-education-findings; apology-resolution-1993). The Department of the Interior's 2016 rule nonetheless states that Native Hawaiians would not be added to the federally recognized tribes list, because Congress provides a separate set of Native Hawaiian programs, and it only sets a procedure the Secretary would use if the community forms a single government (interior-native-hawaiian-final-rule-2016). No such government exists: the Interior Solicitor reported in January 2025 that no request had been received (interior-solicitor-opinion-m-37083), an opinion now under suspension review (interior-m-opinions-index-2026-05), and the Justice Department's Office of Legal Counsel wrote in December 2025 that no Native Hawaiian political entity has formal federal recognition and that the constitutional status of Native Hawaiian preferences is unresolved (justice-olc-race-based-education-programs-2025). Hawaii law separately recognizes Native Hawaiians as 'the only indigenous, aboriginal, maoli people of Hawaii' and protects traditional and customary rights through the Office of Hawaiian Affairs and art. XII § 7, which are state-law statuses, not tribal recognition (hawaii-revised-statutes-10h-1; hawaii-constitution). In the territories, Indigenous status rests on territorial constitutions and codes tied to land and descent: CNMI's 'persons of Northern Marianas descent' under the Covenant (cnmi-constitution; cnmi-covenant), Guam's 'Native Chamorro' land-trust beneficiaries and 'Native Inhabitants of Guam' (guam-code-21-chapter-75; guam-code-1-chapter-21), and American Samoa's protection of lands, custom and the matai system for persons of Samoan ancestry (american-samoa-revised-constitution). None of these is a federal acknowledgment of a tribe, and federal courts have struck down some descent-based voting limits built on them (davis-v-guam-2019), so each record should cite its exact provision rather than a tribal status category.

## Output

`research/raw/2026-11-21/hawaiian-and-territorial.json`: 78 facts about 4 nations or communities from 40 sources. What the build kept and dropped is in `research/raw/2026-11-21/build-report.json`.
