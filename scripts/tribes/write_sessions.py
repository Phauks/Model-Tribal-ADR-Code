#!/usr/bin/env python3
"""Write one research session log per raw research file.

Each research assistant's raw file (research/raw/<date>/<agent>.json) records its
queries, tools, limits and a short narrative. This script turns that record into the
session log the source records point to with found_in
(research/sessions/<yyyy>/<date>-<agent>.md). An existing log is never overwritten,
so hand-written logs such as the federal list import are kept.

Usage: python3 scripts/tribes/write_sessions.py research/raw/2026-11-21 "Purpose text per agent as JSON"
"""
import json
import pathlib
import sys
import unicodedata

import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
TOOL_KINDS = [
    ("web search", "web-search"), ("search", "web-search"), ("fetch", "page-fetch"), ("curl", "page-fetch"),
    ("wayback", "archive"), ("archive", "archive"), ("api", "other"), ("pdftotext", "other"), ("python", "other"),
]


def tool_entry(text):
    lowered = text.lower()
    kind = next((k for needle, k in TOOL_KINDS if needle in lowered), "other")
    return {"kind": kind, "name": text[:120]}


def main(raw_directory, purposes_json):
    raw_directory = pathlib.Path(raw_directory)
    purposes = json.loads(purposes_json)
    date = raw_directory.name
    for path in sorted(raw_directory.glob("*.json")):
        if path.name in ("build-report.json", "entity-merges.json"):
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        agent = data.get("agent", path.stem)
        session_id = f"{date}-{agent}"
        out = ROOT / "research" / "sessions" / date[:4] / f"{session_id}.md"
        if out.exists() or agent == "federal-list-and-directory":
            continue
        log = data.get("log", {})
        tools = [tool_entry(t) for t in log.get("tools", []) if isinstance(t, str)]
        tools.append({"kind": "ai-assistant", "name": "Claude (AI assistant)",
                      "detail": "A research sub-agent searched, opened sources and returned cited facts in the raw file; "
                                "the lead session reviewed the output and built the records."})
        front = {
            "id": session_id,
            "date": date,
            "researchers": ["Trevor Goldsmith", "Claude (AI assistant)"],
            "tools": tools,
            "purpose": purposes.get(agent, f"Gather cited facts for Native nation profiles ({agent})."),
            "queries": [q for q in log.get("queries", []) if isinstance(q, str)][:60],
            "sources_added": sorted({s["key"] for s in data.get("sources", []) if s.get("key")
                                     and (ROOT / "content" / "sources" / (s["key"][0] if s["key"][0].isalpha() else "_other") / f"{s['key']}.yaml").exists()}),
            "limits": log.get("limits") or "Not stated by the assistant.",
        }
        narrative = log.get("narrative") or "The assistant gave no narrative."
        facts = data.get("facts", [])
        nations = {f.get("nation") for f in facts}
        body = (f"## What was done\n\n{narrative}\n\n## Output\n\n"
                f"`research/raw/{date}/{path.name}`: {len(facts)} facts about {len(nations)} nations or communities "
                f"from {len(data.get('sources', []))} sources. What the build kept and dropped is in "
                f"`research/raw/{date}/build-report.json`.\n")
        text = "---\n" + yaml.safe_dump(front, allow_unicode=True, sort_keys=False, width=100) + "---\n\n" + body
        out.write_text(unicodedata.normalize("NFC", text), encoding="utf-8")
        print(f"wrote {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "{}")
