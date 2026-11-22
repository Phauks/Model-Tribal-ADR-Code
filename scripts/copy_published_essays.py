"""Copy every published essay version from the website into a git folder.

Run by .github/workflows/copy-published-essays.yml on the published-essays
branch (docs/editing.md, "Git copy"). Essays live in the website's private
storage; this keeps an outside copy and a public history in git without any
Cloudflare key in GitHub. It reads the website's public list of published
versions, downloads each one it does not have yet, checks its SHA-256, and
commits it on its own. A publication the website no longer lists (held back,
for example at a nation's request) is removed in a commit of its own.

Layout, relative to the folder given:

    <essay>/publication-<n>.md   each published version, never changed
    <essay>.md                   the newest listed publication
    published-essays.json        the list as last read

Usage: python3 scripts/copy_published_essays.py --site URL --folder PATH [--commit]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
import urllib.request
from pathlib import Path


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "published-essays-copy"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def git(folder: Path, *arguments: str) -> None:
    subprocess.run(["git", "-C", str(folder), *arguments], check=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--site", required=True, help="the website's address, such as https://example.org")
    parser.add_argument("--folder", required=True, type=Path, help="the folder (a git checkout) to copy into")
    parser.add_argument("--commit", action="store_true", help="commit each change")
    options = parser.parse_args()
    site = options.site.rstrip("/")
    folder: Path = options.folder

    listing = json.loads(fetch(f"{site}/published-essays.json"))
    publications = listing["publications"]
    listed = set()
    newest: dict[str, dict] = {}
    changes = 0

    for publication in sorted(publications, key=lambda item: (item["publishedAt"], item["essay"], item["publication"])):
        essay = publication["essay"]
        target = folder / essay / f"publication-{publication['publication']}.md"
        listed.add(target.relative_to(folder).as_posix())
        newest[essay] = publication
        if target.exists():
            continue
        text = fetch(f"{site}{publication['markdown']}")
        digest = hashlib.sha256(text).hexdigest()
        if digest != publication["sha256"]:
            print(f"{essay} publication {publication['publication']}: SHA-256 {digest} does not match {publication['sha256']}", file=sys.stderr)
            return 1
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(text)
        (folder / f"{essay}.md").write_bytes(text)
        changes += 1
        if options.commit:
            git(folder, "add", "--", target.relative_to(folder).as_posix(), f"{essay}.md")
            git(
                folder,
                "commit",
                "--quiet",
                "-m",
                f"Copy {essay}, publication {publication['publication']} (version {publication['version']})",
                "-m",
                f"Published {publication['publishedAt']}. SHA-256 {publication['sha256']}.",
            )

    # Publications held back since the last run, and newest copies that changed because of it.
    held_back = [path for path in folder.glob("*/publication-*.md") if path.relative_to(folder).as_posix() not in listed]
    for path in held_back:
        path.unlink()
        changes += 1
    for essay_file in folder.glob("*.md"):
        essay = essay_file.stem
        if essay not in newest:
            essay_file.unlink()
        else:
            current = folder / essay / f"publication-{newest[essay]['publication']}.md"
            if current.read_bytes() != essay_file.read_bytes():
                essay_file.write_bytes(current.read_bytes())
    (folder / "published-essays.json").write_text(json.dumps(listing, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    if options.commit:
        git(folder, "add", "--all", ".")
        status = subprocess.run(["git", "-C", str(folder), "status", "--porcelain"], capture_output=True, text=True, check=True)
        if status.stdout.strip():
            message = "Remove publications the website no longer lists" if held_back else "Update the list of published essays"
            git(folder, "commit", "--quiet", "-m", message)
    print(f"{changes} change(s); {len(publications)} publication(s) listed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
