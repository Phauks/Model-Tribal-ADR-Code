"""Replace protected people's names in Tribal court opinions with initials.

The policy is in research/analyses/2026-11-24-redaction-practices-for-opinions.md
(PR #474) and Trevor's decisions of Nov. 24, 2026: children, protected persons,
child and sexual-offense victims, vulnerable adults, and parents in custody,
paternity and support cases are named by real initials, and so are relatives
whose names would identify them. Their addresses, birth dates and enrollment
numbers are removed.

The names map that drives this is private. It lives in the R2 bucket (key
NAMES_MAP_KEY) and in the project's private files, never in git, and names are
replaced when the pages are built. Each entry, keyed by the opinion's copy key:

    {
      "people": [{"role": "parent", "role_label": "Mother", "full_name": "...",
                  "court_initials": "", "variants": ["...", ...]}],
      "keep": ["names of people who keep their name but share a protected surname"],
      "details": [{"text": "DOB 04/08/1997", "kind": "birth_date"}],
      "reviewed": "2026-11-24"
    }

In the opinion's text every substitution is in brackets ("[J.D.]", Indigo Book
R8.2.3). In captions, titles and citations the initials go without brackets.
Initials a court already used are kept as the court wrote them.
"""

from __future__ import annotations

import html
import json
import re
import unicodedata
from dataclasses import dataclass, field

NAMES_MAP_KEY = "private/redaction/tribal-court-opinions-names-map.json"

DETAIL_WORDS = {
    "birth_date": "birth date removed",
    "address": "address removed",
    "enrollment_number": "enrollment number removed",
    "ssn": "number removed",
    "phone": "phone number removed",
    "school": "school removed",
    "location": "location removed",
}
HONORIFICS = ("Mr.", "Ms.", "Mrs.", "Miss", "Mx.", "Mr", "Ms", "Mrs")
SUFFIXES = {"jr", "jr.", "sr", "sr.", "ii", "iii", "iv"}
PRIVATE_USE = ""


def plain(text: str) -> str:
    """Letters without accents, for initials ("Á" gives "A")."""
    return "".join(c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c))


def name_words(full_name: str) -> list[str]:
    words = [w for w in re.split(r"\s+", full_name.strip()) if w]
    while words and words[-1].lower().strip(",") in SUFFIXES:
        words.pop()
    return [w.strip(",") for w in words]


def initials(full_name: str) -> str:
    """Real initials of the first and last name: "Jane Ann Doe" gives "J.D."; "Mary Smith-Jones" gives "M.S-J."."""
    words = [w for w in name_words(full_name) if re.search(r"[A-Za-zÀ-ÿ]", w)]
    if not words:
        return ""
    first = plain(re.sub(r"[^A-Za-zÀ-ÿ]", "", words[0]))[:1].upper()
    if len(words) == 1:
        return f"{first}."
    last = "-".join(plain(re.sub(r"[^A-Za-zÀ-ÿ]", "", part))[:1].upper() for part in words[-1].split("-") if part)
    return f"{first}.{last}."


@dataclass
class Person:
    role: str
    label: str  # the initials, the court's own designation, or a role word when initials collide
    full_name: str
    variants: list[str] = field(default_factory=list)


def people_of(entry: dict) -> list[Person]:
    """The protected people of one opinion, each with the label that replaces their name."""
    people = []
    for raw in entry.get("people", []):
        full = (raw.get("full_name") or "").strip()
        label = (raw.get("court_initials") or "").strip() or initials(full) or (raw.get("role_label") or "Name withheld").strip()
        people.append(Person(raw.get("role", ""), label, full, [v for v in raw.get("variants", []) if v and v.strip()]))
    # Two people with the same initials: name them by role instead ("[Mother]", "[Child 2]").
    counts: dict[str, int] = {}
    for person in people:
        counts[person.label] = counts.get(person.label, 0) + 1
    raws = entry.get("people", [])
    for person, raw in zip(people, raws):
        if counts[person.label] > 1 and not (raw.get("court_initials") or "").strip():
            person.label = role_word(raw.get("role_label") or person.role)
    # Two people with the same role word too: number them ("[Mother]", "[Mother 2]").
    renamed = [person for person, raw in zip(people, raws) if not (raw.get("court_initials") or "").strip()]
    seen: dict[str, int] = {}
    for person in renamed:
        if sum(1 for other in renamed if other.label == person.label) > 1:
            seen[person.label] = seen.get(person.label, 0) + 1
            if seen[person.label] > 1:
                person.label = f"{person.label} {seen[person.label]}"
    return people


def role_word(label: str) -> str:
    """A short role word: "Parent or guardian (cited case)" gives "Parent or guardian"."""
    word = re.sub(r"\s*\(.*?\)", "", label or "").strip()
    return (word[:1].upper() + word[1:]) if word else "Name withheld"


def generated_variants(person: Person) -> list[str]:
    """Forms of a name the finder may not have listed: full, first and last, capitals, titles."""
    words = name_words(person.full_name)
    if not words:
        return []
    forms = {person.full_name, " ".join(words)}
    if len(words) >= 2:
        forms.add(f"{words[0]} {words[-1]}")
        forms.add(f"{words[0]} {plain(words[-1])[:1].upper()}.")  # "Genevieve B.", as some captions shorten it
        for honorific in HONORIFICS:
            forms.add(f"{honorific} {words[-1]}")
            forms.add(f"{honorific} {' '.join(words)}")
    forms |= {f.upper() for f in list(forms)}
    return sorted(forms)


@dataclass
class Replacement:
    text: str
    label: str
    single_word: bool
    detail: bool = False


class Redactor:
    """Applies one opinion's entry from the names map."""

    def __init__(self, entry: dict) -> None:
        self.entry = entry
        self.people = people_of(entry)
        self.keep = sorted({k.strip() for k in entry.get("keep", []) if k and k.strip()}, key=len, reverse=True)
        by_text: dict[str, set[str]] = {}
        for person in self.people:
            for variant in set(person.variants) | set(generated_variants(person)):
                if same_designation(variant, person.label):
                    continue  # the court's own designation stays as the court wrote it
                by_text.setdefault(normalize(variant), set()).add(person.label)
        replacements = []
        for text, labels in by_text.items():
            if not text or self._is_kept(text):
                continue
            # A surname shared by two protected people: its initial alone ("[T.]").
            label = next(iter(labels)) if len(labels) == 1 else plain(text)[:1].upper() + "."
            replacements.append(Replacement(text, label, " " not in text))
        for detail in entry.get("details", []):
            text = normalize(detail.get("text", ""))
            if text:
                replacements.append(Replacement(text, DETAIL_WORDS.get(detail.get("kind", ""), "detail removed"), False, True))
        self.replacements = sorted(replacements, key=lambda r: len(r.text), reverse=True)
        self.lookup = {r.text.lower(): r for r in self.replacements}
        self.pattern = compile_alternation([r.text for r in self.replacements])
        self.keep_pattern = compile_alternation(self.keep)
        self.count = 0
        self.skipped: list[str] = []

    def _starts_other_name(self, text: str, end: int) -> bool:
        """Followed by a capitalized word that is not itself a protected name: someone else's full name."""
        following = re.match(r"\s+([A-Z][a-z][A-Za-z'’-]*)", text[end:end + 40])
        if following is None:
            return False
        word = following.group(1).rstrip("'’-").lower()
        if word in CALENDAR_WORDS:  # "served on Sam June 24"
            return False
        return word not in self.lookup and word.replace("-", "") not in self.lookup

    def _is_kept(self, text: str) -> bool:
        return any(text.lower() == k.lower() for k in self.keep)

    def text(self, value: str, *, brackets: bool = True) -> str:
        """The text with every protected name and detail replaced."""
        if not self.replacements:
            return value
        kept: list[str] = []

        def hold(match: re.Match) -> str:
            kept.append(match.group(0))
            return f"{PRIVATE_USE}{len(kept) - 1}{PRIVATE_USE}"

        held = self.keep_pattern.sub(hold, value) if self.keep else value

        def swap(match: re.Match) -> str:
            found = match.group(0)
            replacement = self.lookup.get(normalize(found).lower())
            if replacement is None:
                return found
            # One word on its own is a name only when it is capitalized ("Little", not "little"), and not when it
            # starts someone else's name ("David" in "David Smith" when another David is protected).
            if replacement.single_word and (not found[:1].isupper() or self._starts_other_name(match.string, match.end())
                                            or follows_title(match.string, match.start())):
                self.skipped.append(normalize(match.string[match.start():match.end() + 30]))
                return found
            self.count += 1
            if replacement.detail or brackets:
                return f"[{replacement.label}]"
            return replacement.label

        swapped = self.pattern.sub(swap, held)
        return re.sub(f"{PRIVATE_USE}(\\d+){PRIVATE_USE}", lambda m: kept[int(m.group(1))], swapped)

    def html(self, fragment: str) -> str:
        """The opinion's HTML with names replaced in its text, never inside tags. A name or detail broken by
        inline markup ("8<sup>th</sup> Court") is replaced whole first, markup and all."""
        # The Caselaw Access Project's citation links (href="/citations/?q=…") lead nowhere on this site and
        # sometimes carry other words in their address, such as a street address read as a citation.
        fragment = re.sub(r"<a\b[^>]*\bclass=\"citation\"[^>]*>(.*?)</a>", r"\1", fragment, flags=re.S)
        multiword = [r.text for r in self.replacements if not r.single_word]
        if multiword:
            spanning = compile_alternation(multiword, gap=INLINE_GAP)

            def across(match: re.Match) -> str:
                found = match.group(0)
                if "<" not in found:
                    return found
                replacement = self.lookup.get(normalize(re.sub(r"<[^>]*>", " ", re.sub(PAGE_LABEL, " ", found))).lower())
                if replacement is None:
                    return found
                self.count += 1
                # Page numbers inside the name stay, after the replacement.
                return f"[{replacement.label}]" + "".join(re.findall(PAGE_LABEL, found))

            fragment = spanning.sub(across, fragment)
        parts = re.split(r"(<[^>]*>)", fragment)
        return "".join(part if part.startswith("<") else escape_text(self.text(html.unescape(part))) for part in parts)

    def caption(self, value: str, fuller: str = "") -> str:
        """A caption, title or citation: initials without brackets, details dropped. When the short caption
        was only a name ("Baker" giving "B."), the fuller caption is used instead."""
        result = re.sub(r"\s*\[[a-z ]+ removed\]", "", self.text(value, brackets=False))
        if fuller and result != value and len(re.sub(r"[^A-Za-z]", "", result)) <= 4:
            result = re.sub(r"\s*\[[a-z ]+ removed\]", "", self.text(fuller, brackets=False)).rstrip(".")
        return result


def letters(text: str) -> str:
    return re.sub(r"[^A-Za-z0-9]", "", text).lower()


def same_designation(variant: str, label: str) -> bool:
    """A form of the label itself, such as "CMA" or "C. M. A." for "C.M.A.": left as the court wrote it."""
    return letters(variant) == letters(label)


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip())


# Between the words of a name: spaces, inline markup, or a page number the reporter put mid-name ("Mary Ann *265 Doe").
PAGE_LABEL = r"<a\b[^>]*\bclass=\"page-label\"[^>]*>[^<]*</a>"
INLINE_GAP = r"(?:\s|" + PAGE_LABEL + r"|</?(?:sup|sub|em|i|b|strong|span|u)\b[^>]*>)+"
CALENDAR_WORDS = {"january", "february", "march", "april", "may", "june", "july", "august", "september", "october",
                  "november", "december", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"}


OFFICIAL_TITLES = r"(?:Justices?|Judges?|Magistrate|Chief|Officer|Advocate|Attorney|Counsel(?:or)?|Clerk|Senator|Representative|President|Chairman|Chairwoman|Chairperson|Councilman|Councilwoman|Delegate|Director|Superintendent|Prosecutor|Hon\.|Honorable)"


def follows_title(text: str, start: int) -> bool:
    """The word just matched comes right after an official's title ("Justice Yazzie"): a judge or official,
    who keeps their name even when a protected person shares the surname."""
    return re.search(OFFICIAL_TITLES + r"\s+$", text[max(0, start - 40):start]) is not None


def compile_alternation(texts: list[str], gap: str = r"\s+") -> re.Pattern:
    if not texts:
        return re.compile(r"(?!x)x")
    pieces = [gap.join(re.escape(word) for word in t.split(" ")) for t in sorted(texts, key=len, reverse=True)]
    return re.compile(r"(?<![\w])(?:" + "|".join(pieces) + r")(?![\w])", re.IGNORECASE)


def escape_text(text: str) -> str:
    return html.escape(text, quote=False)


def visible_text(fragment: str) -> str:
    fragment = re.sub(r"<(style|script)\b.*?</\1>", " ", fragment, flags=re.S | re.I)
    return normalize(html.unescape(re.sub(r"<[^>]*>", " ", fragment)))


def leftovers(text: str, entry: dict) -> list[str]:
    """Problems that block showing a redacted opinion: a protected person's full name or any listed form of it,
    or a listed detail, still in the text outside the names of people who keep theirs. An empty list passes."""
    redactor = Redactor(entry)
    held = redactor.keep_pattern.sub(" ", text) if redactor.keep else text
    held = re.sub(r"\[[^\]]{1,40}\]", " ", held)  # our own replacements
    problems = []
    for person in redactor.people:
        for form in sorted({normalize(f) for f in set(person.variants) | set(generated_variants(person))}):
            if not form or redactor._is_kept(form):
                continue
            if same_designation(form, person.label):
                continue
            # A page number can sit inside a name in the visible text ("Mary Ann *265 Doe").
            matches = list(compile_alternation([form], gap=r"\s+(?:\*\d+\s*)?").finditer(held))
            if " " not in form:
                matches = [m for m in matches if m.group(0)[:1].isupper() and not redactor._starts_other_name(held, m.end())
                           and not follows_title(held, m.start())]
            hits = [m.group(0) for m in matches]
            if hits:
                problems.append(f"{person.label}: a listed form of the name remains {len(hits)} time(s)")
    for detail in entry.get("details", []):
        if normalize(detail.get("text", "")) and compile_alternation([normalize(detail["text"])]).search(held):
            problems.append(f"a {detail.get('kind', 'detail')} remains")
    return problems


def unlisted_words(text: str, entry: dict) -> list[tuple[str, int]]:
    """Name words the finder did not list on their own that still appear capitalized: for a person to check."""
    redactor = Redactor(entry)
    held = redactor.keep_pattern.sub(" ", text) if redactor.keep else text
    found = []
    for person in redactor.people:
        listed = {normalize(v).lower() for v in person.variants}
        for word in name_words(person.full_name):
            if len(re.sub(r"\W", "", word)) < 2 or word.lower() in listed:
                continue
            pattern = re.compile(r"(?<![\w])" + re.escape(word) + r"(?![\w])", re.IGNORECASE)
            hits = sum(1 for m in pattern.finditer(held) if m.group(0)[:1].isupper())
            if hits:
                found.append((f"{person.label}:{word}", hits))
    return found


def load_map(path) -> dict:
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)
