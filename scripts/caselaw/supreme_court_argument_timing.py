#!/usr/bin/env python3
"""Time the Supreme Court argument transcripts against the recordings, and make transcripts where none exists.

The argument player plays a case's recording with its transcript beside it and
lights each turn as it is spoken, so every turn needs the moment it begins.
The Court's transcripts (scripts/caselaw/supreme_court_argument_transcripts.py)
carry pages and lines but no times, and there is no official transcript before
the October 1968 term or for four later arguments the Court does not list.

One speech recognition pass over the recordings serves both: the words it hears,
each with its time, are matched to the official transcript to time each turn;
where there is no official transcript, the words it hears are the transcript,
marked as made by speech recognition with the model named. The model is Whisper
small.en (OpenAI's English speech recognition model, run with faster-whisper
on the processor).

Subcommands, in this order:

  request     Write the list of recordings to hear: research/speech-requests/supreme-court-arguments.json.
              Pushing it to a branch other than main starts .github/workflows/speech-recognition.yml,
              which hears the recordings in shards and returns the words as workflow artifacts.
  transcribe  Hear one shard of the request (run by the workflow): --request FILE --shard N --out DIR.
  align       Read the words (--words DIR) and the transcripts, and write one timed transcript
              per argument (JSON) into --out DIR.
  store       Put the timed transcripts in the R2 bucket under supreme-court-transcripts/timed/,
              add them to the capture index and write them on the case records.

The recording the player uses for an argument is the Court's own MP3 where there
is one (every argument since the October 2010 term), and otherwise the National
Archives' files for that day: one file per case in the Black Series (1955 to
1972), often in parts, and the whole day's reels in the later series.
"""

from __future__ import annotations

import argparse
import collections
import csv
import datetime as dt
import difflib
import gzip
import hashlib
import json
import re
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCES = ROOT / "content" / "sources"
AUDIO_PLAN = ROOT / "research" / "supreme-court-coverage" / "argument-audio.csv"
TRANSCRIPT_PLAN = ROOT / "research" / "supreme-court-coverage" / "argument-transcripts.csv"
REQUEST = ROOT / "research" / "speech-requests" / "supreme-court-arguments.json"
MODEL = "small.en"
MODEL_NAME = "Whisper small.en"
SHARDS = 40
USER_AGENT = "Tribal Law Project research script (Supreme Court argument timing)"
TIMED_TOPIC = "supreme-court-transcripts"


def audio_key(row: dict) -> str:
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import supreme_court_argument_audio as audio  # noqa: PLC0415
    return audio.storage_key(row)


# ---------------------------------------------------------------- which recordings each argument uses


def arguments() -> list[dict]:
    """Every argument of our cases with a recording: case, day, the files the player plays (in order) and the official transcripts."""
    rows = [r for r in csv.DictReader(AUDIO_PLAN.open(encoding="utf-8")) if r["kind"] == "argument" and r["status"] == "stored"]
    transcripts = collections.defaultdict(list)
    if TRANSCRIPT_PLAN.exists():
        for r in csv.DictReader(TRANSCRIPT_PLAN.open(encoding="utf-8")):
            if r["status"] == "stored":
                transcripts[r["case"]].append(r)
    by_day = collections.defaultdict(list)
    for r in rows:
        by_day[(r["case"], r["date"])].append(r)
    out = []
    for (case, day), same in sorted(by_day.items()):
        court = [r for r in same if r["source"] == "court"]
        files = sorted(court or same, key=lambda r: part_order(r["link"]))
        day_ = dt.date.fromisoformat(day)
        official = [t for t in transcripts[case] if abs((dt.date.fromisoformat(t["date"]) - day_).days) <= 4]
        out.append({"case": case, "date": day,
                    "files": [{"key": audio_key(r), "link": r["link"], "duration": int(r["duration_seconds"] or 0),
                               "source": r["source"], "whole_session": r["whole_session"] == "yes"} for r in files],
                    "official": [{"link": t["link"], "docket": t["docket"], "date": t["date"],
                                  "key": f"supreme-court-transcripts/{t['term']}/{t['link'].rsplit('/', 1)[1]}"} for t in official]})
    return out


def part_order(link: str) -> tuple:
    """Parts and reels in playing order: 1of2 before 2of2, r1 before r2."""
    name = link.rsplit("/", 1)[-1]
    found = re.search(r"(\d+)of\d+|[_-]r(\d+)\b|reel[_-]?(\d+)", name, re.I)
    number = int(next(g for g in found.groups() if g)) if found else 0
    return (re.sub(r"(\d+of\d+|[_-]r\d+|reel[_-]?\d+)", "", name, flags=re.I), number, name)


def request(args: argparse.Namespace) -> None:
    files = {}
    for argument in arguments():
        for f in argument["files"]:
            files.setdefault(f["key"], {"key": f["key"], "link": f["link"], "duration": f["duration"]})
    # Shards of about equal length: longest first, each to the shortest shard so far.
    shards = [[] for _ in range(SHARDS)]
    totals = [0] * SHARDS
    for f in sorted(files.values(), key=lambda f: -f["duration"]):
        i = totals.index(min(totals))
        shards[i].append(f)
        totals[i] += f["duration"]
    REQUEST.parent.mkdir(parents=True, exist_ok=True)
    REQUEST.write_text(json.dumps({"model": MODEL, "shards": shards}, indent=1) + "\n", encoding="utf-8")
    print(f"{len(files)} recordings, {sum(totals) / 3600:.1f} hours, in {SHARDS} shards of about {max(totals) / 3600:.1f} hours")


# ---------------------------------------------------------------- hearing (run on GitHub)


def decode(path: Path):
    """16 kHz mono samples, read by ffmpeg."""
    import numpy as np  # noqa: PLC0415
    raw = subprocess.run(["ffmpeg", "-nostdin", "-loglevel", "error", "-i", str(path), "-f", "s16le", "-ac", "1", "-ar", "16000", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0


def fetch(link: str, path: Path, tries: int = 4) -> None:
    for attempt in range(tries):
        try:
            request_ = urllib.request.Request(link, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(request_, timeout=180) as response, path.open("wb") as out:
                while chunk := response.read(1 << 20):
                    out.write(chunk)
            return
        except Exception:
            if attempt == tries - 1:
                raise
            time.sleep(10 * (attempt + 1))


def transcribe(args: argparse.Namespace) -> None:
    from faster_whisper import WhisperModel  # noqa: PLC0415

    plan = json.loads(Path(args.request).read_text(encoding="utf-8"))
    shard = plan["shards"][args.shard]
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    model = WhisperModel(plan["model"], device="cpu", compute_type="int8")
    for f in shard:
        target = out / (f["key"].replace("/", "__") + ".json.gz")
        if target.exists():
            continue
        started = time.time()
        with tempfile.TemporaryDirectory() as work:
            path = Path(work) / "recording"
            fetch(f["link"], path)
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            samples = decode(path)
        segments, _ = model.transcribe(samples, language="en", beam_size=5, vad_filter=True, word_timestamps=True,
                                       condition_on_previous_text=False)
        heard = [[round(s.start, 2), round(s.end, 2), s.text.strip(),
                  [[round(w.start, 2), round(w.end, 2), w.word.strip()] for w in (s.words or [])]] for s in segments]
        with gzip.open(target, "wt", encoding="utf-8") as handle:
            json.dump({"key": f["key"], "link": f["link"], "sha256": digest, "model": MODEL_NAME,
                       "seconds": round(len(samples) / 16000, 2), "segments": heard}, handle)
        print(f"{f['key']}: {len(samples) / 16000 / 60:.0f} min heard in {(time.time() - started) / 60:.1f} min", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("request")
    p = sub.add_parser("transcribe")
    p.add_argument("--request", required=True)
    p.add_argument("--shard", type=int, required=True)
    p.add_argument("--out", required=True)
    args = parser.parse_args()
    {"request": request, "transcribe": transcribe}[args.command](args)


if __name__ == "__main__":
    main()
