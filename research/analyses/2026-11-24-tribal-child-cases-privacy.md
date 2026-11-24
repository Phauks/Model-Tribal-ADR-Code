# Children, families and protection orders in the hosted Tribal court opinions

**Status:** research spike, written Nov. 24, 2026, at Trevor's request ("do a spike for child related ones"). Nothing published was changed. Nothing here is legal advice. Numbers in brackets point to the Sources list in section 7. Statements marked "project analysis" are my reading, not a source's words.

This note names no child, parent or protected person. The per-opinion list, with the quotes the classification rests on, is kept privately in the project files at `research/tribal-court-opinions/privacy-review-2026-11-24.csv`, because a public list of children's names next to the words "juvenile" or "child welfare" would itself be the harm (project analysis, following a point raised by the thread "Let nations restrict their laws and cases").

## 1. Short answer

Of the 2,368 Tribal court opinions the site shows from the Caselaw Access Project (decision record 0047), **477 involve a child, a protection order or a vulnerable adult** in some real way. In **at least 88 of them a child's first and last name appears**, and in 14 more a child is named by first name or family surname alone. In **25 of the 34 protection order opinions the protected person is named in full**. The parents of a child are named in full in 321 of the 477, which identifies the child even where the court used initials (section 3).

Three of the nations whose opinions are hosted bar publishing these names in their own law. The Fort Peck Tribes' code says "[t]he names of any youth involved shall not be published" in youth offender, dependency and adoption cases [1]. The Navajo Nation's Children's Code admits the news media to closed hearings only if they refrain from "divulging information that would identify any child involved in the proceedings or the parent or guardian of that child" [2]. The Ho-Chunk Nation withholds "[r]ecords in children cases" from public inspection [3]. Fort Peck and the Navajo Nation account for 327 of the 477 opinions. Federal law bars Native nations, states and territories from posting protection order information online when it "would be likely to publicly reveal the identity or location of the party protected" [4].

**Proposed handling** (section 5): replace the names of children with initials in every hosted opinion, and also the parents' names in juvenile, child welfare, adoption and guardianship cases; replace a protected person's name with initials and remove where they live; and hide the 46 worst cases (named children in juvenile, child welfare, adoption or guardianship cases, and protection orders that name the protected person) until the redacted pages are built. A nation's own choice can make this stricter, never looser without review. About 165 opinions need name edits now and 312 more need a full read for names the classification missed.

## 2. How the opinions were found

1. **Script pass.** `extract.py` and `pass1.py` (kept with the spike's working files, not in the repository) read every opinion in the 21 Caselaw Access Project volumes and counted words for nine kinds of matter: juvenile, Indian Child Welfare Act, dependency and neglect, custody, adoption, guardianship, paternity and child support, protection orders and domestic violence, and vulnerable adults. Opinions with a hit in the caption, two or more hits in the text, or one hit and a family-style caption ("In re", "Marriage of", "ex rel.", or the same surname on both sides) became candidates: 586.
2. **Second sweep.** A narrower pattern ("minor", "juvenile", "parental rights", "protection order", "restraining order", "domestic violence", "sexual abuse" and similar) over the other 1,782 opinions found 152 more, so 738 were classified in all.
3. **Classification.** Fourteen Haiku subagents read 49 to 76 candidates each: the caption, parties, docket number, the opening of the opinion and up to ten passages around the trigger words. For each they recorded the kind of proceeding, whether the Indian Child Welfare Act is involved, how any child is identified, whether a parent is named, how any protected person is identified, a supporting quote and a confidence level.
4. **Checks** (top model, by script and by reading):
   - 734 of the 738 supporting quotes appear verbatim in the opinion; the other four differ only in spacing or punctuation.
   - I read a random sample of 10 opinions marked "not sensitive" and 8 marked "names a child in full". All 10 were correctly not sensitive. Seven of the 8 do name a child in full; the eighth is a criminal case against a 17-year-old, correctly a juvenile matter, whose name I did not confirm in the excerpt.
   - A script looked for a capitalized name next to "the minor", "the child", "son", "daughter", "on behalf of" and "ex rel." in the 389 sensitive opinions the subagents did not mark as naming a child in full. It flagged 44; I read each passage. Four named a child the subagent missed and were corrected; the other 40 named a parent, an adult child, a lawyer or an advocate.

So the counts of named children are a floor, not an exact number. The excerpts the subagents saw were partial, and a name deep in an opinion can be missed. The build step in section 6 reads each opinion in full.

## 3. What was found

### 3a. By kind of proceeding

| Kind (main issue the opinion decides) | Opinions | Child named in full | Child by initials or pseudonym | Parent named in full |
| --- | ---: | ---: | ---: | ---: |
| Custody and visitation | 113 | 14 | 56 | 104 |
| Other cases that mention a child (enrollment, per capita, probate, torts, employment) | 111 | 42 | 19 | 85 |
| Paternity and child support | 77 | 9 | 4 | 77 |
| Child welfare: dependency, neglect, termination of parental rights, Indian Child Welfare Act transfers | 47 | 4 | 34 | 21 |
| Juvenile delinquency | 38 | 8 | 30 | 5 |
| Protection orders and domestic violence | 34 | 1 | 2 | 10 |
| Criminal cases with a child victim | 21 | 1 | 3 | 4 |
| Adoption | 14 | 3 | 9 | 8 |
| Guardianship of a minor | 11 | 5 | 6 | 5 |
| Vulnerable adults and civil commitment | 11 | 1 | 0 | 2 |
| **Total** | **477** | **88** | **163** | **321** |

Fourteen more opinions name a child by first name or family surname only. Twenty opinions discuss the Indian Child Welfare Act or the transfer of a state child custody case to a Tribal court.

In 25 of the 34 protection order opinions the protected person is named in full; in 2 by initials; in 7 not at all. Sixteen opinions of other kinds (custody, criminal and others) name a domestic violence victim in full.

The courts were not consistent. Many juvenile and child welfare opinions use initials (30 of 38 delinquency opinions, 34 of 47 child welfare opinions), and the Grand Ronde courts used pseudonyms in some child welfare cases [5]. But the same courts often named the parents in full, and some captions spell out a child's full name with "a Minor" after it. Grand Ronde enrollment and per capita appeals brought on behalf of minors account for 9 of the 42 "other" opinions that name a child, most with the child's full name in the caption followed by "Minor" (read directly).

### 3b. By nation

| Nation (court) | Sensitive opinions | Child named in full |
| --- | ---: | ---: |
| Navajo Nation | 201 | 39 |
| Assiniboine and Sioux Tribes of the Fort Peck Indian Reservation | 126 | 16 |
| Ho-Chunk Nation | 28 | 6 |
| Hopi Tribe | 24 | 4 |
| Confederated Tribes of the Grand Ronde Community | 18 | 9 |
| Mohegan Tribe | 15 | 2 |
| Confederated Tribes of the Colville Reservation | 14 | 1 |
| Tulalip Tribes | 12 | 2 |
| Cheyenne River Sioux Tribe | 9 | 3 |
| Confederated Salish and Kootenai Tribes | 9 | 2 |
| Eastern Band of Cherokee Indians | 5 | 1 |
| Little Traverse Bay Bands of Odawa Indians | 5 | 2 |
| Cherokee Nation | 3 | 0 |
| Grand Traverse Band of Ottawa and Chippewa Indians | 2 | 0 |
| Leech Lake Band of Ojibwe | 1 | 1 |
| Fort McDowell Yavapai Nation, Oneida Nation, Sac and Fox Nation, Swinomish Indian Tribal Community, Eastern Shoshone Tribe and Northern Arapaho Tribe (one shared opinion) | 1 each | 0 |

The Navajo Nation's 201 break down as 50 other cases mentioning a child, 46 paternity and support, 38 custody, 18 protection orders, 17 juvenile, 9 criminal cases with a child victim, 7 adoption, 6 guardianship, 6 child welfare and 4 vulnerable adults. Fort Peck's 126 are mostly custody (52), child welfare (17), paternity and support (16) and juvenile (11).

### 3c. Other personal details

A rough script count over all 2,368 opinions found tribal enrollment or census numbers in 53, dates of birth in 44 and street addresses or post office boxes in 81 (some of those are lawyers' offices). Most are in Ho-Chunk Nation opinions, whose findings of fact list each party's tribal ID number and home address. No Social Security numbers were found. These are not limited to child cases and are a separate question (section 5, last point).

### 3d. Where the names show on the site

- Each opinion page (`/copies/caselaw-access-project/…`) prints the full caption and the full text.
- The short caption (the Caselaw Access Project's `name_abbreviation`) appears in nation pages' opinion lists, the `/nations/<id>/opinions` table and the `/copies` list. It is stored in `research/tribal-court-opinions/opinions.csv` and in the `title` column of `research/capture-index.csv`, both in git. Short captions usually carry only the family surname ("In re the Custody of [Surname]"); about 28 of the opinions that name a child in full have a short caption built on the child's family surname.
- The workspace Source library (decision record 0051) holds the full text, but only signed-in editors can search it.

The same texts are public at static.case.law and on CourtListener, so the site is not the only copy. It is the copy the project controls, and it presents the opinions as part of a nation's page, which is why the nations' own rules matter here (project analysis).

## 4. What the law says

- **Fort Peck Tribes.** In youth offender proceedings, "[t]he names of any youth involved shall not be published" (9 CCOJ § 309(b)); the same words govern abused, neglected and dependent youth proceedings (9 CCOJ § 507(b)) and adoption hearings that involve children (10 CCOJ § 113(b)) [1]. Court records concerning youth are confidential and open only by court order to listed persons [1]. Read directly in the Fort Peck Tribal Court's compiled code of Feb. 7, 2025; the 1997 to 2017 opinions were decided under earlier versions, which I did not check.
- **Navajo Nation.** Dependency and child-in-need-of-supervision hearings "shall be closed to the general public," and the news media may attend only if they "refrain from divulging information that would identify any child involved in the proceedings or the parent or guardian of that child" (9 N.N.C. § 1115(B)) [2]. Delinquency hearings are open unless the court finds exceptional circumstances (§ 1115(B)) [2]. Adoption hearings are confidential and held in closed court (§ 613) [2]. A petitioner for a domestic abuse protection order need not reveal where they live except to the judge (§ 1658) [2]. Read directly in the copy of Title 9 posted by the U.S. District Court for Utah, dated Sept. 11, 2019; the Navajo Nation's Álchíní Bi Beehaz'áanii Act of 2011 revised the Children's Code, and I did not check whether the section numbers changed [6].
- **Ho-Chunk Nation.** "Records in children cases shall be withheld from public inspection," and all court records under the Children and Family Act "shall be confidential" and open only to listed persons (4 HCC § 3.4(a)–(b)) [3]. Read directly.
- **Penobscot Nation and Pawnee Nation.** No opinion from either is hosted, but both set the publication rule the project's earlier spike found: no names or identifying information in any opinion "involving children, adults in need of protection, or other confidential proceedings" (Penobscot § 5(D)(1)), and initials only in published juvenile appeal opinions (Pawnee tit. 2, § 112(a)) [7].
- **Federal law.** "A State, Indian tribe, or territory shall not make available publicly on the Internet any information regarding the registration, filing of a petition for, or issuance of a protection order ... if such publication would be likely to publicly reveal the identity or location of the party protected under such order." 18 U.S.C. § 2265(d)(3) [4]. It binds governments, not a private publisher, but it is the clearest benchmark for what the site should not show (project analysis, as in the earlier spike [7]).

The other hosted nations' codes were not checked. The nations with the most sensitive opinions after Fort Peck, Navajo and Ho-Chunk are the Hopi Tribe (24), Grand Ronde (18), Mohegan (15), Colville (14) and Tulalip (12).

## 5. Proposed handling policy (project analysis)

The default below applies to every hosted opinion, whatever the child's age today; none of the rules in section 4 lapses when the child grows up.

| Kind | Child | Parents and relatives | Protected person | Until redacted |
| --- | --- | --- | --- | --- |
| Juvenile, child welfare (including Indian Child Welfare Act), adoption, guardianship | Initials | Initials (Navajo § 1115(B) treats the parent's name as identifying the child) | Initials | Hidden if a child is named |
| Custody, paternity and child support | Initials | Keep (they are the litigants) unless the nation's law says otherwise | Initials, and remove where they live | Shown |
| Protection orders and domestic violence | Initials | Keep the respondent's name | Initials, and remove where they live (18 U.S.C. § 2265(d)(3)) | Hidden if the protected person is named |
| Criminal cases with a child victim | Initials for the victim | Keep the defendant | Initials | Shown |
| Vulnerable adults and civil commitment | Initials for the adult in question (Penobscot § 5(D)(1)) | Keep | n/a | Shown |
| Other cases that mention a child | Initials | Keep | n/a | Shown |

Further points:

1. **Captions too.** The page heading, the HTML title, the short caption in lists and the `title` in the capture index all use the redacted caption.
2. **Say so on the page.** Each redacted page states that names of children (or of a protected person) are replaced with initials, and drops its "Original" link to static.case.law, which would lead straight to the names. The citation stays, so a reader can still find the reported opinion.
3. **Nations decide more, not less.** A nation that has claimed its page can choose stricter handling (hide all its child cases, or all its opinions) through the restrictions the thread "Let nations restrict their laws and cases" is designing, where restrictions live in D1 and apply at once. This floor holds under any level a nation picks; loosening below initials would need a review by the project, since the child is not the one consenting. That thread agreed to treat "hide" here as its Hide level and "initials" as a transform that applies under any level.
4. **Do not rewrite git history.** The short captions already in `opinions.csv` and `research/capture-index.csv` stay in history; the files are corrected going forward. The repository's history policy is to keep it orderly, not to rewrite it, and the same text is public elsewhere (project analysis).
5. **Personal identifiers.** Tribal ID numbers, dates of birth and home addresses of private persons (section 3c) are worth the same pass in sensitive opinions and a separate decision for the rest.

## 6. How to build it

1. **Names map, kept private.** For each of the 165 opinions marked "hold until redacted" or "initials" in the private review list, and then the 312 marked "review", a model reads the full opinion and lists every name to replace (child, parent where the table says so, protected person, addresses) with its initials. A script checks that each listed name occurs in the text. The map lives in the private bucket or in D1 beside the nation restrictions, never in git. Git keeps at most `case_id`, kind and handling.
2. **Apply it in the build.** `scripts/caselaw/tribal_court_opinions.py` reads the map when it builds each page (`opinion_page`), replaces names in the caption, title and body, adds the notice, drops the "Original" link, and re-files the page under the same bucket key, which it already does for changed pages. It writes the redacted short caption to `opinions.csv` and the capture index.
3. **Hide until done.** Opinions marked "hold" are filed with `redistribution: no`, the switch the removal path already uses in `research/capture-index-overrides.json`, so every list drops them. They return when their redacted page is filed.
4. **Verify.** After filing, a script fetches each redacted page and fails if any mapped name, or any name the section 2 name check finds next to "minor" or "child", is still present. A person reads a sample from each nation before the pages return.
5. **Library.** The workspace Source library keeps the unredacted text for signed-in editors; if Source library results ever become public, they need the same map.

To keep the cost down, step 1 can use Haiku with the script check for recall, and the top model for the protection order, juvenile and child welfare pages and for spot checks.

## 7. Sources

Marked **read** when I read the passage myself on Nov. 24, 2026.

1. Fort Peck Tribes, Comprehensive Code of Justice tit. 9, §§ 309, 507 (Youth Code) and tit. 10, § 113 (Family Code), compiled Feb. 7, 2025, https://fptc.org/s/CCOJ-Complete-02-07-25protected-4kg3.pdf, linked from https://fptc.org/comprehensive-code-of-justice-ccoj/. **Read.**
2. Navajo Nation Code tit. 9, §§ 613, 1115, 1658, as posted by the U.S. District Court for the District of Utah (dated Sept. 11, 2019), https://www.utd.uscourts.gov/sites/utd/files/Title%209%20Navajo%20Nation%20Code.pdf. **Read.**
3. Ho-Chunk Nation Code tit. 4, § 3 (Children and Family Act), § 4(a)–(b), as amended Feb. 6, 2024, https://ho-chunknation.com/wp-content/uploads/2024/02/02.06.24-4HCC3-Children-and-Family-Act-adopted-by-02-06-24M.pdf. **Read.**
4. 18 U.S.C. § 2265(d)(3), https://www.govinfo.gov/link/uscode/18/2265?link-type=html. Quoted as read for the earlier spike [7].
5. *In re D.A.*, 12 Am. Tribal Law 362 (Confederated Tribes of the Grand Ronde Cmty. Ct. App. 2007), as described in the earlier spike [7].
6. Navajo Nation Judicial Branch, *Navajo Nation Álchíní Bi Beehaz'áanii Act of 2011*, https://courts.navajo-nsn.gov/?p=89527. Found in search; **not read.**
7. `research/analyses/2026-11-24-republishing-tribal-court-opinions.md` (PR #446), sections 3 and 6, for the Penobscot Tribal Law and Court Opinions Publication Law § 5(D) and the Pawnee Law and Order Code tit. 2, § 112(a).
8. The opinions themselves: Harvard Law School Library, Caselaw Access Project, American Tribal Law Reporter vols. 1–13 and Navajo Reporter vols. 1–8, https://static.case.law/ (downloaded Nov. 24, 2026), indexed in `research/tribal-court-opinions/opinions.csv`.
