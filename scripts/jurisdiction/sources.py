"""Write source records (content/sources/<letter>/<key>.yaml) for the
jurisdiction and federal-relationship research, and save a private copy of
each document under research/captures/jurisdiction/ in the project files.
"""
import subprocess
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
CAPTURES = Path("/mnt/project-files/research/captures/jurisdiction")
SESSION = "2026-11-23-jurisdiction-and-federal-ties"


def dump(value) -> str:
    return yaml.safe_dump(value, allow_unicode=True, sort_keys=False, width=float("inf"))


def capture(key: str, url: str, suffix: str) -> str | None:
    """Download the document once; return its path below research/captures/."""
    CAPTURES.mkdir(parents=True, exist_ok=True)
    path = CAPTURES / f"{key}{suffix}"
    if not path.exists():
        result = subprocess.run(["curl", "-sL", "-m", "90", "-A", "Mozilla/5.0", "-o", str(path), "-w", "%{http_code}", url], capture_output=True, text=True)
        if result.stdout.strip() != "200" or path.stat().st_size < 500:
            path.unlink(missing_ok=True)
            return None
    return f"research/captures/jurisdiction/{path.name}"


def write_source(key: str, kind: str, title: str, author: str, url: str, issued: list[int] | None,
                 rights_basis: str, notes: str, suffix: str = ".html", citation_type: str = "webpage",
                 extra_citation: dict | None = None, accessed: tuple = (2026, 11, 23)) -> Path:
    path = ROOT / "content" / "sources" / key[0] / f"{key}.yaml"
    if path.exists():
        record = yaml.safe_load(path.read_text(encoding="utf-8"))
        if SESSION not in record.get("found_in", []):
            record.setdefault("found_in", []).append(SESSION)
            path.write_text(dump(record), encoding="utf-8")
        return path
    copy = capture(key, url, suffix)
    citation = {"type": citation_type, "title": title, "author": [{"literal": author}]}
    citation.update(extra_citation or {})
    citation["URL"] = url
    if issued:
        citation["issued"] = {"date-parts": [issued]}
    citation["accessed"] = {"date-parts": [list(accessed)]}
    government = rights_basis == "us-government-work"
    record = {
        "key": key,
        "kind": kind,
        "citation": citation,
        "original_link": url,
        "retrieved": "2026-11-23",
        "archives": [],
        "history": {"status": "live", "last_checked": "2026-11-23"},
        "rights": {
            "status": "no-permission-needed",
            "basis": rights_basis,
            "basis_note": "A work of the United States government, not subject to copyright (17 U.S.C. § 105)." if government
            else "Only facts are recorded from this source; it is cited and linked, not quoted or reproduced.",
            "redistribution": government,
        },
        "found_in": [SESSION],
        "notes": notes + (f" Private copy {copy}." if copy else " No private copy saved (download refused)."),
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(dump(record), encoding="utf-8")
    return path
