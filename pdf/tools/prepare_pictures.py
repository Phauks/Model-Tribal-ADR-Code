"""Make the print copy of each picture an essay shows.

An essay's picture (`:::: figure picture /files/<reference>/<name>`, see
docs/editing.md) is a file sent from the website's editor and kept in the
project's bucket. The book is built from those same files: this tool finds
each one in a local folder given with --folder, or else downloads it from
the website at the address the essay names, the address every reader sees.
The website serves an essay's pictures to everyone once the essay is
published, so the build needs no Cloudflare key (decision record 0006).

Each file becomes a grayscale copy for standard black-and-white ink, as
Lulu asks: "the black & white images should have the colorspace set to
grayscale" (Lulu, "PDF Creation Settings", Color Space guidelines). The copy
is turned upright as the website shows it, laid on white where it is
transparent ("Flatten all transparent layers", same page, Interior File
Specifications & Layout), and saved without its metadata, so no camera or
location details reach the book.

Reads a JSON list of addresses on standard input and writes a JSON object
on standard output, one entry per address: the copy's path relative to the
print folder, its size in pixels and the SHA-256 of the original file, or
the reason it could not be made. Copies are kept under --cache, so a build
at every size downloads each file once.

Usage: python3 -I tools/prepare_pictures.py --cache DIR [--site URL] [--folder DIR ...]
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image, ImageOps

PRINT_DIRECTORY = Path(__file__).resolve().parent.parent
# The same pattern the website accepts (site/src/lib/essays/figures.ts, site/src/lib/uploads.ts).
ADDRESS = re.compile(r"^/files/(U-\d{8}-[0-9A-HJKMNP-TV-Z]{6})/([^/\s]+)$")
# A picture larger than this on its long side is made smaller: at the widest
# measure of any book size (about 6.5 in, US Letter) it is still over 500 ppi.
LONGEST_SIDE = 3600
LARGEST_DOWNLOAD = 60 * 1024 * 1024
# Copies made by an earlier version of this tool are made again.
COPY_VERSION = 1


def original_bytes(address: str, reference: str, name: str, site: str | None, folders: list[Path]) -> tuple[bytes, str]:
    """The original file, from a local folder or the website, and where it came from."""
    for folder in folders:
        for candidate in (folder / reference / urllib.parse.unquote(name), folder / reference / name):
            if candidate.is_file():
                return candidate.read_bytes(), "folder"
        matches = sorted(path for path in (folder / reference).glob("*") if path.is_file()) if (folder / reference).is_dir() else []
        if len(matches) == 1:
            return matches[0].read_bytes(), "folder"
    if not site:
        raise LookupError("not in the picture folders, and no website to download it from")
    url = site.rstrip("/") + address
    request = urllib.request.Request(url, headers={"User-Agent": "print-build"})
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            kind = response.headers.get("Content-Type", "")
            if not kind.startswith("image/"):
                raise LookupError(f"{url} answered with {kind or 'no media type'}, not a picture")
            data = response.read(LARGEST_DOWNLOAD + 1)
    except urllib.error.HTTPError as problem:
        # 404: not filed, or its essay is not published yet; 409: still in the virus check (docs/uploads.md).
        reason = {404: "not shown to everyone yet (is its essay published?)", 409: "still being checked for viruses"}.get(problem.code, problem.reason)
        raise LookupError(f"{url} answered {problem.code}: {reason}") from None
    except (urllib.error.URLError, TimeoutError, OSError) as problem:
        raise LookupError(f"could not reach {url}: {getattr(problem, 'reason', problem)}") from None
    if len(data) > LARGEST_DOWNLOAD:
        raise LookupError(f"{url} is larger than {LARGEST_DOWNLOAD // (1024 * 1024)} MB")
    return data, "website"


def print_copy(data: bytes) -> tuple[bytes, str, int, int]:
    """A grayscale, upright, flattened copy without metadata: (bytes, extension, width, height)."""
    with Image.open(io.BytesIO(data)) as opened:
        opened.load()
        source_format = opened.format
        picture = ImageOps.exif_transpose(opened)
        if picture.mode in ("RGBA", "LA", "PA") or (picture.mode == "P" and "transparency" in picture.info):
            picture = picture.convert("RGBA")
            background = Image.new("RGBA", picture.size, (255, 255, 255, 255))
            picture = Image.alpha_composite(background, picture)
        picture = picture.convert("L")
        if max(picture.size) > LONGEST_SIDE:
            picture.thumbnail((LONGEST_SIDE, LONGEST_SIDE), Image.Resampling.LANCZOS)
        output = io.BytesIO()
        # Photographs stay JPEG; drawings and screenshots stay sharp as PNG.
        if source_format == "JPEG":
            picture.save(output, format="JPEG", quality=92, optimize=True)
            extension = "jpg"
        else:
            picture.save(output, format="PNG", optimize=True)
            extension = "png"
        return output.getvalue(), extension, picture.width, picture.height


def prepare(address: str, site: str | None, folders: list[Path], cache: Path) -> dict:
    match = ADDRESS.match(address)
    if not match:
        return {"problem": "the address is not a file sent from the website's editor (/files/<reference>/<name>)"}
    reference, name = match.groups()
    record_file = cache / f"{reference}.json"
    if record_file.is_file():
        record = json.loads(record_file.read_text())
        if record.get("copy_version") == COPY_VERSION and (PRINT_DIRECTORY / record["file"]).is_file():
            return record
    try:
        data, came_from = original_bytes(address, reference, name, site, folders)
        copy, extension, width, height = print_copy(data)
    except LookupError as problem:
        return {"problem": str(problem)}
    except (OSError, Image.DecompressionBombError, ValueError) as problem:
        return {"problem": f"not a picture the build can read ({problem})"}
    cache.mkdir(parents=True, exist_ok=True)
    target = cache / f"{reference}.{extension}"
    target.write_bytes(copy)
    record = {
        "file": target.relative_to(PRINT_DIRECTORY).as_posix(),
        "width": width,
        "height": height,
        "sha256": hashlib.sha256(data).hexdigest(),
        "from": came_from,
        "copy_version": COPY_VERSION,
    }
    record_file.write_text(json.dumps(record, indent=2) + "\n")
    return record


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--cache", required=True, type=Path, help="where to keep the print copies, inside the print folder")
    parser.add_argument("--site", help="the website to download pictures from, such as https://triballawproject.org")
    parser.add_argument("--folder", action="append", default=[], type=Path, help="a folder of original files, as <reference>/<name>")
    options = parser.parse_args()
    cache = options.cache.resolve()
    if not cache.is_relative_to(PRINT_DIRECTORY):
        print("--cache must be inside the print folder, where Typst can read it", file=sys.stderr)
        return 2
    addresses = json.load(sys.stdin)
    result = {address: prepare(address, options.site, options.folder, cache) for address in addresses}
    json.dump(result, sys.stdout, indent=2)
    return 0


if __name__ == "__main__":
    sys.exit(main())
