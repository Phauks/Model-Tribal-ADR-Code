# Linking each nation to its language resources

**Status:** research study, written Nov. 27, 2026, in answer to Trevor's question "are there organizations or centralized languages things we can link to relating to the langauges for the tribes?" (project thread "Link each nation to its language resources", Nov. 27, 2026). Nothing here is built. Building waits for Trevor's pick of an approach and, after that, an approved mockup.

**Method.** Counts marked "counted" were computed on Nov. 27, 2026, from the nation records in `content/tribes/` (946 records, 581 of them marked federally recognized) or read from the outside source that day. Wikidata counts come from its public query service; Glottolog counts from its per-language JSON (`https://glottolog.org/resource/languoid/iso/<code>.json`) for each language code our records hold; grant counts from the USAspending.gov search API. The nation-website sample is 80 federally recognized nations drawn at random (seed 7) from the 514 whose records list a website; each home page was fetched once and searched for links whose address or text names a language, an immersion school or a language program, and every hit was read by hand. The sample and the grant recipient list are in `research/language-resources/`. Figures marked "project estimate" are the project's judgment from those counts, and the basis is given beside each one.

## 1. Short answer

Yes. There is no single official registry of Native language programs in the United States, but four kinds of sources together cover most of what a nation page needs:

1. **The nation's own language program**, which is the best link under the CARE principles (Global Indigenous Data Alliance, *CARE Principles for Indigenous Data Governance*, https://www.gida-global.org/care) and the project's rule that nations are the authority on themselves. About a third of nations' home pages link one (section 4).
2. **Language-level reference catalogs with stable identifiers and open terms:** the ISO 639-3 code pages at SIL International, the registration authority; Glottolog (Creative Commons Attribution 4.0); and the Endangered Languages Project. These describe a *language*, not a nation, so they belong on a language page that many nations share.
3. **Regional Native-run centers**, chiefly the Alaska Native Language Center at the University of Alaska Fairbanks, which has one page for each of the 20 Alaska Native languages that Alaska made official in 2014 (Act of Apr. 21, 2014, ch. 116, 2014 Alaska Sess. Laws (amending Alaska Stat. § 44.12.310), https://www.akleg.gov/pdf/billfiles/SLAs/sl14pdfs/CH116.pdf).
4. **Federal records of language grants**, from the Administration for Native Americans' language program (Assistance Listing 93.587), which show which nations have run a federally funded language project and lead to programs not yet found.

Ethnologue is not a usable link target: it has been a paid subscription service since 2015 (Ethnologue, *Ethnologue Launches Subscription Service*, https://www.ethnologue.com/ethnoblog/ethnologue-launches-subscription-service/; *Subscription Plans & Pricing*, https://www.ethnologue.com/pricing), and both pages refused our fetcher (403, a Cloudflare check). The ISO 639-3 codes Ethnologue uses are free at SIL's registration authority site, so nothing is lost.

## 2. What the site already holds

The nation record schema has a `languages` list of cited facts, each with a `name` and an optional `language_tag` (`schemas/tribe.schema.json`). Nation pages show it as the "Heritage languages" row of At a glance, as plain names with citation marks (`site/src/routes/nations/[id]/+page.server.ts`, `atAGlance`). No row links anywhere today.

Counted on Nov. 27, 2026:

| Measure | Count |
| --- | --- |
| Nation records naming at least one language | 352 of 946 |
| Records with a language tag | 344 |
| Distinct language tags | 115 |
| Federally recognized records naming a language | 348 of 581 |
| Federally recognized records with no language yet | 233 |
| Records whose language fact comes from the Alaska Division of Community and Regional Affairs place-name layer | 212 |
| Records whose language fact already cites a page of the nation's own about language or culture (address or title names language, culture, heritage or education) | 58 |

Three tags are two-letter codes (`ch` Chamorro, `oj` Ojibwe, `sm` Samoan). That is correct BCP 47, which requires the two-letter ISO 639-1 code where one exists (Internet Engineering Task Force, *Tags for Identifying Languages*, RFC 5646 § 2.2.1 (2009), https://www.rfc-editor.org/rfc/rfc5646), so any crosswalk must map them to `cha`, `oji` and `smo` rather than change the records. `oji` is a macrolanguage, which Glottolog files as a family, not a language.

## 3. The candidate sources

| Source | What one link shows | Identifier | Terms | Reachable by script (Nov. 27) | Matches our 115 tags (counted) |
| --- | --- | --- | --- | --- | --- |
| Nation's own language program | The nation's classes, immersion school, dictionary or department | The page address | The nation's own | Varies by nation (70 of 80 sampled home pages answered) | Not by tag; by nation (section 4) |
| ISO 639-3 at SIL International | The code, reference name, scope and type, with change history | Three-letter code, e.g. `chr` at https://iso639-3.sil.org/code/chr | Free use with attribution to iso639-3.sil.org; the code set may not be redistributed as a set | Yes (200) | 115 of 115 (after the three two-letter mappings) |
| Glottolog 5.4 | Classification, dialects, location, and a bibliography of grammars and dictionaries | Glottocode, e.g. `cher1273` | Creative Commons Attribution 4.0 (Glottolog home page footer, https://glottolog.org/) | Yes (200, JSON per language) | 114 of 115 (`oji` only as a family) |
| Endangered Languages Project | Vitality, speaker figures and community-posted resources | Number, e.g. https://endangeredlanguages.com/elp-language/1684 | Its own terms of service (https://endangeredlanguages.com/tos); not read, the site refused our fetcher (403) | No (403); IDs come through Glottolog and Wikidata | 95 through Glottolog's links; 92 through Wikidata |
| Alaska Native Language Center | One page per Alaska Native language, with its archive (the Alaska Native Language Archive) | Page address, e.g. https://www.uaf.edu/anlc/languages-move/ahtna.php | University of Alaska Fairbanks | Yes (200); 20 language pages counted on https://www.uaf.edu/anlc/languages-move/languages.php | The 20 Alaska languages, which reach 203 of 225 Alaska records |
| Administration for Native Americans grants (Assistance Listing 93.587) | Who received a language grant, when and for how much | Award number on USAspending.gov | Federal records, public domain | Yes (USAspending API 200) | Not by tag; 347 recipients, FY2009 to FY2026 (counted) |
| Wikidata | A crosswalk among the identifiers above | Q number, e.g. Q33388 | CC0 (project knowledge of Wikidata's licensing) | Yes (query service 200) | 112 of 115 items carry the ISO code (the three two-letter tags need mapping) |
| OLAC, the Open Language Archives Community | Archive holdings for a language across member archives | ISO code, e.g. https://www.language-archives.org/language/chr | Catalog metadata | No: the site now answers scripts with a University of Cologne bot check (418) | Not counted |
| Ethnologue | Language profile | ISO code | Paid subscription | No (403) | Not counted |

**Wikidata cannot match languages to nations.** Its class for federally recognized tribes (Q7840353) has 573 items, but only 4 carry "language used" (P2936), and only 7 are named by a language item's "indigenous to" (P2341) (counted). It is useful only as a crosswalk among language identifiers, which Glottolog's JSON already gives (each Glottolog language lists its Wikidata item and Endangered Languages Project page).

**Federal policy sources** belong in the Library rather than on nation pages, but the language pages could cite them: the Native American Languages Act (25 U.S.C. §§ 2901-2907); the Durbin Feeling Native American Languages Act of 2022, Pub. L. No. 117-337, 136 Stat. 6153 (2023), https://www.govinfo.gov/content/pkg/PLAW-117publ337/html/PLAW-117publ337.htm, which directs the Administration for Native Americans to survey the use of all Native American languages every five years, in consultation with nations, and to make the results public (25 U.S.C. § 2907(a), (c), (h)); and the *10-Year National Plan on Native Language Revitalization* (Dec. 2024), https://www.bia.gov/sites/default/files/media_document/final_12032024_10-year_national_plan_on_native_language_revitalization.508.pdf. I could not confirm that the survey's results have been published; the Administration for Native Americans' page on the Act (https://acf.gov/ana/priorities/language/durbin-feeling) returned no content to our fetcher. If the results come out with nation-level program lists, they would become the best central source and should be checked first.

## 4. How many nations could be matched

**Language-level links (catalogs).** All 344 records with a tag could link, through a shared language page, to ISO 639-3 (115 of 115 tags) and Glottolog (114 of 115). 95 tags reach an Endangered Languages Project page. 203 of the 225 Alaska records reach an Alaska Native Language Center page. This needs only a script and a one-time crosswalk file. (Counted.)

**Nation-level links (the nation's own program).** Of the 80 sampled federally recognized nations, 70 home pages answered. 20 of the 70 link a language program, language department, immersion school or language page that the nation runs (29 percent): 18 of 52 outside Alaska (35 percent) and 2 of 18 in Alaska (11 percent). Three more hits were false and were dropped: one record's old address now serves an unrelated gambling site (the record already marks that link `lapsed`), one was a job-board link, and one was the North Slope Borough's department rather than the village's. (Counted.)

Applying those rates to the 514 federally recognized nations with a website gives about 140 nations found from home pages alone (project estimate: 352 outside Alaska × 35 percent ≈ 123, plus 162 in Alaska × 11 percent ≈ 18). Home pages undercount, because many programs sit one level down under Culture, Education or Departments; a crawl of each site's menu and sitemap should raise the total. Adding the 58 records that already cite such a page, the project estimates **180 to 250 nations with a link to their own program**, with the rest shown as "None Identified".

**Grant leads.** A first name match of the 347 grant recipients to our records matched 171 nation records (project's rough fuzzy match; it already shows errors, such as Pauma matched to Pala, and misses plain ones such as the Yurok Tribe and the Crow Tribe, so every match needs review). 60 of those 171 have no language recorded yet, which makes the grants the best lead list for the 233 federally recognized records with no language. The other recipients are schools, tribal colleges and nonprofits (for example the Waadookodaading Ojibwe Language Institute and Sealaska Heritage Institute), many of which are Native-run programs that a nation may name as its own.

**Alaska.** Most Alaska villages do not run a separate program; language work is often carried by regional Native organizations that also appear among the grant recipients (Doyon Foundation, Sealaska Heritage Institute, Central Council of the Tlingit and Haida Indian Tribes of Alaska, Chugachmiut, Aleutian Pribilof Islands Association). For a village without its own page, the Alaska Native Language Center page for its language is the fallback, labeled as a language center, which fits the service-link rule's directory fallback.

## 5. Recommended approach

**A. A shared language page for each language, plus a language program row on each nation page.** This is the recommendation.

1. Add a small registry, `content/languages/<code>.yaml`, one file for each of the 115 tags, holding the ISO 639-3 code, Glottocode, Endangered Languages Project number, Alaska Native Language Center address where one exists, and the nations whose records name it. A script builds it from Glottolog's JSON and the ISO 639-3 code table, with attribution to iso639-3.sil.org and Glottolog as their terms require. We store identifiers and links, not the code set or Glottolog's text.
2. Add a `language_programs` list of cited facts to the nation record (`name`, `link`, `run_by`: the nation, a tribal college, or an organization the nation names). Every entry needs a link, as every service on a nation page does (project rule, Nov. 22, 2026).
3. Fill it in three passes, cheapest first: a script lifts the 58 pages already cited; a script crawls each nation's website (home page, menu and sitemap) for language links; Haiku subagents check each candidate page against the rule that the nation runs or names the program, with a top-model spot check. The grant list feeds a hand search for the nations still empty.
4. A language page on the site (for example `/languages/chr`) lists every nation that names the language, with each nation's own program first, then the reference links: ISO 639-3, Glottolog, the Endangered Languages Project and, for Alaska, the Language Center. That puts the true source first, as the site already does for "Where to read it" (Trevor, Nov. 27, 2026), and fits the site's goal of being a central repository: the 74 nations naming Central Yupik, for example, share one page.

**B. Outside links straight on the nation page, with no language pages.** Cheaper to build, but it repeats the same three catalog links on hundreds of pages and puts outside catalogs beside the nation's own program on equal footing.

**C. Park it** in the roadmap's Parked research table until the data loading is done, as the dataset gap audit was.

## 6. Where the link sits on nation pages

Both stay in At a glance as label rows with no bullets (project rule, PR #391):

| Label | Value |
| --- | --- |
| Heritage languages | Cherokee (the name links to the site's Cherokee language page) |
| Language program | Cherokee Language Program (links to the nation's own page; a second program goes on the same row, separated by a comma, as "Self-governance" does today) |

When a nation has no program on record, the "Language program" row reads "None Identified" (project rule, Nov. 24, 2026). For an Alaska village with no page of its own, the row reads the language center's name and links to its page for the language, marked as a language center. The "Own name" line under the title already names the language from the nation's own record (PR #495) and would not change.

This is a description, not a design. A mockup comes after Trevor picks, and the built page must match it.

## 7. CARE and restricted material

The approach links; it never copies language material. Three guards follow from the CARE principles' authority-to-control and ethics principles (Global Indigenous Data Alliance, above):

1. The nation's own program is always listed first, and a third-party organization is listed as a nation's program only when the nation itself names or runs it.
2. The site does not serve or quote word lists, recordings, dictionaries or stories in Native languages, even where an archive makes them public, unless the nation provides them. Some nations limit who may record or write their languages, which is a choice for the nation, not for us (project basis: the CARE authority-to-control principle; no nation's policy was surveyed for this note).
3. Archive catalogs (the Alaska Native Language Archive and OLAC) lead to recordings gathered over a century, not all with consent. Linking them from nation pages should wait for the Indigenous advisory council (`docs/indigenous-advisory-council.md`). On the shared language page they are lower risk, but the project recommends the same wait.

The Endangered Languages Project lets contributors post resources to its language pages (project knowledge of the site; its terms could not be read from the cloud), so what a reader finds there is not always the nation's. It belongs on the language page as a reference, never in the nation's "Language program" row.

## 8. Next steps if Trevor picks A

1. Mockup of the nation-page rows and a language page, for approval.
2. Crosswalk script for the 115 languages (Glottolog JSON, ISO 639-3 table); one pull request.
3. `language_programs` field, the lift of the 58 cited pages, and the website crawl, with Haiku checks; one pull request per pass.
4. Grant records as a federal data set (USAspending, Assistance Listing 93.587), with reviewed nation matches, which can also show on nation pages as federal language grants.

## References

Act of Apr. 21, 2014, ch. 116, 2014 Alaska Sess. Laws (amending Alaska Stat. § 44.12.310), https://www.akleg.gov/pdf/billfiles/SLAs/sl14pdfs/CH116.pdf (read Nov. 27, 2026).

Alaska Native Language Center, *Alaska Native Languages*, University of Alaska Fairbanks, https://www.uaf.edu/anlc/languages-move/languages.php (read Nov. 27, 2026); Alaska Native Language Archive, https://www.uaf.edu/anla/.

Bureau of Indian Affairs et al., *10-Year National Plan on Native Language Revitalization* (Dec. 2024), https://www.bia.gov/sites/default/files/media_document/final_12032024_10-year_national_plan_on_native_language_revitalization.508.pdf (not read in full for this note).

Durbin Feeling Native American Languages Act of 2022, Pub. L. No. 117-337, 136 Stat. 6153 (2023), https://www.govinfo.gov/content/pkg/PLAW-117publ337/html/PLAW-117publ337.htm (read Nov. 27, 2026).

Endangered Languages Project, *Terms of Service*, https://endangeredlanguages.com/tos (refused our fetcher, 403); Catalogue of Endangered Languages (ELCat) database, University of Hawaiʻi at Mānoa ScholarSpace, https://scholarspace.manoa.hawaii.edu/items/50a71064-24ac-41fb-8a58-115f9e8b4007/full.

Ethnologue, *Ethnologue Launches Subscription Service*, https://www.ethnologue.com/ethnoblog/ethnologue-launches-subscription-service/, and *Subscription Plans & Pricing*, https://www.ethnologue.com/pricing (both refused our fetcher, 403; cited from search results).

Global Indigenous Data Alliance, *CARE Principles for Indigenous Data Governance*, https://www.gida-global.org/care.

Glottolog 5.4 (Harald Hammarström, Robert Forkel, Martin Haspelmath & Sebastian Bank eds.), Creative Commons Attribution 4.0, https://glottolog.org/ (read Nov. 27, 2026).

Internet Engineering Task Force, *Tags for Identifying Languages*, RFC 5646 (2009), https://www.rfc-editor.org/rfc/rfc5646.

Office of Management and Budget, Federal Program Inventory, *93.587 Promote the Survival and Continuing Vitality of Native American Languages*, https://fpi.omb.gov/program/93.587.html; Department of Health and Human Services, TAGGS, *Assistance Listing 93.587*, https://taggs.hhs.gov/Detail/CFDADetail?arg_CFDA_NUM=93587.

OLAC: the Open Language Archives Community, https://www.language-archives.org/ (answered our fetcher with a bot check, 418).

SIL International, *ISO 639-3 Downloads* (terms of use), https://iso639-3.sil.org/code_tables/download_tables (read Nov. 27, 2026).

USAspending.gov, spending by recipient for Assistance Listing 93.587, grants (award types 02-05), Oct. 1, 2008 to Sept. 30, 2026, https://api.usaspending.gov/api/v2/search/spending_by_category/recipient/ (queried Nov. 27, 2026).

Wikidata Query Service, https://query.wikidata.org/ (queried Nov. 27, 2026: properties P220, P1394, P2192, P2341, P2936; class Q7840353).
