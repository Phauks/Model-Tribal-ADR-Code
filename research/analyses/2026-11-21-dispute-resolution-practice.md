# Documented dispute resolution practice: provisional analysis

**Status:** provisional, written Nov. 21, 2026. It describes the Native nation
profiles merged in pull request #2 before the lead author, Trevor Goldsmith,
has reviewed that data. Nothing here is a finding about any nation's law or
practice. It describes what the project's sources document, flags where the
data is weak, and lists patterns to test once the data is reviewed. Every
count comes from
[`scripts/analysis/dispute_resolution_practice.py`](../../scripts/analysis/dispute_resolution_practice.py),
whose output is
[`2026-11-21-dispute-resolution-practice.json`](2026-11-21-dispute-resolution-practice.json).
Counts, groupings and interpretations are project analysis unless a footnote
cites a source.

Following the charter, peacemaking is discussed as its own track, not as a form
of alternative dispute resolution.[^charter-3][^narf-ipi-home]

## Update after the first review steps

The sections below describe the data as first analyzed. Since then, review
queue items 3, 4, 6 and 10 were applied (pull requests #15 and #29) and the
lead author decided items 1 and 7. Bulk database entries now live in a
separate field, `dispute_resolution.database_listings`, and are no longer
counted as provisions.[^decision-0015] The six component bands of the
Minnesota Chippewa Tribe have their own profiles, linked to the Tribe by
`part_of`, and their records moved to them; the Tribe's own profile now has
no dispute resolution record.[^decision-0016] Re-running the script gives these counts; the rest
of this analysis still quotes the first run.[^rerun]

| Count | First run | Re-run |
| --- | --- | --- |
| Profiles | 948 | 954, including 6 component bands |
| Profiles with any dispute resolution record | 185 | 151, including 3 component bands |
| Federally recognized entities with a record (component bands not counted) | 185 | 148 |
| Profiles with a record other than a database listing | not counted | 105 |
| Provisions | 1,327 | 227 |
| Provisions from section titles only | 291 | 55 |
| Provisions from text read | 98 | 172 |
| Database listings (bulk entries, not provisions) | none | 258, in 115 profiles |
| Profiles whose only record is a database listing | 80 | 46 |
| Provision titles repeated within one profile | 71 | 1 |
| Forums | 77, in 54 nations | 72, in 56 profiles |
| Source records without an archived copy | 1,966 of 1,970 | 5,110 of 5,344 |

The Yakutat Tlingit Tribe lost its only record, a training event, which
cited a page that does not name the Tribe (pull request #29). The Minnesota
Chippewa Tribe's records now sit on the White Earth, Leech Lake and Mille
Lacs band profiles. Five forums recorded twice (review queue item 5) were
folded into the main forum record on Nov. 22, 2026, and the bands are now
counted as separate profiles, so forums fall to 72 while the profiles with a
forum rise to 56. The 66 fewer section-title provisions are repeats removed
in pull request #15. The archive workflow was started on Nov. 21, 2026 for
the sources still without a copy (review queue item 9).

Two later steps changed the provision counts most. The lead author's decisions on the provision pre-review removed records that are not dispute resolution, and duplicates, and cut the database listings to 258 (pull request #98, decision record 0027). Then the provisions known only by a section title (review queue item 2) were read from the nations' own texts on Nov. 22, 2026: of the 225, 108 were read and summarized, 60 had already been removed by the pre-review decisions, 2 more were removed as repeats or out of scope, and 55 are still unread because no text was found online or the code site refused automated requests.[^title-only] Source records grew because other work added constitutions, codes and compacts.

## Summary

- **185 of 948 profiles** have any dispute resolution record. All 185 are
  federally recognized nations, which is 185 of 575 federally recognized
  profiles (32 percent).[^output] No state-recognized, petitioning or
  unrecognized community, Native Hawaiian or territorial profile has one; the
  research session searched for state-recognized nations' practice and found
  none, which means "not found," not "none."[^session-practice]
- **Most of the record was not read closely.** Of 1,327 provision records,
  938 (71 percent) are bulk records from the National Center on Restorative
  Justice database, 291 (22 percent) rest on section titles alone, and 98
  (7 percent) come from text the research session read. Only 47 provisions
  have a summary.[^output][^session-practice]
- **125 of the 185 nations** rest only on bulk or title-only records. Sixty
  nations have at least one record drawn from read text or a curated forum,
  clause, training or material record.[^output]
- **Seventy-seven forum records about 54 nations** carry the detail that
  matters for drafting. Forty describe peacemaking forums of 37 nations.[^output]
- **Coverage follows the sources, not necessarily practice.** For example, 9
  of 224 federally recognized nations in the Bureau of Indian Affairs Alaska
  Region have a record, compared with 26 of 30 in the Midwest Region.[^output]
- **Gaming compact clauses are mostly state templates.** Of 286 compact
  dispute resolution summaries, 256 were taken from a state's model compact and
  only 30 were read from the nation's own compact; there are only 28 distinct
  texts.[^output][^session-gaming]

## What was analyzed

The script reads every profile in `content/tribes/` (as merged at commit
`34a68e6`) and every source record in `content/sources/`. It counts the five
lists in each profile's `dispute_resolution` field (forums, provisions,
clauses, training programs and published materials) and the
`dispute_resolution_summary` of each gaming compact.[^schema]

Each provision is placed in one of three **evidence tiers** from its own note,
because confidence levels alone do not separate them (1,317 of 1,327
provisions are marked "medium"):[^output]

| Tier | Meaning | Provisions |
| --- | --- | --- |
| Text read | The research session read the provision or a curated summary of it | 98 |
| Section title only | Taken from a National Indian Law Library table of contents; the provision text was not read and its kind comes from words in the title | 291 |
| Bulk database record | Imported from the Restorative Justice Tribal Laws Database; not reviewed one by one, kind assigned from the database's own tags | 938 |

Sources for the tiers: the research session's limits and the notes on each
record.[^session-practice][^ncorj][^nill-example]

## 1. Coverage: what the sources reach

| Bureau of Indian Affairs region | Federally recognized profiles | With any record | With a forum record |
| --- | ---: | ---: | ---: |
| Alaska | 224 | 9 | 4 |
| Eastern | 35 | 12 | 5 |
| Eastern Oklahoma | 20 | 11 | 2 |
| Great Plains | 16 | 12 | 2 |
| Midwest | 30 | 26 | 11 |
| Navajo | 1 | 1 | 1 |
| Northwest | 45 | 37 | 13 |
| Pacific | 105 | 24 | 6 |
| Rocky Mountain | 9 | 8 | 2 |
| Southern Plains | 24 | 14 | 4 |
| Southwest | 24 | 10 | 1 |
| Western | 42 | 21 | 3 |

Source: script output, region as recorded from the Tribal Leaders
Directory.[^output][^bia-directory]

In the project's view, these differences say more about which nations publish
codes online, and which codes the National Indian Law Library and the
restorative justice database hold, than about where dispute resolution is
practiced. Alaska is the clearest case: 215 of the 224 Alaska profiles have no
record, and the session's queries searched Alaska nations directly only for a
few named nations, such as Tlingit & Haida.[^output][^session-practice] The map rule
(state presence only) also means region and state are the only geographic
lenses the data should be read through.[^decision-0007]

## 2. Peacemaking (its own track)

Forty forum records describe peacemaking forums of 37 nations, and 176
provision records are labeled peacemaking.[^output] Seventeen forum records give
the nation's own name for the forum or its peacemakers, as the nation writes
it, for example Itti-kāna-ikbi in the Mississippi Band of Choctaw Indians'
code and Gwe-shvt-naga in the Siletz code.[^choctaw-24][^siletz]

Structural features recur across the forum records. The counts below cover
all 77 forum records, of which 40 are peacemaking forums, because the other
kinds often share the same court connection. Each feature is a pattern in the
recorded summaries, coded by keyword (project analysis), and needs checking
against the codes themselves:

- **A forum inside the Tribal court system.** Several codes place peacemaking in
  the judiciary, as a division of the court or under a judge's supervision.
  The Chickasaw Nation's Peacemaking Court is "a division of the District
  Court" in its record, and the Mississippi Band of Choctaw Indians' court is a
  division of the Tribal Court.[^chickasaw][^choctaw-24]
- **Consent to enter.** Forty-five of 77 forum records mention party consent
  or agreement for referral or transfer (36 nations). This keyword count also
  catches unrelated uses of "agree," so it is an upper bound.[^output]
- **Return to court.** Nineteen forum records say an unresolved matter goes
  back to court or the parties may continue there (18 nations). The Chickasaw
  Nation's code, for example, returns unresolved matters to the District
  Court.[^output][^chickasaw]
- **Agreements entered as judgments.** Thirty-three forum records describe an
  agreement or decision entered, endorsed or enforced by the court (28
  nations). Under the Siletz code as recorded, a Community Law Court judgment
  is enforced like any Tribal Court judgment and cannot be appealed, though a
  party may move to modify it.[^output][^siletz]
- **A decision by the peacemaker only with everyone's consent.** Seven nations'
  records describe a peacemaker who may decide a matter only if all parties
  agree, which a Siletz section heading calls "Agreed Arbitration."[^output][^siletz][^chitimacha][^arapaho]

These features describe the codified, court-connected peacemaking that the
sources collect. The Native American Rights Fund's model law pages, the main
source for this section, collect enacted codes and rules.[^narf-laws][^narf-youth]
Community peacemaking that is not codified is unlikely to appear in this data,
and the charter keeps ceremonial or community-held knowledge out unless the
community approves in writing.[^charter-5]

## 3. Other forums

| Recorded kind | Forum records | Nations | Examples from read text |
| --- | ---: | ---: | --- |
| elders-council | 6 | 5 | Tlingit & Haida Court of Elders, which may mediate on the parties' joint written request[^ccthita] |
| restorative-justice | 6 | 6 | Tulalip Community Accountability Board[^tulalip-diversion] |
| traditional-forum | 6 | 6 | Village authority over family disputes in the Hopi Constitution[^hopi] |
| family-or-talking-circle | 5 | 5 | Peacemaker conferences in youth codes[^nisqually] |
| mediation-program | 5 | 5 | Oneida Nation's Peacemaking and Mediation Division, with a 25-hour training rule for mediators[^oneida] |
| arbitration | 4 | 4 | Agreed arbitration by peacemakers (see section 2) |
| other | 3 | 3 | Hopland Band claims presented to the Tribal Council[^hopland] |
| employment-tribunal | 1 | 1 | Prairie Band Potawatomi Nation's Employment Disputes Tribunal[^prairie-band] |
| settlement-conference | 1 | 1 | Chickasaw Nation pretrial settlement conference[^chickasaw] |

Source for counts: script output.[^output] Fifteen of the 77 forum records were
written up from the restorative justice database rather than from the
nation's own text, so their detail is secondhand.[^output][^ncorj]

Case types recorded for forums: civil (46 records), other (45), juvenile (27),
family (24), criminal diversion (15), child welfare (11), criminal sentencing
(11), commercial (6), employment (4), probate (3), property or land (2) and
intergovernmental (1). Participation: voluntary or court-referred (30),
voluntary (24), court-referred (10), required (7) and not recorded
(6).[^output]

## 4. Arbitration ordinances and immunity

Eighteen clause records describe nine nations.[^output] Four commercial
arbitration ordinances the session read share a structure: written agreements
to arbitrate are enforceable, the Tribal court confirms awards with limited or
no appeal, and claims against the nation proceed only where a separate
instrument or resolution waives immunity. The Ho-Chunk Nation, Pascua Yaqui
Tribe, Little River Band of Ottawa Indians and Jamestown S'Klallam Tribe
ordinances each follow this shape in their records.[^ho-chunk][^pascua][^little-river][^jamestown]
Turtle Mountain's code bars officials from signing a waiver without a separate
authorizing resolution.[^turtle-mountain]

Whether these ordinances share a common model, such as a uniform arbitration
act, is a question for review, not a conclusion (project analysis). Six of the
18 clause records are Little Traverse Bay Bands statute titles that were not
read.[^output]

## 5. The restorative justice database records

The 938 bulk records describe the database's own subject matter. By the
database's tags (a record can carry more than one), 409 fall under Tribal
justice, 358 under juvenile or youth justice and 285 under child welfare or
family; one is tagged civil justice. By phase, 454 are pre-adjudication and
375 post-adjudication.[^output][^ncorj]

So the two lenses give different pictures. The curated forum records are
mostly civil and family; the bulk records are mostly diversion, treatment and
restorative sentencing in criminal, juvenile and child welfare matters. In the
project's view this reflects what each source collects. Whether diversion and
sentencing provisions belong in a dispute resolution code at all is a scope
question for the review (see the roadmap).

## 6. Gaming compacts

Of 1,468 compact records, 286 carry a dispute resolution summary, for 276
nations in 28 states. Only 28 distinct summary texts exist: 256 summaries
were taken from a state's model compact with the nation's own text unchecked,
and 30 were read from the nation's own compact.[^output][^session-gaming]
Across the 28 distinct texts, 26 mention arbitration, 20 a notice and meeting
or negotiation step, 16 mediation, 14 American Arbitration Association rules,
12 federal court and 6 sovereign immunity or a waiver.[^output]

These clauses govern disputes between a nation and a state under the Indian
Gaming Regulatory Act's compact process,[^igra] so they describe
intergovernmental dispute resolution shaped by each state's template. They are
better read as state-level data than as evidence of an individual nation's
choices (project analysis).

## 7. Training and published materials

Ten training records (nine nations) and 14 published materials (eight
nations) were found. Seven of the training records come from news posts of
the Native American Rights Fund's Indigenous Peacemaking Initiative;
the Pueblo of Isleta's rules require training before a peacemaker joins the
roster.[^output][^isleta] Five of the 14 materials are low confidence, chiefly
items found through search results or on undated web pages.[^output][^session-practice]

## 8. Patterns to test after review

These are hypotheses from the data above (project analysis). Each could change
once the bulk and title-only records are reviewed.

1. **Court-connected design.** Documented forums sit inside or beside the
   Tribal court and use referral, transfer and entry of agreements as
   judgments. Test: does this hold in the text-read tier alone, and how much is
   it produced by sources that collect codes?
2. **Consent as the gate.** Consent governs entry and, where a neutral may
   decide, the decision itself. Test: count consent rules by reading each
   code, not by keyword.
3. **A return path to court.** Codes that say what happens when a process
   fails tend to send the matter back. Test: how many codes are silent?
4. **Two pictures from two sources.** Civil and family matters dominate the
   curated forums; juvenile, child welfare and criminal matters dominate the
   bulk records. Test: re-run after the bulk records are triaged.
5. **A shared arbitration ordinance shape.** Test: compare the four ordinances
   section by section with the uniform arbitration acts.
6. **Compact clauses follow the state.** Test: read the 256 template-based
   summaries against each nation's own compact or amendments.

## 9. Review queue

Each item is a data question for the review of pull request #2. Counts are
from the script output unless cited otherwise.[^output]

| # | Flag | Scale | Suggested review action |
| --- | --- | --- | --- |
| 1 | Bulk database records not reviewed; kind assigned from database tags | 938 provisions (857 labeled "other") | Decide scope (see roadmap), then keep, relabel or drop |
| 2 | Section-title-only provisions; text not read | 291 provisions (110 "other") | Read the provisions behind any title a draft may rely on |
| 3 | The same provision title repeated within one profile, often one table of contents read in two research passes under two source keys | 71 records | Merge duplicates |
| 4 | One web page with two source records (three Native American Rights Fund pages and one North Carolina page) | 4 pages | Keep one key, redirect the other |
| 5 | One forum recorded under two kinds (for example Mnodaawin as both peacemaking and a circle; Navajo peacemaking as both peacemaking and traditional-forum; agreed arbitration by peacemakers as separate arbitration forums) | at least 6 records | Decide whether a forum's features are separate records |
| 6 | Forum and provision kinds do not yet match method records; the methods pull request proposes a mapping (for example mediation-program to mediation) | 11 kinds | Apply the mapping in a rename pull request after the methods pull request merges |
| 7 | The Minnesota Chippewa Tribe profile holds records for Leech Lake, White Earth and Mille Lacs, noted by band | one profile | Decide whether counts are by profile or by band |
| 8 | The "as of" date of bulk records is the database date, not the date of the law | 937 records dated 2026-07-22 | Ignore dates for bulk records in any analysis |
| 9 | Source records without an archived copy, which the citation rules require | 1,966 of 1,970 | Run the archive workflow |
| 10 | Codes read by OCR, through a fetch-and-summarize tool, or from search results only[^session-practice] | listed in the session limits | Re-read before citing in commentary |
| 11 | Searched but not found: Muscogee (Creek) Nation, Cherokee Nation (beyond titles and bulk records), Puyallup, state-recognized nations[^session-practice] | four groups | Treat as gaps, not as absence |
| 12 | Every profile is "drafted from public sources" and none has been sent to the nation | 948 profiles | No nation is used as an illustration before consultation[^charter-4] |

## CARE and terminology notes

- The data describes published law. Restricted, ceremonial or community-held
  knowledge was not sought and must not be added without written
  approval.[^charter-5]
- No nation is ranked or held up as a standard. Examples are named only to
  show what a recorded code provides.[^style-guide]
- Native-language names are copied as the nation writes them, from the
  nation's own published text.[^style-guide]
- Each nation may correct, restrict or remove what is recorded about it, and
  the request wins.[^charter-6]

## References

[^output]: Script output, [`2026-11-21-dispute-resolution-practice.json`](2026-11-21-dispute-resolution-practice.json), generated by [`scripts/analysis/dispute_resolution_practice.py`](../../scripts/analysis/dispute_resolution_practice.py) from the profiles in `content/tribes/` at commit `34a68e6` (project analysis).
[^session-practice]: Research session `2026-11-21-dispute-resolution-practice`, [research/sessions/2026/2026-11-21-dispute-resolution-practice.md](../sessions/2026/2026-11-21-dispute-resolution-practice.md) (limits and "Review by the lead session").
[^session-gaming]: Research session `2026-11-21-gaming`, [research/sessions/2026/2026-11-21-gaming.md](../sessions/2026/2026-11-21-gaming.md); the template note is repeated on each compact record.
[^rerun]: Script output, [`2026-11-21-dispute-resolution-practice-rerun.json`](2026-11-21-dispute-resolution-practice-rerun.json), generated by the same script after pull request #29, the move of bulk entries to `database_listings`, the band profiles, the lead author's decisions on the provision pre-review (pull request #98) and the reading of section-title provisions (review queue item 2); the evidence tier now follows each record's `verification` level where one is set (project analysis).
[^decision-0015]: [Decision record 0015](../../docs/decisions/0015-database-listings-apart-from-provisions.md).
[^decision-0016]: [Decision record 0016](../../docs/decisions/0016-component-bands-own-profiles.md).
[^schema]: [schemas/tribe.schema.json](../../schemas/tribe.schema.json), `dispute_resolution` and `gaming.compacts`.
[^charter-3]: [Charter, commitment 3](../../docs/charter.md#3-peacemaking-as-its-own-track).
[^charter-4]: [Charter, commitment 4](../../docs/charter.md#4-consultation-before-publication).
[^charter-5]: [Charter, commitment 5](../../docs/charter.md#5-cultural-knowledge-and-restricted-material).
[^charter-6]: [Charter, commitment 6](../../docs/charter.md#6-the-right-to-correct-restrict-or-withdraw).
[^style-guide]: [Style guide, sections 1 and 3](../../docs/style-guide.md).
[^decision-0007]: [Decision record 0007, map shows state presence](../../docs/decisions/0007-map-shows-state-presence.md).
[^narf-ipi-home]: Native American Rights Fund, *Indigenous Peacemaking Initiative* (home page), [peacemaking.narf.org](https://peacemaking.narf.org/) (accessed Nov. 20, 2026). Source record: `narf-ipi-home`.
[^narf-laws]: Native American Rights Fund, Indigenous Peacemaking Initiative, *Tribal Peacemaking Laws* (Sept. 29, 2025), [peacemaking.narf.org/models/tribal-peacemaking-laws](https://peacemaking.narf.org/models/tribal-peacemaking-laws/) (accessed Nov. 21, 2026). Source records: `narf-ipi-tribal-peacemaking-laws` and duplicate `narf-tribal-peacemaking-laws` (review queue item 4).
[^narf-youth]: Native American Rights Fund, Indigenous Peacemaking Initiative, *Youth & Family Peacemaking Laws* (Aug. 25, 2025), [peacemaking.narf.org/models/youth-family-peacemaking-laws](https://peacemaking.narf.org/models/youth-family-peacemaking-laws/) (accessed Nov. 21, 2026). Source record: `narf-ipi-youth-family-peacemaking-laws`.
[^ncorj]: National Center on Restorative Justice, *Restorative Justice Tribal Laws Database*, [ncorj.org/tribal-laws](https://ncorj.org/tribal-laws) (accessed Nov. 21, 2026). Source record: `national-center-on-restorative-justice-restorative-justice-tribal-laws-database`.
[^nill-example]: For example, National Indian Law Library, Native American Rights Fund, *Tribal code table of contents: Bay Mills Indian Community, Michigan*, [narf.org/nill/codes/baymillscode](https://www.narf.org/nill/codes/baymillscode/index.html) (accessed Nov. 21, 2026). Source record: `national-indian-law-library-code-index-baymillscode`.
[^bia-directory]: U.S. Department of the Interior, Bureau of Indian Affairs, *Tribal Leaders Directory* (Nov. 20, 2026), [services1.arcgis.com](https://services1.arcgis.com/UxqqIfhng71wUT9x/arcgis/rest/services/TribalLeadership_Directory/FeatureServer/0). Source record: `bia-tribal-leaders-directory-2026`.
[^choctaw-24]: Mississippi Band of Choctaw Indians, Choctaw Tribal Code tit. XXIV, ch. 1, §§ 24-1-1 to 24-1-17 (Choctaw Peacemaker Code), [peacemaking.narf.org](https://peacemaking.narf.org/wp-content/uploads/2025/07/Miss-Choctaw-Title-24-Choctaw-Peacemaker-Code.pdf) (accessed Nov. 21, 2026). Source record: `mississippi-choctaw-title-24-peacemaker-code`.
[^siletz]: Confederated Tribes of Siletz Indians, Siletz Tribal Code §§ 3.300–3.326 (Siletz Community Law Court) (amended June 20, 2025), § 3.305 (agreed arbitration), [ctsi.nsn.us](https://ctsi.nsn.us/wp-content/uploads/2025/06/Siletz-Community-Law-Court-06-20-2025.pdf) (accessed Nov. 21, 2026). Source record: `siletz-code-3-300-community-law-court-2025`.
[^chickasaw]: Chickasaw Nation Code tit. 5, ch. 14 (Peacemaking Court Act of 2003), §§ 5-1401.1 to 5-1401.17, and § 5-202.22(A), (L) (May 16, 2025 compilation), [peacemaking.narf.org](https://peacemaking.narf.org/wp-content/uploads/2025/07/The-Chickasaw-Nation-Title-5-5.16.2025.pdf) (accessed Nov. 21, 2026). Source record: `chickasaw-title-5-courts-and-procedures`.
[^chitimacha]: Chitimacha Tribe of Louisiana, Chitimacha Comprehensive Codes of Justice tit. I-A (Chitimacha Peacemaker Court) (1990), [peacemaking.narf.org](https://peacemaking.narf.org/wp-content/uploads/2025/07/CCCJ-Title-IA-Chitimacha-Peacemaker-Court.pdf) (accessed Nov. 21, 2026). Source record: `chitimacha-title-1a-peacemaker-court`.
[^arapaho]: Northern Arapaho Code tit. 7 (Peacemaker Code) (Aug. 31, 2016), [peacemaking.narf.org](https://peacemaking.narf.org/wp-content/uploads/2025/07/N.-Arapaho-Title-7-Peacemaker-Type.pdf) (accessed Nov. 21, 2026). Source record: `northern-arapaho-title-7-peacemaker-code`.
[^ccthita]: Central Council of the Tlingit & Haida Indian Tribes of Alaska, tit. 06 (Tribal Courts), ch. 04, §§ 06.04.001–06.04.004 (enacted Mar. 1, 2022), [tlingitandhaida.gov](https://tlingitandhaida.gov/wp-content/uploads/Title-06-Tribal-Courts-Enacted-2022.03.01.pdf) (accessed Nov. 21, 2026). Source record: `ccthita-title-06-tribal-courts-2022`.
[^tulalip-diversion]: Tulalip Tribal Court, *Juvenile Diversion*, [tulaliptribalcourt-nsn.gov](https://www.tulaliptribalcourt-nsn.gov/ProgramsAndServices/JuvenileDiversion) (accessed Nov. 21, 2026). Source record: `tulalip-tribal-court-juvenile-diversion`.
[^hopi]: Constitution and By-laws of the Hopi Tribe art. III, § 2 (as amended through Amendment III, Dec. 7, 1993), [narf.org/nill](https://narf.org/nill/constitutions/hopi/hopi_const_1993.pdf) (accessed Nov. 21, 2026). Source record: `hopi-constitution-nill`. The PDF's text layer is poor (review queue item 10).
[^nisqually]: Nisqually Tribal Code tit. 50 (Youth), §§ 50.20.01–50.20.06 (June 8, 2023), [peacemaking.narf.org](https://peacemaking.narf.org/wp-content/uploads/2025/07/Nisqually-Title_50_Youth_Code.pdf) (accessed Nov. 21, 2026). Source record: `nisqually-title-50-youth-code`.
[^oneida]: Oneida Nation, 8 O.C. 801.6 (Peacemaking and Mediation Division), [peacemaking.narf.org](https://peacemaking.narf.org/wp-content/uploads/2025/07/Oneida-Chapter-801-Judiciary.pdf) (accessed Nov. 21, 2026). Source record: `oneida-wi-8-oc-801-judiciary`.
[^hopland]: Hopland Tribal Code tit. 12, ch. 12-4, §§ 12-4.10 to 12-4.150, [peacemaking.narf.org](https://peacemaking.narf.org/wp-content/uploads/2025/07/Hopland-Title-12-Tribal-Court.pdf) (accessed Nov. 21, 2026). Source record: `hopland-title-12-tribal-court`.
[^prairie-band]: Constitution of the Prairie Band Potawatomi Nation art. VI, §§ 1–3 (approved Dec. 6, 2007), [peacemaking.narf.org](https://peacemaking.narf.org/wp-content/uploads/2025/07/Prarie-Band-Constitution.pdf) (accessed Nov. 21, 2026). Source record: `prairie-band-potawatomi-constitution-2007`.
[^ho-chunk]: Ho-Chunk Nation Code, 2 HCC § 13 (Arbitration Ordinance) (Dec. 28, 2004), [ho-chunknation.com](https://ho-chunknation.com/wp-content/uploads/2019/10/2HCC13-Arbitration-Ordinance-12.28.04.pdf) (accessed Nov. 21, 2026). Source record: `ho-chunk-2-hcc-13-arbitration`.
[^pascua]: Pascua Yaqui Tribal Code tit. 7, ch. 6 (Arbitration), §§ 6-10 to 6-150 (Mar. 24, 2010), [pascuayaqui-nsn.gov](https://www.pascuayaqui-nsn.gov/wp-content/legacy-tribalcodes/docs/7_PYTC/6_Arbitration.pdf) (accessed Nov. 21, 2026). Source record: `pascua-yaqui-7-pytc-6-arbitration`.
[^little-river]: Little River Band of Ottawa Indians, Arbitration Code, Ordinance No. 01-300-02, §§ 1, 4, 8–10 (2001), [lrboi-nsn.gov](https://lrboi-nsn.gov/sites/default/files/pages/Title-300-02.pdf) (accessed Nov. 21, 2026). Source record: `little-river-arbitration-code-01-300-02`.
[^jamestown]: Jamestown S'Klallam Tribal Code tit. 2 (Arbitration Code), §§ 2.01.02, 2.02.01–2.02.08 (Jan. 12, 2012), [jamestowntribe.org](https://jamestowntribe.org/wp-content/uploads/2018/05/Title_02_-Arbitration_LPG_Edits_1-12-12.pdf) (accessed Nov. 21, 2026). Source record: `jamestown-title-2-arbitration`.
[^turtle-mountain]: Turtle Mountain Tribal Code § 7.07.070, [law.tmchippewa.com](https://law.tmchippewa.com/us/nsn/tmchippewa/council/code/7.07.070) (accessed Nov. 21, 2026). Source record: `turtle-mountain-7-07-070`.
[^isleta]: Pueblo of Isleta, Resolution 2020-028 (Peacemaking Program and Rules), R. 3(d)–(f) (June 11, 2020), [peacemaking.narf.org](https://peacemaking.narf.org/wp-content/uploads/2025/07/Isleta-Pueblo-Resolution-for-Peacemaking-Program-and-Rules.pdf) (accessed Nov. 21, 2026). Source record: `isleta-resolution-2020-028-peacemaking`.
[^igra]: Indian Gaming Regulatory Act, 25 U.S.C. § 2710(d) (tribal-state compacts for class III gaming).

[^title-only]: Research session `2026-11-22-title-only-provision-reading`; per-record results in `research/reviews/2026-11-22-title-only-provisions.json`; places searched in `research/search-logs/dispute-resolution/`.
