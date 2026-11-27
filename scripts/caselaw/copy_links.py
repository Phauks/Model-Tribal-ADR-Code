"""Links for the citations in the opinion pages built from the Caselaw Access Project.

The Project's HTML marks every citation it found as <a class="citation">, with the
cited text in data-cite and, when the Project matched it to one of its own cases,
that case's path in data-case-paths ("/us/30/0001-01"). Its links are relative to
case.law, and the ones it could not match point at a search page that case.law no
longer has, so none of them work on this site as they are.

`CitationLinks` rewrites them when a page is built, before it goes to R2 (the
website itself does no rewriting):

1. When the project holds the cited case or law, the citation links to its page on
   this site: a record page (/cases/<key>, /laws/<key>) or, for an opinion that has
   no record but is served as a copy, the copy's reading page (/copies/view/<key>).
   These open in the reader's window (target="_top"), outside the copy's frame.
2. When the Project matched the citation to a case the project does not hold, and
   `external` is on, it links to that case on case.law, marked as leaving the site
   (class="external", opens in a new tab).
3. Otherwise the citation stays as plain text. Nothing is dropped.

Page numbers (#p282) and footnote links inside the page are kept as they are.
"""

from __future__ import annotations

import csv
import html
import json
import re
import urllib.parse
from collections import Counter
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
SOURCES = ROOT / "content" / "sources"
CAPTURE_INDEX = ROOT / "research" / "capture-index.csv"
REPORTERS = ROOT / "research" / "tribal-court-opinions" / "cap-reporters.json"
CASE_LAW_VIEWER = "https://case.law/caselaw/"
COPY_TOPICS = {"caselaw-access-project", "state-court-opinions", "federal-court-opinions"}
LAW_KINDS = {"federal-statute", "federal-regulation", "federal-register-notice", "federal-agency-document", "executive-order"}

CAP_LINK = re.compile(r"static\.case\.law/([^/]+)/([^/]+)/(?:html|cases)/([^/.]+)\.(?:html|json)")
ANCHOR = re.compile(r"<a\b([^>]*)>(.*?)</a>", re.S)
ATTRIBUTE = re.compile(r"([\w-]+)=(\"[^\"]*\"|'[^']*')")


def normalize(cite: str) -> str:
    """"61 N.Y.S. 281", "61 NYS 281" and "61 N. Y. S. 281" alike; "19 Hun, 540" as "19 Hun 540"."""
    return re.sub(r"[\s.,]", "", cite or "").lower()


def reporter_names() -> dict[str, str]:
    """The Project's reporter slugs and their short names ("nys" -> "N.Y.S."), cached in the repository."""
    if REPORTERS.exists():
        return json.loads(REPORTERS.read_text(encoding="utf-8"))
    import sys  # noqa: PLC0415
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from caselaw_sources import CASELAW_ACCESS_PROJECT, fetch_bytes  # noqa: PLC0415
    names = {row["slug"]: row["short_name"] for row in json.loads(fetch_bytes(f"{CASELAW_ACCESS_PROJECT}/ReportersMetadata.json"))}
    REPORTERS.parent.mkdir(parents=True, exist_ok=True)
    REPORTERS.write_text(json.dumps(names, indent=0, sort_keys=True) + "\n", encoding="utf-8")
    return names


def path_cite(path: str, names: dict[str, str]) -> str | None:
    """"/us/30/0001-01" as "30 U.S. 1": the volume, the reporter's short name and the first page."""
    parts = path.strip("/").split("/")
    if len(parts) != 3 or parts[0] not in names:
        return None
    page = re.match(r"0*(\d+)", parts[2])
    return f"{parts[1]} {names[parts[0]]} {page.group(1)}" if page else None


class CitationLinks:
    def __init__(self, external: bool = True) -> None:
        self.external = external
        self.names = reporter_names()
        self.by_cite: dict[str, str] = {}
        self.by_path: dict[str, str] = {}
        self.counts: Counter = Counter()
        self._read_records()
        self._read_copies()

    def _add_cite(self, cite: str, link: str) -> None:
        key = normalize(cite)
        if key and re.search(r"\d", key):
            self.by_cite.setdefault(key, link)

    def _read_records(self) -> None:
        loader = getattr(yaml, "CSafeLoader", yaml.SafeLoader)
        for path in sorted(SOURCES.rglob("*.yaml")):
            text = path.read_text(encoding="utf-8")
            if "legal_case" not in text and "kind: intergovernmental-agreement" not in text and not any(f"kind: {kind}" in text for kind in LAW_KINDS):
                continue
            record = yaml.load(text, Loader=loader) or {}
            citation = record.get("citation") or {}
            kind, type_ = record.get("kind"), citation.get("type")
            if type_ == "legal_case" and citation.get("title"):
                link = f"/cases/{record['key']}"
            elif kind in LAW_KINDS or (kind == "intergovernmental-agreement" and type_ == "treaty"):
                link = f"/laws/{record['key']}"
            else:
                continue
            container = citation.get("container-title") or ""
            if container == "United States Statutes at Large":
                container = "Stat."
            if citation.get("volume") and citation.get("page"):
                self._add_cite(f"{citation['volume']} {container} {citation['page']}", link)
            elif re.fullmatch(r"\d+ [A-Za-z. ]+ \d+", container):  # treaties: "7 Stat. 44"
                self._add_cite(container, link)
            published = re.match(r"Published at (.+?)\. Decided by", str(record.get("notes") or ""))
            if published:
                for cite in published.group(1).split(";"):
                    self._add_cite(cite.strip(), link)
            if (record.get("courtlistener") or {}).get("citation"):
                self._add_cite(record["courtlistener"]["citation"], link)
            for url in (record.get("original_link") or "", citation.get("URL") or ""):
                match = CAP_LINK.search(url)
                if match and link.startswith("/cases/"):
                    self.by_path.setdefault("/".join(match.groups()), link)

    def _read_copies(self) -> None:
        with open(CAPTURE_INDEX, newline="", encoding="utf-8") as handle:
            for row in csv.DictReader(handle):
                if row["topic"] not in COPY_TOPICS or row["media_type"] != "text/html" or row["redistribution"] != "yes":
                    continue
                parts = row["key"].removesuffix(".html").split("/")
                if len(parts) != 4:
                    continue
                path = "/".join(parts[1:])  # the Project's own path: reporter/volume/case
                self.by_path.setdefault(path, "/copies/view/" + urllib.parse.quote(row["key"]))

    def target(self, cite: str, paths: list[str]) -> tuple[str, str | None]:
        """("ours" | "external" | "text", link) for one citation."""
        for path in paths:
            if path.strip("/") in self.by_path:
                return "ours", self.by_path[path.strip("/")]
        for candidate in [cite] + [path_cite(path, self.names) or "" for path in paths]:
            if normalize(candidate) in self.by_cite:
                return "ours", self.by_cite[normalize(candidate)]
        if paths and self.external:
            reporter, volume, case = paths[0].strip("/").split("/")
            return "external", CASE_LAW_VIEWER + "?" + urllib.parse.urlencode({"reporter": reporter, "volume": volume, "case": case})
        return "text", None

    def rewrite(self, fragment: str, own_key: str = "") -> str:
        """The fragment with each citation linked as the module's docstring says. own_key: the page's own copy key, never linked to itself."""
        own = "/copies/view/" + urllib.parse.quote(own_key) if own_key else None

        def replace(match: re.Match) -> str:
            attributes = {name: html.unescape(value[1:-1]) for name, value in ATTRIBUTE.findall(match.group(1))}
            inner = match.group(2)
            if "citation" not in attributes.get("class", "").split():
                href = attributes.get("href", "")
                if href.startswith("#"):
                    return match.group(0)
                self.counts["other link"] += 1
                return match.group(0)
            paths = [p for p in attributes.get("data-case-paths", "").split(",") if p]
            kind, link = self.target(attributes.get("data-cite") or html.unescape(re.sub(r"<[^>]+>", "", inner)), paths)
            if link == own:
                kind, link = "text", None
            self.counts[kind] += 1
            if kind == "ours":
                return f'<a href="{html.escape(link)}" target="_top">{inner}</a>'
            if kind == "external":
                return f'<a class="external" href="{html.escape(link)}" target="_blank" rel="noopener" title="Opens on case.law">{inner}</a>'
            return inner

        return ANCHOR.sub(replace, fragment)

