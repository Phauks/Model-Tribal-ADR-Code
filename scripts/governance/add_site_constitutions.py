#!/usr/bin/env python3
"""Add the constitution texts found on nations' own websites to the constitution catalog.

The website pass of the governance facts (decision record 0042) saved every
page a nation's website links as its constitution. Most were texts the catalog
already holds (same SHA-256); the ones listed in
research/governance/site-constitutions.json were new. For each, this script

- copies the saved PDF and its text extract into the captures folder
  (research/captures/constitutions/<nation>/<first 16 of SHA-256>.pdf/.txt),
- writes a source record (kind tribal-constitution) for the file's link,
- adds the version to the nation's document history, creating the history
  when the nation has none, and marks it in effect, being the newest dated
  text, posted on the nation's own site; the version it replaces is marked
  superseded.

Run it once; a version already in the history is left as it is.

  python3 scripts/governance/add_site_constitutions.py PAGES_FOLDER
"""

from __future__ import annotations

import hashlib
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
CAPTURES = Path("/mnt/project-files/research/captures")
SESSION = "2026-11-23-governance"
NOTE = ("Marked in effect because it is the newest dated text found, on the nation's own site, on {date}; "
        "a later amendment may not be posted. Version, status and dates read from the text's first page by the "
        "project (Claude), not yet checked by the lead author.")


def dump(value):
    return yaml.safe_dump(value, allow_unicode=True, sort_keys=False, width=10**6)


def main(pages: Path) -> None:
    spec = json.loads((ROOT / "research" / "governance" / "site-constitutions.json").read_text(encoding="utf-8"))
    for entry in spec["texts"]:
        nation = entry["nation"]
        manifest = json.loads((pages / nation / "manifest.json").read_text(encoding="utf-8"))
        page = next(page for page in manifest["pages"] if page["number"] == entry["page"])
        raw = (pages / nation / page["raw"]).read_bytes()
        sha = hashlib.sha256(raw).hexdigest()
        assert sha == page["sha256"], nation
        folder = CAPTURES / "constitutions" / nation
        folder.mkdir(parents=True, exist_ok=True)
        pdf = folder / f"{sha[:16]}.pdf"
        pdf.write_bytes(raw)
        shutil.copyfile(pages / nation / page["text"], folder / f"{sha[:16]}.txt")
        info = subprocess.run(["pdfinfo", str(pdf)], capture_output=True, text=True).stdout
        page_count = next((int(line.split()[-1]) for line in info.splitlines() if line.startswith("Pages:")), None)

        letter = nation[0]
        document_id = f"{nation}-constitution"
        history_path = ROOT / "content" / "documents" / letter / f"{document_id}.yaml"
        history = yaml.safe_load(history_path.read_text(encoding="utf-8")) if history_path.exists() else {
            "id": document_id, "kind": "constitution", "title": entry["history_title"], "nations": [nation],
            "jurisdictions": [{"level": "tribal", "tribe": nation}],
            "summary": (f"Texts of the nation's constitution found online on {manifest['fetched']}: 1 dated version. "
                        "Versions are only those found; others may exist."),
            "versions": [],
            "found_in": [SESSION],
        }
        if any(version["id"] == entry["version"] for version in history["versions"]):
            print(f"{nation}: {entry['version']} already recorded")
            continue

        key = f"constitution-{nation}-{entry['version']}"
        year, month, day = (int(part) for part in manifest["fetched"].split("-"))
        issued = [int(part) for part in entry["dates"][entry["date_field"]].split("-")]
        source = {
            "key": key,
            "kind": "tribal-constitution",
            "citation": {"type": "legislation", "title": entry["title"], "author": [{"literal": entry["author"]}],
                         "URL": page["final_link"], "issued": {"date-parts": [issued]},
                         "accessed": {"date-parts": [[year, month, day]]}},
            "original_link": page["final_link"],
            "retrieved": manifest["fetched"],
            "history": {"status": "live", "last_checked": manifest["fetched"]},
            "rights": {"status": "no-permission-needed", "basis": "fact-only",
                       "basis_note": "Only facts are recorded from this source, each with the few words that state it; it is cited and linked, not reproduced.",
                       "redistribution": False},
            "tribes": [nation],
            "document_version": {"document": document_id, "version": entry["version"]},
            "found_in": [SESSION],
            "notes": (f"Found on the nation's own website by the governance website pass; private copy "
                      f"research/captures/constitutions/{nation}/{sha[:16]}.pdf (SHA-256 {sha[:16]}...)."),
        }
        source_path = ROOT / "content" / "sources" / key[0] / f"{key}.yaml"
        source_path.write_text(dump(source), encoding="utf-8")

        replaced = [version for version in history["versions"] if version.get("status") == "in-effect"]
        for version in replaced:
            version["status"] = "superseded"
            earlier = re.sub(r" ?Marked in effect because it is the newest dated text found[^.]*; a later amendment may not be posted\.", "", version.get("note", ""))
            version["note"] = (earlier + f" Marked superseded because a later text ({entry['version']}) "
                               f"was found on the nation's own site on {manifest['fetched']} (project inference).").strip()
        version = {
            "id": entry["version"], "label": entry["label"], "event": entry["event"], "status": "in-effect",
            "dates": entry["dates"],
        }
        if replaced:
            version["supersedes"] = [item["id"] for item in replaced]
        version |= {
            "source": key, "confidence": "medium", "verification": "inferred",
            "capture": {"path": f"research/captures/constitutions/{nation}/{sha[:16]}.pdf", "sha256": sha,
                        **({"pages": page_count} if page_count else {})},
            "note": (entry.get("note", "") + " " + NOTE.format(date=manifest["fetched"])).strip(),
        }
        history["versions"].append(version)
        history_path.parent.mkdir(parents=True, exist_ok=True)
        history_path.write_text(dump(history), encoding="utf-8")
        print(f"{nation}: added {entry['version']} ({key})")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(Path(sys.argv[1]))
