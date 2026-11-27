#!/usr/bin/env python3
"""Cite each federally recognized nation's own recognition source.

Every federal nation's first recognition fact cites the Bureau of Indian
Affairs list in the Federal Register, pinpointed to the page with its entry
(scripts/tribes/federal_facts.py). This script adds the document that
recognized, restored or reaffirmed the nation, where one was found:

- Acts of Congress, each read in the Statutes at Large on govinfo.gov
  (section and page below). The nation gets a recognition fact citing the
  Act, with the Act's own source record; facts it already had that came
  from the Office of Federal Acknowledgment's list and name the same Act
  are reworded to the same citation, so the page shows the Act once.
- Final determinations under the federal acknowledgment regulations
  (25 C.F.R. pt. 54 from 1978, renumbered pt. 83 in 1982). Their facts
  already existed; the Federal Register citation now comes first, with its
  date, so the page shows the determination rather than "25 C.F.R. Part 83".

It also writes a search log for every federal nation (topic
recognition-basis), saying where the project looked. Run from the
repository root:

  python3 scripts/tribes/recognition_basis.py

Running it twice changes nothing.
"""
import re
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
TRIBES = ROOT / "content" / "tribes"
SOURCES = ROOT / "content" / "sources"
LOGS = ROOT / "research" / "search-logs" / "recognition-basis"
SESSION = "2026-11-23-recognition-basis"
TODAY = "2026-11-23"
LIST_SOURCE = "bia-recognized-entities-2026"

# Acts of Congress: source key -> facts about the Act. `first` is the
# Statutes at Large page the Act begins on; `date` the day it was approved.
ACTS = {
    "public-law-93-197": dict(name="Menominee Restoration Act", law="93-197", volume=87, first=770, date="1973-12-22"),
    "public-law-95-195": dict(name="Siletz Indian Tribe Restoration Act", law="95-195", volume=91, first=1415, date="1977-11-18"),
    "public-law-95-281": dict(name=None, law="95-281", volume=92, first=246, date="1978-05-15",
                              purpose="To reinstate the Modoc, Wyandotte, Peoria, and Ottawa Indian Tribes of Oklahoma as federally supervised and recognized Indian tribes"),
    "public-law-95-375": dict(name=None, law="95-375", volume=92, first=712, date="1978-09-18",
                              purpose="To provide for the extension of certain Federal benefits, services, and assistance to the Pascua Yaqui Indians of Arizona"),
    "public-law-96-227": dict(name="Paiute Indian Tribe of Utah Restoration Act", law="96-227", volume=94, first=317, date="1980-04-03"),
    "public-law-96-420": dict(name="Maine Indian Claims Settlement Act of 1980", law="96-420", volume=94, first=1785, date="1980-10-10"),
    "public-law-97-391": dict(name="Cow Creek Band of Umpqua Tribe of Indians Recognition Act", law="97-391", volume=96, first=1960, date="1982-12-29"),
    "public-law-97-429": dict(name="Texas Band of Kickapoo Act", law="97-429", volume=96, first=2269, date="1983-01-08"),
    "public-law-98-134": dict(name="Mashantucket Pequot Indian Claims Settlement Act", law="98-134", volume=97, first=851, date="1983-10-18"),
    "public-law-98-165": dict(name="Grand Ronde Restoration Act", law="98-165", volume=97, first=1064, date="1983-11-22"),
    "public-law-98-481": dict(name="Coos, Lower Umpqua, and Siuslaw Restoration Act", law="98-481", volume=98, first=2250, date="1984-10-17"),
    "public-law-99-398": dict(name="Klamath Indian Tribe Restoration Act", law="99-398", volume=100, first=849, date="1986-08-27"),
    "public-law-100-89": dict(name="Ysleta del Sur Pueblo and Alabama and Coushatta Indian Tribes of Texas Restoration Act", law="100-89", volume=101, first=666, date="1987-08-18"),
    "public-law-100-420": dict(name="Lac Vieux Desert Band of Lake Superior Chippewa Indians Act", law="100-420", volume=102, first=1577, date="1988-09-08"),
    "public-law-101-42": dict(name="Coquille Restoration Act", law="101-42", volume=103, first=91, date="1989-06-28"),
    "public-law-101-484": dict(name="Ponca Restoration Act", law="101-484", volume=104, first=1167, date="1990-10-31"),
    "public-law-102-171": dict(name="Aroostook Band of Micmacs Settlement Act", law="102-171", volume=105, first=1143, date="1991-11-26"),
    "public-law-103-116": dict(name="Catawba Indian Tribe of South Carolina Land Claims Settlement Act of 1993", law="103-116", volume=107, first=1118, date="1993-10-27"),
    "public-law-103-323": dict(name=None, law="103-323", volume=108, first=2152, date="1994-09-21",
                               purpose="To restore Federal services to the Pokagon Band of Potawatomi Indians"),
    "public-law-103-324": dict(name="Little Traverse Bay Bands of Odawa Indians and the Little River Band of Ottawa Indians Act", law="103-324", volume=108, first=2156, date="1994-09-21"),
    "public-law-103-434": dict(name="Auburn Indian Restoration Act", law="103-434", volume=108, first=4526, date="1994-10-31"),
    "public-law-103-454": dict(name=None, law="103-454", volume=108, first=4791, date="1994-11-02",
                               purpose="To provide for the annual publication of a list of federally recognized Indian tribes, and for other purposes; title II is the Tlingit and Haida Status Clarification Act and title III the Paskenta Band Restoration Act"),
    "public-law-106-568": dict(name=None, law="106-568", volume=114, first=2868, date="2000-12-27",
                               purpose="Omnibus Indian Advancement Act; title VII is the Shawnee Tribe Status Act of 2000 and title XIV the Graton Rancheria Restoration Act"),
    "public-law-115-121": dict(name="Thomasina E. Jordan Indian Tribes of Virginia Federal Recognition Act of 2017", law="115-121", volume=132, first=40, date="2018-01-29"),
    "public-law-116-92-section-2870": dict(name="National Defense Authorization Act for Fiscal Year 2020", law="116-92", volume=133, first=1198, date="2019-12-20"),
    "public-law-119-60": dict(name="Lumbee Fairness Act", law="119-60", volume=139, first=718, date="2025-12-18",
                              purpose="National Defense Authorization Act for Fiscal Year 2026; section 8803 is the Lumbee Fairness Act"),
}

MONTHS = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."]


def written_date(iso: str) -> str:
    year, month, day = (int(part) for part in iso.split("-"))
    return f"{MONTHS[month - 1]} {day}, {year}"


def act_citation(key: str, section: str, pin: str, name: str | None = None) -> str:
    """An Indigo Book citation of one section of an Act, such as
    "Menominee Restoration Act, Pub. L. No. 93-197, § 3(a), 87 Stat. 770, 770 (1973)"."""
    act = ACTS[key]
    name = name or act["name"]
    body = f"Pub. L. No. {act['law']}, {section}, {act['volume']} Stat. {act['first']}, {pin}"
    if name:
        return f"{name}, {body} ({act['date'][:4]})"
    return f"Act of {written_date(act['date'])}, {body}"


# Nation -> (Act source key, section, pinpoint page, short title of the part
# of the Act, if it has its own, and a note for the reader).
LEGISLATED = {
    "menominee-indian-tribe-of-wisconsin": ("public-law-93-197", "§ 3(a)", "770", None, None),
    "confederated-tribes-of-siletz-indians-of-oregon": ("public-law-95-195", "§ 3(a)", "1415", None, None),
    "wyandotte-nation": ("public-law-95-281", "§ 1(a)", "246", None, "Section 1(a) extends or confirms federal recognition of the Wyandotte, Ottawa and Peoria Tribes of Oklahoma; section 1(b) repeals the 1956 Acts that terminated them."),
    "ottawa-tribe-of-oklahoma": ("public-law-95-281", "§ 1(a)", "246", None, "Section 1(a) extends or confirms federal recognition of the Wyandotte, Ottawa and Peoria Tribes of Oklahoma; section 1(b) repeals the 1956 Acts that terminated them."),
    "peoria-tribe-of-indians-of-oklahoma": ("public-law-95-281", "§ 1(a)", "246", None, "Section 1(a) extends or confirms federal recognition of the Wyandotte, Ottawa and Peoria Tribes of Oklahoma; section 1(b) repeals the 1956 Acts that terminated them."),
    "modoc-nation": ("public-law-95-281", "§ 2(a)(1)", "246", None, "Section 2(a)(1) recognizes the Modoc Indian Tribe of Oklahoma; the Act's title is 'To reinstate the Modoc, Wyandotte, Peoria, and Ottawa Indian Tribes of Oklahoma as federally supervised and recognized Indian tribes'."),
    "pascua-yaqui-tribe-of-arizona": ("public-law-95-375", "§ 1(a)", "712", None, "Section 1(a) recognizes the Pascua Yaqui Indians as eligible for the services the United States provides to Indians because of their status as Indians, and section 1(b) extends the Indian Reorganization Act to them."),
    "paiute-indian-tribe-of-utah": ("public-law-96-227", "§ 3(a)", "317", None, "Section 3(a) restores the federal trust relationship to the Shivwits, Kanosh, Koosharem and Indian Peaks Bands and restores or confirms it for the Cedar City Band."),
    "houlton-band-of-maliseet-indians": ("public-law-96-420", "§ 6(i)", "1794", None, "Section 6(i) treats the Band, with the Passamaquoddy Tribe and the Penobscot Nation, as a federally recognized tribe; section 7(b), 94 Stat. 1795, refers to 'the recognition extended the Houlton Band of Maliseet Indians'."),
    "cow-creek-band-of-umpqua-tribe-of-indians": ("public-law-97-391", "§ 3(a)", "1960", None, None),
    "kickapoo-traditional-tribe-of-texas": ("public-law-97-429", "§ 2(b)", "2269", None, "The Act's title is 'To grant Federal recognition to the Texas Band of Kickapoo Indians'; section 2(b) declares that the Band should be recognized by the United States. It treats the Band as a subgroup of the Kickapoo Tribe of Oklahoma."),
    "mashantucket-pequot-indian-tribe": ("public-law-98-134", "§ 9", "855", None, None),
    "confederated-tribes-of-the-grand-ronde-community-of-oregon": ("public-law-98-165", "§ 4(a)", "1064", None, None),
    "confederated-tribes-of-the-coos-lower-umpqua-and-siuslaw-indians": ("public-law-98-481", "§ 3(a)", "2250", None, None),
    "klamath-tribes": ("public-law-99-398", "§ 2(a)", "849", None, None),
    "ysleta-del-sur-pueblo": ("public-law-100-89", "tit. I, § 103(a)", "667", None, "Section 103(a) restores the federal trust relationship with the Pueblo."),
    "alabama-coushatta-tribe-of-texas": ("public-law-100-89", "tit. II, § 203(a)", "670", None, "Section 203 restores the federal trust relationship with the Tribe."),
    "lac-vieux-desert-band-of-lake-superior-chippewa-indians-of-michigan": ("public-law-100-420", "§ 4(a)", "1577", None, "Section 4(a) reaffirms the Band's federal recognition and recognizes it as an independent tribal entity."),
    "coquille-indian-tribe": ("public-law-101-42", "§ 3(a)", "91", None, None),
    "ponca-tribe-of-nebraska": ("public-law-101-484", "§ 3", "1167", None, None),
    "mikmaq-nation": ("public-law-102-171", "§ 6(a)", "1148", None, "The Act extends federal recognition to the Aroostook Band of Micmacs, the nation's name on the list before it became the Mi'kmaq Nation."),
    "catawba-indian-nation": ("public-law-103-116", "§ 4(a)", "1121", None, "Section 4(a) restores the federal trust relationship with the Tribe."),
    "pokagon-band-of-potawatomi-indians": ("public-law-103-323", "§ 2", "2153", None, "Section 2 affirms the Band's federal recognition."),
    "little-traverse-bay-bands-of-odawa-indians": ("public-law-103-324", "§ 4(a)", "2157", None, "Section 4(a) reaffirms the federal recognition of the Little Traverse Bay Bands and the Little River Band."),
    "little-river-band-of-ottawa-indians": ("public-law-103-324", "§ 4(a)", "2157", None, "Section 4(a) reaffirms the federal recognition of the Little Traverse Bay Bands and the Little River Band."),
    "united-auburn-indian-community-of-the-auburn-rancheria-of-california": ("public-law-103-434", "tit. II, § 202(a)", "4533", "Auburn Indian Restoration Act", None),
    "central-council-of-the-tlingit-and-haida-indian-tribes": ("public-law-103-454", "tit. II, § 203", "4792", "Tlingit and Haida Status Clarification Act", "Section 203 reaffirms that the Central Council is a federally recognized Indian tribe."),
    "paskenta-band-of-nomlaki-indians-of-california": ("public-law-103-454", "tit. III, § 303(a)", "4793", "Paskenta Band Restoration Act", None),
    "shawnee-tribe": ("public-law-106-568", "tit. VII, § 704(a)", "2914", "Shawnee Tribe Status Act of 2000", "Section 704(a) reaffirms the Tribe's federal recognition."),
    "federated-indians-of-graton-rancheria": ("public-law-106-568", "tit. XIV, § 1404(a)", "2939", "Graton Rancheria Restoration Act", None),
    "chickahominy-indian-tribe": ("public-law-115-121", "tit. I, § 103(a)", "43", None, None),
    "chickahominy-indian-tribe-eastern-division": ("public-law-115-121", "tit. II, § 203(a)", "46", None, None),
    "upper-mattaponi-tribe": ("public-law-115-121", "tit. III, § 303(a)", "49", None, None),
    "rappahannock-tribe-inc": ("public-law-115-121", "tit. IV, § 403(a)", "55", None, None),
    "monacan-indian-nation": ("public-law-115-121", "tit. V, § 503(a)", "58", None, None),
    "nansemond-indian-nation": ("public-law-115-121", "tit. VI, § 603(a)", "61", None, None),
    "little-shell-tribe-of-chippewa-indians-of-montana": ("public-law-116-92-section-2870", "§ 2870(c)", "1908", None, None),
    "lumbee-tribe-of-north-carolina": ("public-law-119-60", "§ 8803(b)", "1971–72", None, "Section 8803(b) adds a section 4 to the Act of June 7, 1956, extending federal recognition to the Lumbee Tribe of North Carolina. The list notice states that the Act sets conditions on eligibility for federal services."),
}

# Extra words kept after the citation of an Act, from the fact it replaces.
TRAILING = {
    "little-shell-tribe-of-chippewa-indians-of-montana": "; earlier final determination against federal acknowledgment, 74 Fed. Reg. 56861 (Nov. 3, 2009)",
}

PART83 = " (acknowledgment under the federal acknowledgment regulations, now 25 C.F.R. pt. 83)"

# Nation -> its final determinations, as cited. Titles are given only where
# the Federal Register's own index gives them (from 1994).
DETERMINED = {
    "grand-traverse-band-of-ottawa-and-chippewa-indians": "Final determination, 45 Fed. Reg. 19322 (Mar. 25, 1980)",
    "jamestown-sklallam-tribe": "Final determination, 45 Fed. Reg. 81890 (Dec. 12, 1980)",
    "tunica-biloxi-indian-tribe": "Final determination, 46 Fed. Reg. 38411 (July 27, 1981)",
    "timbisha-shoshone-tribe": "Final determination, 47 Fed. Reg. 50109 (Nov. 4, 1982)",
    "narragansett-indian-tribe": "Final determination, 48 Fed. Reg. 6177 (Feb. 10, 1983)",
    "poarch-band-of-creek-indians": "Final determination, 49 Fed. Reg. 24083 (June 11, 1984)",
    "wampanoag-tribe-of-gay-head": "Final determination, 52 Fed. Reg. 4193 (Feb. 10, 1987)",
    "san-juan-southern-paiute-tribe-of-arizona": "Final determination, 54 Fed. Reg. 51502 (Dec. 15, 1989), corrected, 54 Fed. Reg. 53799 (Dec. 29, 1989)",
    "mohegan-tribe-of-indians-of-connecticut": "Final Determination That the Mohegan Indian Tribe of Connecticut, Inc., Does Exist as an Indian Tribe, 59 Fed. Reg. 12140 (Mar. 15, 1994)",
    "jena-band-of-choctaw-indians": "Final Determination for Federal Acknowledgment of the Jena Band of Choctaw Indians, 60 Fed. Reg. 28480 (May 31, 1995)",
    "nottawaseppi-huron-band-of-the-potawatomi": "Final Determination for Federal Acknowledgment of the Huron Potawatomi, Inc., 60 Fed. Reg. 66315 (Dec. 21, 1995)",
    "samish-indian-nation": "Final Determination for Federal Acknowledgment of the Samish Tribal Organization as an Indian Tribe, 61 Fed. Reg. 15825 (Apr. 9, 1996); Supplemental Final Determination, 61 Fed. Reg. 26922 (May 29, 1996)",
    "snoqualmie-indian-tribe": "Final Determination To Acknowledge the Snoqualmie Tribal Organization, 62 Fed. Reg. 45864 (Aug. 29, 1997)",
    "match-e-be-nash-she-wish-band-of-pottawatomi": "Final Determination to Acknowledge the Match-e-be-nash-she-wish Band of Pottawatomi Indians of Michigan, 63 Fed. Reg. 56936 (Oct. 23, 1998)",
    "cowlitz-indian-tribe": "Reconsidered Final Determination for Federal Acknowledgment of the Cowlitz Indian Tribe, 67 Fed. Reg. 607 (Jan. 4, 2002); Final Determination To Acknowledge the Cowlitz Indian Tribe, 65 Fed. Reg. 8436 (Feb. 18, 2000)",
    "mashpee-wampanoag-tribe": "Final Determination for Federal Acknowledgment of the Mashpee Wampanoag Indian Tribal Council, Inc. of Massachusetts, 72 Fed. Reg. 8007 (Feb. 22, 2007)",
    "shinnecock-indian-nation": "Final Determination for Federal Acknowledgment of the Shinnecock Indian Nation, 75 Fed. Reg. 34760 (June 18, 2010)",
    "pamunkey-indian-tribe": "Final Determination for Federal Acknowledgment of the Pamunkey Indian Tribe, 80 Fed. Reg. 39144 (July 8, 2015)",
}

# Rancherias restored by the court order of Dec. 22, 1983 in Tillie Hardwick v.
# United States. The project does not hold the order; the Indian Health Service's
# notice of Aug. 25, 1988 marks each of these 17 entries in its table with note 3,
# "Restored by Court Order issued December 22, 1983, in Tillie Hardwick v. U.S.,
# Civil No. C-79-1910-SW, U.S. District Court for the Northern District of
# California" (53 Fed. Reg. 32463). Read on the page images on Nov. 27, 2026.
# Nation -> (page of its entry in the notice's table, name the notice gives it).
HARDWICK_NOTICE = "ihs-health-service-delivery-areas-1988"
JUDGED_SEARCHED = "2026-11-27"
JUDGED = {
    "big-valley-band-of-pomo-indians-of-the-big-valley-rancheria": ("32460", "Big Valley Rancheria"),
    "blue-lake-rancheria": ("32460", "Blue Lake Rancheria"),
    "buena-vista-rancheria-of-me-wuk-indians-of-california": ("32460", "Buena Vista Rancheria"),
    "chicken-ranch-rancheria-of-me-wuk-indians-of-california": ("32460", "Chicken Ranch Rancheria"),
    "cloverdale-rancheria-of-pomo-indians-of-california": ("32460", "Cloverdale Rancheria"),
    "elk-valley-rancheria": ("32461", "Elk Valley Rancheria"),
    "greenville-rancheria": ("32461", "Greenville Rancheria"),
    "mooretown-rancheria-of-maidu-indians-of-california": ("32462", "Mooretown Rancheria"),
    "northfork-rancheria-of-mono-indians-of-california": ("32462", "North Fork Rancheria"),
    "picayune-rancheria-of-chukchansi-indians-of-california": ("32462", "Picayune Rancheria"),
    "pinoleville-pomo-nation": ("32462", "Pinoleville Rancheria"),
    "potter-valley-tribe": ("32462", "Potter Valley Rancheria"),
    "quartz-valley-indian-community-of-the-quartz-valley-reservation-of-california": ("32462", "Quartz Valley Rancheria"),
    "redding-rancheria": ("32462", "Redding Rancheria"),
    "redwood-valley-or-little-river-band-of-pomo-indians-of-the-redwood-valley-rancheria-california": ("32462", "Redwood Valley Rancheria"),
    "bear-river-band-of-the-rohnerville-rancheria": ("32462", "Rohnerville Rancheria"),
    "tolowa-dee-ni-nation": ("32462", "Smith River Rancheria"),
}
JUDGMENT = "Tillie Hardwick v. United States, No. C-79-1910-SW (N.D. Cal. Dec. 22, 1983) (order restoring the rancheria)"
NOTICE = ("Geographic Composition of the Health Service Delivery Areas (HSDA) Established by Regulations of the Indian "
          "Health Service, 53 Fed. Reg. 32460, {page} (Aug. 25, 1988)")


def judged_fact(identifier: str) -> tuple[dict, str]:
    page, listed = JUDGED[identifier]
    pin = f"{page}, 32463 n.3"
    citation = f"{JUDGMENT}, noted in {NOTICE.format(page=pin)}"
    fact = {
        "type": "federal",
        "legal_basis": citation,
        "since": "1983-12-22",
        "source": HARDWICK_NOTICE,
        "confidence": "high",
        "verification": "read-in-full",
        "as_of": "1988-08-25",
        "locator": f"53 Fed. Reg. {page} (table entry \"{listed}\", note 3) and 32463 (note 3)",
        "note": (f"The Indian Health Service's table of health service delivery areas marks the entry \"{listed}\" with note 3, "
                 "\"Restored by Court Order issued December 22, 1983, in Tillie Hardwick v. U.S., Civil No. C-79-1910-SW, U.S. "
                 "District Court for the Northern District of California\". The project does not hold the order itself."),
    }
    return fact, citation


# Nations whose own basis is an administrative decision without a Federal
# Register citation the project holds: left as the source words them.
ADMINISTRATIVE = {"ione-band-of-miwok-indians-of-california", "tejon-indian-tribe"}


def dump(value) -> str:
    """YAML with no line breaks inside a value (the project does not hard-wrap prose)."""
    return yaml.safe_dump(value, allow_unicode=True, sort_keys=False, width=float("inf"))


def profile_path(identifier: str) -> Path:
    folder = identifier[0] if identifier[0].isalpha() else "_other"
    return TRIBES / folder / f"{identifier}.yaml"


def replace_recognition(path: Path, recognition: list) -> bool:
    """Rewrites the profile's recognition block, leaving every other line as it is."""
    text = path.read_text()
    lines = text.split("\n")
    start = lines.index("recognition:")
    end = start + 1
    while end < len(lines) and (lines[end].startswith(" ") or lines[end].startswith("-") or lines[end] == ""):
        end += 1
    block = dump({"recognition": recognition}).rstrip("\n").split("\n")
    new = "\n".join(lines[:start] + block + lines[end:])
    if new == text:
        return False
    before = yaml.safe_load(text)
    after = yaml.safe_load(new)
    before["recognition"] = recognition
    if before != after:
        raise SystemExit(f"{path}: rewriting the recognition block changed something else")
    path.write_text(new)
    return True


def act_fact(identifier: str) -> tuple[dict, str]:
    key, section, pin, name, note = LEGISLATED[identifier]
    citation = act_citation(key, section, pin, name) + TRAILING.get(identifier, "")
    act = ACTS[key]
    fact = {
        "type": "federal",
        "legal_basis": citation,
        "since": act["date"],
        "source": key,
        "confidence": "high",
        "verification": "read-in-full",
        "as_of": act["date"],
        "locator": f"{section}, {act['volume']} Stat. {pin}",
    }
    if note:
        fact["note"] = note
    return fact, citation


def update_profile(identifier: str) -> str | None:
    """Rewrites one nation's recognition facts. Returns the citation added, if any."""
    path = profile_path(identifier)
    record = yaml.safe_load(path.read_text())
    recognition = [dict(fact) for fact in record["recognition"]]
    own = None
    if identifier in LEGISLATED:
        fact, own = act_fact(identifier)
        for existing in recognition:
            if existing.get("type") != "federal" or existing is fact:
                continue
            if existing.get("source") == LIST_SOURCE and not existing.get("petition_number"):
                continue
            # A fact from the acknowledgment list or the Act about the same
            # recognition: the same citation, so the page shows it once.
            existing["legal_basis"] = own
        if not any(existing.get("source") == fact["source"] for existing in recognition):
            index = next(i for i, existing in enumerate(recognition) if existing.get("source") == LIST_SOURCE) + 1
            recognition.insert(index, fact)
    elif identifier in JUDGED:
        fact, own = judged_fact(identifier)
        recognition = [existing for existing in recognition if existing.get("source") != HARDWICK_NOTICE]
        index = next(i for i, existing in enumerate(recognition) if existing.get("source") == LIST_SOURCE) + 1
        recognition.insert(index, fact)
    elif identifier in DETERMINED:
        own = DETERMINED[identifier] + PART83
        for existing in recognition:
            if existing.get("type") == "federal" and "Part 83" in existing.get("legal_basis", "") or (
                existing.get("type") == "federal" and existing.get("legal_basis", "").startswith(DETERMINED[identifier])
            ):
                existing["legal_basis"] = own
    replace_recognition(path, recognition)
    return own


def source_record(key: str) -> None:
    """A source record for an Act that has none yet."""
    act = ACTS[key]
    letter = key[0]
    path = SOURCES / letter / f"{key}.yaml"
    if path.exists():
        return
    year, month, day = (int(part) for part in act["date"].split("-"))
    plain = f"Pub. L. No. {act['law']}, {act['volume']} Stat. {act['first']} ({year})"
    title = f"{act['name']}, {plain}" if act["name"] else f"Act of {written_date(act['date'])}, Pub. L. No. {act['law']}, {act['volume']} Stat. {act['first']}"
    link = f"https://www.govinfo.gov/link/statute/{act['volume']}/{act['first']}"
    cite = f"{act['volume']}%20Stat.%20{act['first']}"
    purpose = f" Its long title or contents: {act['purpose']}." if act.get("purpose") else ""
    record = {
        "key": key,
        "kind": "federal-statute",
        "citation": {
            "type": "legislation",
            "title": title,
            "author": [{"literal": "United States Congress"}],
            "issued": {"date-parts": [[year, month, day]]},
            "URL": link,
            "accessed": {"date-parts": [[2026, 11, 23]]},
        },
        "original_link": link,
        "retrieved": TODAY,
        "archives": [],
        "history": {"status": "live", "last_checked": TODAY},
        "reading_links": {
            "checked": TODAY,
            "links": [
                {"site": "govinfo", "label": "GovInfo", "access": "official", "link": link},
                {"site": "westlaw", "label": "Westlaw", "access": "subscription",
                 "link": f"https://1.next.westlaw.com/Link/Document/FullText?findType=Y&cite={cite}"},
                {"site": "lexis", "label": "Lexis", "access": "subscription",
                 "link": f"https://advance.lexis.com/api/search?q={cite}"},
            ],
        },
        "rights": {
            "status": "no-permission-needed",
            "basis": "us-government-work",
            "basis_note": "A work of the United States government, not subject to copyright (17 U.S.C. § 105).",
            "redistribution": True,
        },
        "found_in": [SESSION],
        "notes": (f"Indigo Book citation: {title}{'' if act['name'] else f' ({year})'}.{purpose} Read the recognition or restoration "
                  "section in the Statutes at Large PDF from govinfo.gov (text extracted with pdftotext); the Legal Information "
                  "Institute's notes to Title 25 of the United States Code give the same public law, date and page. Classified "
                  "to Title 25 but omitted from the Code as being of special and not general application."),
    }
    path.write_text(dump(record))


def search_log(identifier: str, own: str | None) -> None:
    """The recognition-basis search log for one federal nation."""
    profile = f"content/tribes/{identifier[0] if identifier[0].isalpha() else '_other'}/{identifier}.yaml"
    places = [
        ("united-states-code", "https://www.law.cornell.edu/uscode/text/25/chapter-14",
         "Title 25, chapters 14 and 19 of the United States Code (Legal Information Institute tables of contents and section notes): Acts that recognize, restore or reaffirm a named tribe"),
        ("federal-register", "https://www.federalregister.gov/api/v1/documents.json",
         "Final determinations for federal acknowledgment already cited in the nation's profile from the Office of Federal Acknowledgment lists; their Federal Register dates and titles"),
    ]
    searches = []
    for kind, address, query in places:
        searches.append({
            "date": TODAY,
            "searched_by": "Claude (AI assistant)",
            "method": "script",
            "place_kind": kind,
            "address": address,
            "query": query,
            "outcome": "found" if own else "not-found",
            "reason": (f"Cited: {own}." if own else
                       "No Act of Congress or final determination naming this nation in the places searched."),
        })
        if own:
            break
    log = {
        "profile": profile,
        "topic": "recognition-basis",
        "status": "found" if own else "partly-searched",
        "last_searched": TODAY,
        "searches": searches,
    }
    if not own:
        log["next_steps"] = (
            "Not searched yet: court judgments that restored terminated California rancherias (for example Tillie Hardwick "
            "v. United States, N.D. Cal. 1983, and Scotts Valley Band v. United States, N.D. Cal. 1991), administrative "
            "recognitions before the 1978 acknowledgment regulations, Acts outside Title 25 chapters 14 and 19, and, for "
            "nations recognized through treaties or the Indian Reorganization Act, the instrument that first organized the "
            "government. Until then the Bureau of Indian Affairs list is the document cited.")
    path = LOGS / (identifier[0] if identifier[0].isalpha() else "_other") / f"{identifier}.yaml"
    path.parent.mkdir(parents=True, exist_ok=True)
    if identifier in JUDGED and path.exists():
        # The search of Nov. 27, 2026 that found the Hardwick restoration is added to the log of Nov. 23.
        existing = yaml.safe_load(path.read_text())
        if not any(search.get("date") == JUDGED_SEARCHED for search in existing.get("searches") or []):
            existing["searches"].append({
                "date": JUDGED_SEARCHED,
                "searched_by": "Claude (AI assistant)",
                "method": "by-hand",
                "place_kind": "federal-register",
                "address": "https://api.govinfo.gov/search",
                "query": "GovInfo full-text search of the Federal Register for \"Tillie Hardwick\"; the notice found was read on its page images",
                "outcome": "found",
                "reason": f"Cited: {own}.",
            })
            existing["status"] = "found"
            existing["last_searched"] = JUDGED_SEARCHED
            existing.pop("next_steps", None)
            path.write_text(dump(existing))
        return
    if path.exists():
        existing = yaml.safe_load(path.read_text())
        if existing.get("searches") and existing["searches"][0].get("date") == TODAY:
            return
    path.write_text(dump(log))


def federal_nations() -> list[str]:
    found = []
    for path in sorted(TRIBES.glob("*/*.yaml")):
        record = yaml.safe_load(path.read_text())
        if any(fact.get("source") == LIST_SOURCE for fact in record.get("recognition") or []):
            found.append(record["id"])
    return found


def main() -> None:
    nations = federal_nations()
    missing = [identifier for identifier in [*LEGISLATED, *DETERMINED, *JUDGED, *ADMINISTRATIVE] if identifier not in nations]
    if missing:
        raise SystemExit(f"not federal nations in the dataset: {missing}")
    for key in sorted({LEGISLATED[identifier][0] for identifier in LEGISLATED}):
        source_record(key)
    found = 0
    for identifier in nations:
        own = update_profile(identifier) if identifier in LEGISLATED or identifier in DETERMINED or identifier in JUDGED else None
        if identifier in ADMINISTRATIVE:
            own = ("the administrative decision the Office of Federal Acknowledgment list records, worded as the list words "
                   "it; no Federal Register notice of it was found")
        search_log(identifier, own)
        found += bool(own)
    print(f"{len(nations)} federal nations; own basis cited for {found}")


if __name__ == "__main__":
    main()
