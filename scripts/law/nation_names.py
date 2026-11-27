"""Find the Native nations a document's title or text names, by the names the
nation profiles give (content/tribes/: official, alternate, former and
self-designation names) and the names the National Indian Gaming
Commission's ordinance list uses for each nation
(research/gaming/ordinance-documents.csv). Shared by the tier 2 scripts
(scripts/law/ibia_decisions.py, nigc_documents.py and the others).

A name matches only whole words, after case, punctuation, "the", "of" and
the state's name in parentheses are set aside, and a longer name wins over a
shorter one inside it ("Cheyenne and Arapaho Tribes" over "Cheyenne"). A
name of one or two words that is also a common word or a place
("Crow", "Delaware", "Cherokee" alone) matches only when it is followed by a
word such as Tribe, Nation, Band or Indians.
"""
from __future__ import annotations

import csv
import re
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
SUFFIX = r"(?:tribe|tribes|nation|band|indians|indian|community|rancheria|pueblo|reservation)"
STOP = {"the", "of", "and"}
# A name made only of these words ("the Tribes", the Confederated Salish and Kootenai Tribes' own word for themselves) names no one nation in another text.
GENERIC = {"tribe", "tribes", "tribal", "nation", "nations", "band", "bands", "indian", "indians", "native", "people", "peoples", "community", "communities",
           "village", "villages", "pueblo", "pueblos", "rancheria", "reservation", "confederated", "american", "alaska"}
STATES = ("Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|"
          "Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|"
          "New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|"
          "South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming")


def normal(text: str) -> str:
    text = re.sub(r"\(([^)]*)\)", r" \1 ", text.lower())
    text = text.replace("&", " and ").replace("’", "'")
    text = re.sub(r"[^a-z0-9' ]+", " ", text).replace("'", "")
    return " " + " ".join(word for word in text.split() if word not in STOP) + " "


class NationNames:
    def __init__(self) -> None:
        self.by_name: dict[str, set[str]] = {}
        self.names: dict[str, str] = {}
        for path in sorted((ROOT / "content/tribes").rglob("*.yaml")):
            record = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
            nation = record.get("id")
            if not nation or record.get("entity_type", "native-nation") != "native-nation":
                continue
            names = record.get("names") or {}
            self.names[nation] = names.get("official", nation)
            found = [names.get("official", "")]
            for field in ("alternate", "former", "self_designation"):
                found += [entry.get("name", "") if isinstance(entry, dict) else str(entry) for entry in names.get(field) or []]
            for name in found:
                self._add(name, nation)
                # "..., Oklahoma" and "... of the X Reservation, Montana": the name without the state or reservation too.
                bare = re.sub(r",\s*[A-Z][A-Za-z ]+$", "", name)
                self._add(bare, nation)
                # "Kiowa Indian Tribe of Oklahoma": also "Kiowa Indian Tribe".
                shorter = re.sub(rf"\s+of\s+(?:the\s+)?(?:State\s+of\s+)?(?:{STATES})$", "", bare)
                self._add(shorter, nation)
                self._add(re.sub(r"\s+of\s+Indians\b", "", shorter), nation)
                # "Spokane Tribe of the Spokane Reservation": also "Spokane Tribe" (dropped when another nation shares it).
                self._add(re.sub(r"\s+of\s+the\s+[A-Z][\w' .-]+\s+Reservation$", "", shorter), nation)
        ordinances = ROOT / "research/gaming/ordinance-documents.csv"
        if ordinances.exists():
            for row in csv.DictReader(ordinances.open(encoding="utf-8")):
                if row.get("nations") and ";" not in row["nations"]:
                    self._add(row["list_nation_column"], row["nations"])
        self.ordered = sorted(self.by_name, key=len, reverse=True)

    def _add(self, name: str, nation: str) -> None:
        key = normal(name)
        if len(key.split()) >= 1 and len(key) > 4 and not set(key.split()) <= GENERIC:
            self.by_name.setdefault(key, set()).add(nation)

    def named(self, text: str) -> list[tuple[str, str]]:
        """Each nation the text names, with the words that name it there ("Cabazon Band of Mission Indians")."""
        out = []
        for nation in self.find(text):
            best = ""
            for name, nations in self.by_name.items():
                if nations != {nation}:
                    continue
                words = name.split()
                pattern = r"\b" + r"\W+(?:(?:the|of|and|&)\W+)*".join(re.escape(word) for word in words) + r"\b"
                match = re.search(pattern, text.replace("’", "'").replace("'", ""), re.IGNORECASE)
                if match and len(match.group(0)) > len(best):
                    best = match.group(0)
            if best:
                tail = re.match(r"\s+(?:Tribe|Tribes|Nation|Band|Indians|Community|Rancheria)\b", text[text.find(best) + len(best):] if best in text else "")
                out.append((nation, best + (tail.group(0) if tail else "")))
            else:
                out.append((nation, self.names[nation]))
        return out

    def find(self, text: str) -> list[str]:
        """The nations a title or passage names, longest names first, each nation once."""
        haystack = normal(text)
        found: list[str] = []
        for name in self.ordered:
            at = haystack.find(name)
            if at < 0:
                continue
            words = name.split()
            if len(words) <= 2 and not re.search(SUFFIX, name):
                if not re.match(r"\s*" + SUFFIX + r"\b", haystack[at + len(name) - 1:]):
                    continue
            # "Absentee Shawnee Tribe" is not the Shawnee Tribe: a word such as Absentee or Eastern before the name makes it another nation's.
            if re.search(r"\b(absentee|eastern|western|northern|southern|upper|lower|little|lac|red|white|st|saint|san|santa|mississippi|lower|bad)\s$", haystack[:at + 1]):
                continue
            nations = self.by_name[name]
            if len(nations) != 1:
                continue
            nation = next(iter(nations))
            if nation not in found:
                found.append(nation)
            haystack = haystack[:at] + " " * len(name) + haystack[at + len(name):]
        return found
