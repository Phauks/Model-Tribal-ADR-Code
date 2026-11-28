# Evidence that nations were forced to move: all 55 journeys

**Status:** research, written Nov. 27, 2026, extending the pilot (`2026-11-27-removal-evidence-pilot.md`) to the other 49 journeys in `research/historic-maps/removals/removals.json`, under the three-part standard Trevor approved that day ("sounds good"). Nothing on the site changed. Seven research subagents gathered the evidence by region; every quotation was then re-matched by script against the text fetched. The records are in `research/historic-maps/removals/evidence.json`, now with a one-line finding for each journey. Every item is Unverified until a person reads it in the source.

## 1. Method

- **The standard** (approved): A, the order (treaty, statute, military or executive order); B, the move recorded at the time (dates, places, numbers, deaths); C, the force (troops, prisoners, escorts, threats, deaths, a state law that made staying impossible, the nation's protest at the time, or an official finding that the move was against its will). The nation's own account is linked, never copied.
- **Honest labels.** The researchers were told not to stretch evidence to fit "forced". Where the record shows a move was negotiated, chosen, or never carried out, the evidence says so, and items that cut against force are kept under C with a note.
- **Fetching and checking.** Two new scripts: `scripts/removals/fetch_source.py` saves the text of each source (PDFs read both plain and with `-layout`), and `scripts/removals/check_evidence_quotes.py` re-matches every quotation against that text, allowing only for Unicode quotes and dashes, whitespace, line-end hyphens, ". . ." omissions, and up to three short interruptions such as a marginal note. It writes the result to each item's `checked` field. Anyone can re-run it: `python3 scripts/removals/check_evidence_quotes.py research/historic-maps/removals/evidence.json`.
- **Result of the check.** 466 quotations: 464 match the fetched text (3 of them only after skipping a marginal note or running head, named in `checked`); 2 do not, both pilot items (the Ponca appropriation at 19 Stat. 192, whose scans interleave a marginal note inside a word, and S. Rep. No. 46-670, whose only copy refuses scripts). 65 items carry no quotation (57 links to nations' own accounts, and catalog records).
- **Spot checks.** I read the surrounding text for six of the strongest quotations (Creek 1836, Seminole 1834, Ho-Chunk 1840, Miami 1846, Dakota 1863 and Nome Cult 1863): each says what its item says, in context. The Miami report goes on to say that "the mere presence of the troops" was enough; the Miami item's notes say so, and the page should show both.
- **Sources that carried the work.** The Commissioner of Indian Affairs' annual reports on the Internet Archive (the item `1826-report-from-the-indian-office` holds every year from 1826 to the 1880s, which earlier threads had not found); S. Doc. No. 512, 23d Cong., 1st Sess. (1834) volumes 1, 2, 4 and 5; Serial Set scans on GovInfo found through the project's own index (`research/data-roadmap/2026-11-27-serial-set/oklahoma-index-matched-to-govinfo.csv`); Kappler's treaties (treaties.okstate.edu); Statutes at Large page PDFs on GovInfo; and the Caselaw Access Project.

## 2. What the evidence shows (project analysis)

Of the 55 journeys:

- **Forced: 23.** Troops, militia, prisoners of war, escorts, or orders to kill. 20 of them have a strong contemporary record, 3 a moderate one (Yavapai 1875, Northern Cheyenne 1877, White River Ute 1881).
- **Pressured: 17.** No troops in the record, but state laws, settlers, hunger, threats or payment pushed the nation to go (for example the Choctaw, Chickasaw, Osage and Pawnee).
- **Negotiated: 13.** The record shows a treaty move that the nation agreed to or chose (for example the Stockbridge move to Wisconsin, which the nation itself petitioned for, and the Kickapoo treaties).
- **Not carried out: 2.** The Stockbridge removal of 1848 and the Menominee removal to Minnesota never happened.

By the drawing rule (a solid arrow needs A and B), 49 journeys get a solid arrow, 4 a dashed one (Potawatomi from Chicago, Shawnee of Missouri, Sac and Fox of the Missouri, and the Caddo, whose one B item records the Caddo staying, not going), and the 2 that never happened should not be drawn as moves.

So the evidence is now strong where it matters most: every journey Trevor would point to as a forced removal (Cherokee, Creek, Seminole, Potawatomi, Ho-Chunk, Sauk, Miami, Dakota, Navajo, Mescalero, Ponca, Chiricahua, Nez Perce, Modoc, Nome Cult, Rogue River and others) has the order, the move and the force in the government's own words. It also shows that about half the list is not "forced" in that sense. A page titled only "Removals" that drew all 55 the same way would overstate the record, so I recommend the page shows the four kinds of move.

## 3. Journey by journey

"A / B / C" counts the items in each part. "Move", "Record" and "Arrow" are the findings stored in `evidence.json` under `findings`. The full items, with citations, pin pages and quotations, are in `evidence.json` under `journeys`.

### Southeast

| Journey | Years | A / B / C | Move | Record | Arrow | What the record shows (project analysis) |
| --- | --- | --- | --- | --- | --- | --- |
| Cherokee (emigrating party, "Old Settlers") | 1817-1833 | 2 / 1 / 2 | Pressured | Thin | Solid | Negotiated with the Arkansas Cherokee; settler pressure and withheld improvement pay pushed dissenters to go. Not a forced move in the record. |
| Cherokee (Eastern Cherokee) (pilot) | 1838-1839 | 6 / 4 / 8 | Forced | Strong | Solid | General Scott's troops rounded up about 6,000 prisoners into 23 posts and sent them west in detachments, the last leaving Dec. 4, 1838. |
| Choctaw | 1820-1825 | 2 / 2 / 0 | Negotiated | Thin | Solid | A voluntary emigration offer, mostly not carried out; the tract was cut back in 1825 because settlers were already on it. |
| Choctaw (pilot) | 1831-1833 | 4 / 5 / 7 | Pressured | Moderate | Solid | Mississippi extended its laws over the Choctaw and sent constables and sheriffs onto their land; removal agents recorded the parties, their numbers and their suffering. No troops recorded. |
| Chickasaw | 1837-1838 | 2 / 2 / 3 | Pressured | Moderate | Solid | The 1832 treaty recites that the Chickasaw were oppressed by state laws; five to six hundred died of smallpox on the way (Armstrong, 1838). No troops recorded and no total moved found. |
| Muscogee (Creek), McIntosh party (Lower Creeks) | 1825-1828 | 2 / 1 / 1 | Negotiated | Thin | Solid | Voluntary emigration of McIntosh's followers, who "fled their country" after their break with the Creek Nation; about 2,400 went in two parties. |
| Muscogee (Creek) | 1836-1837 | 3 / 2 / 4 | Forced | Strong | Solid | After the 1836 hostilities the Secretary of War ordered the Creeks removed "whether willing or unwilling to go"; the Commissioner reported all removed but the families of 700 warriors. |
| Seminole | 1832-1870 | 3 / 3 / 6 | Forced | Strong | Solid | Agent Thompson told the chiefs the President "will compel you to go"; war followed, and over 2,000 had been carried west by 1839. |
| Seminole (Florida remnant, Billy Bowlegs band) | 1857-1858 | 1 / 2 / 2 | Pressured | Moderate | Solid | After twenty years of war, Billy Bowlegs and 163 followers were induced to go by payment in 1858; four died on the way. |
| Apalachicola band | 1832-1834 | 2 / 2 / 1 | Negotiated | Thin | Solid | Blunt's band chose to emigrate under the 1832 and 1833 treaties, at its own cost; two upper-town chiefs refused. Departure date and numbers not found. |

### Great Lakes

| Journey | Years | A / B / C | Move | Record | Arrow | What the record shows (project analysis) |
| --- | --- | --- | --- | --- | --- | --- |
| United Nation of Chippewa, Ottawa and Potawatomi (Treaty of Chicago) | 1833-1837 | 2 / 0 / 3 | Pressured | Thin | Dashed | The treaty is solid, but no record of the 1835 move itself was found; the record shows only reluctance to sell. |
| Potawatomi of Indiana (Tippecanoe, Yellow River and Wabash bands) | 1836-1840 | 3 / 2 / 5 | Forced | Strong | Solid | The Commissioner's 1838 report: the Potawatomi showed "an indisposition to comply" and General Tipton's 100 volunteers carried out the collection and removal of 768 people. |
| Potawatomi (Chief Menominee's band, Trail of Death) (pilot) | 1838 | 1 / 7 / 4 | Forced | Strong | Solid | Indiana militia under General Tipton gathered about 859 Potawatomi and marched them to Kansas, Sept. 4 to Nov. 4, 1838; about 43 died. |
| Potawatomi (United Bands at Council Bluffs) | 1847-1872 | 2 / 2 / 2 | Pressured | Thin | Solid | The 1846 move from Council Bluffs was negotiated; the 1867 move was optional by register, under settler pressure. |
| Winnebago (Ho-Chunk) | 1832-1856 | 4 / 3 / 10 | Forced | Strong | Solid | Over two regiments of infantry spent the summer of 1840 "forcing a large majority of them across the Mississippi"; in 1848 a third of the tribe fled the removal party. |
| Sauk and Meskwaki (Fox) | 1829-1869 | 5 / 4 / 5 | Forced | Strong | Solid | In 1831 General Gaines's troops and Illinois militia removed Black Hawk's band west of the Mississippi; the Governor said "peaceably, if they can: but forcibly, if they must." |
| Kickapoo (Vermilion and Prairie bands) | 1819-1833 | 2 / 1 / 1 | Negotiated | Thin | Solid | Treaty removals of bands recited as willing to go; 375 Kickapoo moved in 1833. No force found. |
| Menominee | 1848-1852 | 2 / 2 / 2 | Not carried out | Thin | Not carried out | The removal to Crow Wing, Minnesota never happened; the 1854 treaty recites the Menominee's "great unwillingness" to go. They were moved within Wisconsin in 1852. |

### Ohio Valley

| Journey | Years | A / B / C | Move | Record | Arrow | What the record shows (project analysis) |
| --- | --- | --- | --- | --- | --- | --- |
| Shawnee of Missouri (Cape Girardeau band) | 1825-1833 | 2 / 0 / 1 | Negotiated | Thin | Dashed | Treaty only; no record of the move or of force was found. |
| Shawnee of Wapakoneta and Hog Creek, Ohio | 1831-1833 | 2 / 3 / 3 | Pressured | Moderate | Solid | A government-run treaty emigration of about 450 Shawnee, Sept. to Nov. 1832, without troops; their request to travel by land was refused. |
| Seneca of Sandusky (Ohio) | 1831-1832 | 2 / 1 / 2 | Pressured | Moderate | Solid | The removal agent wrote "I charge myself with cruelty in forcing these unfortunate people on"; measles and deaths on the road, 1831-1832. No troops. |
| Mixed Seneca and Shawnee of Lewistown, Ohio | 1831-1832 | 2 / 2 / 2 | Negotiated | Thin | Solid | The band was recorded as willing to go; the government controlled only the manner of travel. One death recorded. |
| Delaware (Lenape) | 1818-1869 | 3 / 1 / 4 | Pressured | Thin | Solid | Treaty removals over fifty years; an agent wrote in 1830 that the Delaware would not go without "some appearance of compulsion." Little record of the early moves. |
| Wyandot | 1843-1873 | 3 / 2 / 5 | Pressured | Moderate | Solid | 664 Wyandot left Upper Sandusky July 12, 1843, and about 100 died within a year; the Commissioner called the move "purely voluntary." |
| Miami | 1846-1873 | 2 / 3 / 3 | Forced | Strong | Solid | The Commissioner: "there was no alternative but to send troops to compel" the Miami; 323 left Peru, Indiana, under troops on Oct. 6, 1846. |
| Ottawa of Blanchard's Fork and Roche de Boeuf, Ohio | 1832-1873 | 4 / 3 / 1 | Negotiated | Thin | Solid | Treaty removal of about 100 Ottawa in 1832, struck by cholera; one band was left free to go when it chose. |
| Kaskaskia, Peoria, Wea and Piankashaw (Illinois Confederacy) | 1832-1871 | 3 / 2 / 3 | Negotiated | Thin | Solid | Treaty cessions and relocations; the Indiana Wea refused to go in 1832, and the 1867 move was framed as a request. |

### New York and the upper Mississippi

| Journey | Years | A / B / C | Move | Record | Arrow | What the record shows (project analysis) |
| --- | --- | --- | --- | --- | --- | --- |
| New York Indians (Seneca, Cayuga, Onondaga, Oneida, Tuscarora, St. Regis, Stockbridge, Munsee, Brothertown) | 1838-1842 | 3 / 3 / 4 | Pressured | Moderate | Solid | The Seneca protested the 1838 treaty as obtained by "fraud, bribery, perjury, and forgery"; the 1846 party to Kansas was small and volunteer: of 271, 82 died and 94 returned. |
| New York Indians (Oneida, Stockbridge, Munsee, Brothertown) | 1822-1857 | 1 / 2 / 0 | Negotiated | Thin | Solid | A chosen move: the Stockbridge themselves petitioned that they had determined to seek a new home in the west. |
| Stockbridge | 1848-1856 | 2 / 2 / 1 | Not carried out | Thin | Not carried out | The tribe refused to go to Minnesota; the 1856 treaty gave them land in Wisconsin instead. |
| Iowa (Ioway) | 1836-1883 | 4 / 1 / 1 | Negotiated | Thin | Solid | The 1836 treaty was an exchange the tribes are recited as having asked for; the 1883 order only confirmed a reserve where many already lived. |
| Sac and Fox of the Missouri | 1836-1837 | 2 / 0 / 0 | Negotiated | Thin | Dashed | Only the 1836 treaty was found; no record of the move or of force. |
| Ho-Chunk (Winnebago) | 1863-1866 | 2 / 4 / 8 | Forced | Strong | Solid | Congress ordered the Winnebago out of Minnesota though they were found blameless; 1,945 were taken to Crow Creek, and the Commissioner wrote that the removal was "the result of the overwhelming pressure of the public sentiment." |
| Dakota (Santee: Mdewakanton, Wahpekute; Wahpeton and Sisseton scouts excepted) | 1863-1866 | 2 / 4 / 7 | Forced | Strong | Solid | After internment at Fort Snelling under military guard, 1,306 Dakota were shipped to Crow Creek, arriving May 30, 1863; the Secretary of the Interior called them captives. |

### Southern Plains and Texas

| Journey | Years | A / B / C | Move | Record | Arrow | What the record shows (project analysis) |
| --- | --- | --- | --- | --- | --- | --- |
| Osage (Great and Little Osage) | 1825-1872 | 3 / 2 / 2 | Pressured | Moderate | Solid | The 1870 act required Osage consent; the council accepted under white encroachment, and 3,956 were on the new reserve in 1872. |
| Kaw (Kansa) | 1873 | 2 / 2 / 2 | Pressured | Thin | Solid | The 1872 act required the tribe's agreement; intruders and starvation were the pressure. They left June 4 and arrived June 21, 1873, without a death. |
| Quapaw | 1824-1834 | 2 / 2 / 2 | Pressured | Moderate | Solid | Concentration with the Caddo under the 1824 treaty failed; the 1833 treaty recites that nearly a quarter of the people died and they had "no alternative but to perish." |
| Caddo (Caddo Nation of Louisiana) | 1835-1836 | 1 / 1 / 2 | Negotiated | Thin | Dashed | A negotiated 1835 cession with a removal clause; no government record of the move or of force was found. |
| Caddo, Wichita (Waco, Tawakoni, Kichai), Tonkawa and other Texas reserve nations | 1859 | 2 / 4 / 6 | Forced | Strong | Solid | Settlers threatened extermination, and about 1,430 people of the Brazos and Comanche reserves were moved under army escort to the Washita, Aug. 1 to 16, 1859. |
| Tonkawa and Lipan Apache | 1884-1885 | 2 / 2 / 2 | Negotiated | Thin | Solid | A relief move of landless, starving people under the Act of July 4, 1884; the move itself is not dated in the record found. |
| Ponca (pilot) | 1877-1878 | 3 / 6 / 11 | Forced | Strong | Solid | Troops from Fort Randall; 158 of 581 died within a year (Standing Bear v. Crook); an 1881 commission found the removal "without lawful authority." |
| Pawnee (Grand, Loup, Republican, Tappage) | 1857-1875 | 3 / 2 / 3 | Pressured | Moderate | Solid | The Pawnee asked to go after Sioux raids killed 69 in 1873 and famine followed; about 1,800 were removed to the Wichita agency. |
| Otoe and Missouria | 1854-1882 | 3 / 2 / 1 | Pressured | Thin | Solid | The 1881 act required consent in council; an agent warned those who refused. 70 wagons left Oct. 5 and reached Red Rock Oct. 23, 1881. |

### Southwest and Great Basin

| Journey | Years | A / B / C | Move | Record | Arrow | What the record shows (project analysis) |
| --- | --- | --- | --- | --- | --- | --- |
| Navajo (Diné) (pilot) | 1863-1868 | 4 / 10 / 6 | Forced | Strong | Solid | Carleton's orders to kill Navajo men who did not surrender; 8,354 Navajo counted at Bosque Redondo in 1864; 197 died on one march. |
| Mescalero Apache (pilot) | 1862-1863 | 3 / 5 / 2 | Forced | Strong | Solid | Carleton's 1862 order that Mescalero men be killed wherever found; 405 Mescalero held at Bosque Redondo in 1864. |
| Chiricahua and Warm Springs Apache (Geronimo's band and scouts) | 1886-1894 | 2 / 4 / 3 | Forced | Strong | Solid | In 1886 the whole Chiricahua and Warm Springs people, including those who had not fought, were seized by troops and sent as prisoners of war to Florida; later moves thinly recorded. |
| Yavapai and Tonto Apache (Dilzhe'e) | 1875 | 1 / 3 / 3 | Forced | Moderate | Solid | About 1,400 Yavapai and Tonto Apache were marched about 180 miles to San Carlos in 1875 on the President's order under cavalry escort; the agent wrote that they were opposed to going. |
| Ute (Uintah, Timpanogos, Yampa and others of Utah Territory) | 1861-1865 | 2 / 3 / 2 | Pressured | Thin | Solid | The 1864 act provided for Utes who "may be induced" to go to Uintah; the pressure was settlers and hunger, not troops. |
| White River Ute (Yampa/Parianuche) and Uncompahgre Ute | 1880-1881 | 2 / 3 / 3 | Forced | Moderate | Solid | Removed under the 1880 agreement after the Meeker killings; the troop record is for the Uncompahgre, turned over to General Mackenzie in 1881. |
| Northern Paiute (Malheur) prisoners after the Bannock War | 1879 | 1 / 2 / 3 | Forced | Strong | Solid | 543 Paiute held as prisoners of war were marched by cavalry to the Yakama reservation in the winter of 1878-1879, including a band that had not fought. |

### Pacific Coast and northern Plains

| Journey | Years | A / B / C | Move | Record | Arrow | What the record shows (project analysis) |
| --- | --- | --- | --- | --- | --- | --- |
| Nez Perce (nimíipuu), non-treaty bands | 1877-1885 | 3 / 6 / 4 | Forced | Strong | Solid | Joseph's people were held as prisoners of war and sent to Fort Leavenworth and the Indian Territory; more than a quarter died within months (Commissioner, 1878). |
| Modoc | 1864-1873 | 3 / 4 / 3 | Forced | Strong | Solid | After the Modoc War, 152 prisoners were taken by the army to Fort McPherson and then to the Quapaw agency in Nov. 1873. |
| Northern Cheyenne | 1877-1884 | 4 / 2 / 5 | Forced | Moderate | Solid | 937 Northern Cheyenne went south under military escort in 1877, reluctantly by the Senate committee's finding; in 1879 the army tried to "starve and freeze these captives into submission" at Fort Robinson. |
| Konkow (Concow) Maidu and others (Nomlaki, Yuki, Wintun, Pomo) of the Sacramento Valley | 1863 | 2 / 3 / 3 | Forced | Strong | Solid | Settlers resolved that Indians left after thirty days should be killed; Captain Starr's troops marched 461 people from Chico, and 277 reached Round Valley, "thirty dying en route." |
| Rogue River peoples (Takelma, Latgawa, Shasta, Athapaskan bands) and Chasta | 1853-1857 | 4 / 4 / 6 | Forced | Strong | Solid | The bands surrendered as prisoners of war and were taken under troop escort to the Coast reservation in 1856; earlier stages were negotiated. |

## 4. Corrections the evidence suggests for removals.json

These are not yet made; `removals.json` feeds the placed journeys and the Forced journeys tile set, so a change there should be made with the Removals page build (project analysis from the research reports).

- **Dakota, 1863:** the removal act is the Act of Mar. 3, 1863, ch. 119, 12 Stat. 819; the Act of Feb. 16, 1863, 12 Stat. 652, annuls the treaties and orders no move, and the stage's quotation ("to cause the Sioux of the Mississippi to be removed beyond the limits of") was not found in it.
- **Pawnee, 1874-1875:** the act is 19 Stat. 28 (ch. 51), not 19 Stat. 29; it authorizes a sale with the tribe's consent and orders no removal. The tribe asked to go.
- **Menominee:** never reached Crow Wing, Minnesota; mark the stage as attempted. The only move (Nov. 1852) was within Wisconsin.
- **White River Ute, 1881:** the troops and the Aug. 27, 1881 march belong to the Uncompahgre; the White River people moved to Uintah through 1880-1881.
- **Modoc, 1873:** by army to Fort McPherson, Nebraska, then to Baxter Springs (Nov. 14-16) and the Quapaw agency (152 people, Nov. 22). The 1872 order (July 6, 1872) tried to enforce the 1864 treaty and led to the war.
- **Northern Cheyenne:** the 1878 move north was a flight (Sept. 9, 1878); the 1884 executive order only made the Montana reservation.
- **Nez Perce:** the Quapaw stage can cite the Act of May 27, 1878, ch. 142, 20 Stat. 63, 74 ("now held as prisoners of war at Fort Leavenworth"); arrival at Oakland was June 14, 1879.
- **Chiricahua, 1886:** Geronimo's men to Fort Pickens and the women and children to Fort Marion (Oct. 1886); the Fort Apache band, who had not fought, were seized Sept. 7, 1886.
- **Miami, 1846:** the note "enforced by U.S. troops" is now sourced; about 161 Miami stayed in Indiana by treaty or joint resolution.
- **Wyandot, 1843; Kickapoo; Iowa; Ottawa of Ohio; Uintah Ute; Osage, Kaw and Otoe-Missouria:** the record or the statute shows consent or inducement; describe them as negotiated or pressured, not forced.
- **Ottawa of Ohio, stage 1:** about 100 moved in 1832, not the 200 of the treaty recital; the range 1832-1837 is probably too long.
- **Tonkawa, 1884-1885:** the destination differs by document (the Iowa reservation, the Quapaw reservation, Oakland); ARCIA 1886 puts them at Oakland.
- **Seminole:** the first party of 382 reached Little Rock about May 5, 1836; the 1858 party was 163 by Rector's count and 164 by Rutherford's.
- **Texas reserves, 1859:** can now cite the Commissioner's instruction of June 11, 1859 and the army escort under Maj. George H. Thomas (left Aug. 1, reached the Washita Aug. 16).

## 5. What is still missing

- **Records a person can pull.** Seven Serial Set documents exist only as University of Oklahoma PDFs that refuse scripts; they are listed in the hand-pull list, Part 1n (Modoc War correspondence, the Apache prisoners of war, the 1842 Winnebago removal, the White River Ute Commission, and the 1846 Miami removal). The texts of the Mississippi act of Jan. 19, 1830 and Alabama's similar act are in Part 4k.
- **Records the project can fetch later** (no person needed): ARCIA 1845-1847, 1859, 1870-1871 and 1885 from the Internet Archive item named above; H.R. Rep. No. 1304, 47th Cong., 1st Sess. (Ute) on GovInfo; S. Rep. No. 46-670 in its GovInfo volume (the number did not match in the index); the War of the Rebellion Official Records, ser. 1, vol. 50, pt. 2, for the Nome Cult orders.
- **Counts.** Deaths on the Dakota voyage and at Crow Creek; Chickasaw and Creek totals moved; the Apalachicola departure; the Tonkawa move date.
- **Nations' own accounts.** Each journey has a link, but many are general history pages that were reachable but not read for this move, and some sites refused scripts (Siletz, Prairie Band Potawatomi, Meskwaki, Eastern Shawnee, Ottawa Tribe). No page was found for the Apalachicola, Kickapoo or Caddo moves. The links need a person's check before the page shows them, and the nations may ask for changes (charter commitment 6).
- **Copyright.** The Sauk 1831 letters are quoted from the Illinois State Historical Library's 1973 edition, one short sentence each, and flagged; the Potawatomi pilot items use the 2021 Indiana Magazine of History edition the same way.

## 6. Recommendation (project analysis)

1. Show every journey on the Removals page, with its kind of move (forced, pressured, negotiated, not carried out) as a label or filter, rather than drawing all 55 as forced removals. This keeps the strong cases strong and is true to the record.
2. Keep the drawing rule: solid arrow with A and B, dashed without B; do not draw the two that never happened as journeys (show them in the table only).
3. Apply the corrections in section 4 to `removals.json` when the page is built.
4. Read each item in its source before marking it Verified, starting with the 20 forced journeys with strong records.

## References

- Annual Reports of the Commissioner of Indian Affairs, 1826-1888, Internet Archive items `1826-report-from-the-indian-office` and `usindianaffairs<YY>usdorich` (https://archive.org/details/1826-report-from-the-indian-office).
- Correspondence on the Subject of the Emigration of Indians, S. Doc. No. 512, 23d Cong., 1st Sess. (1834), vols. 1, 2, 4, 5, Internet Archive items `correspondenceon11834unit`, `correspondenceon21835unit`, `correspondenceon41835unit`, `correspondenceon51835unit`.
- U.S. Congressional Serial Set scans on GovInfo (https://www.govinfo.gov/app/collection/serialset), found through `research/data-roadmap/2026-11-27-serial-set/oklahoma-index-matched-to-govinfo.csv`.
- Charles J. Kappler, ed., Indian Affairs: Laws and Treaties (1904), Oklahoma State University transcription (https://treaties.okstate.edu/).
- United States Statutes at Large, GovInfo page PDFs (https://www.govinfo.gov/app/collection/statute).
- Caselaw Access Project (https://static.case.law/).
- The evidence pilot: `research/analyses/2026-11-27-removal-evidence-pilot.md`; the journeys: `research/analyses/2026-11-27-removal-routes-for-the-map.md`.
