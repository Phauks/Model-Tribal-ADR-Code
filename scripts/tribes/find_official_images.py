"""Find each nation's seal, flag or logo on its own website, for review by hand.

For every tribe profile with an official website (contacts, kind 'website'), the script reads
the home page and up to four same-site pages whose links mention a seal, flag, emblem or logo.
It lists the images that the page marks as a seal, flag or logo (by alternative text, file
name, class or a surrounding header or logo element), plus the site's declared icons, and
downloads the best few candidates into a private folder given on the command line.

It also reads up to two same-site pages whose links mention terms of use, copyright, legal or
disclaimer, and records every sentence on the home page, the seal pages and those pages that
could stop the project from reusing an image (docs/official-images.md, "Signals"):

- terms-of-use: the terms forbid copying or reuse, or require permission;
- copyright-notice: a copyright line such as "All rights reserved" (recorded, not blocking);
- trademark-notice: a trademark symbol or the word trademark near the image or the seal;
- protected-by-law: text saying a law or ordinance protects the seal or limits its use;
- permission-required: an express "do not use" or "permission required" note.

It never writes to a profile and never publishes an image. A person looks at every candidate,
keeps only the nation's own seal, flag or logo, and records it in the profile's
official_images list (docs/data-model.md). The downloaded files stay outside the repository.

Run from the repository root:
    python3 scripts/tribes/find_official_images.py candidates.json private-image-folder
Uses only the Python standard library and PyYAML (scripts/requirements.txt).
"""

import concurrent.futures
import datetime
import hashlib
import html
import html.parser
import json
import pathlib
import re
import sys
import urllib.parse
import urllib.request

import yaml

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; model-tribal-code research)",
    "Accept": "text/html,application/xhtml+xml,image/*,*/*;q=0.8",
}
SEAL = re.compile(r"\bseals?\b|great[-_ ]?seal|tribal[-_]?seal|[-_/]seal", re.I)
FLAG = re.compile(r"\bflags?\b|[-_/]flag", re.I)
LOGO = re.compile(r"logo|emblem|brand|insignia|crest|site[-_]?title|header[-_]?image", re.I)
# Images that belong to someone else or to a business arm rather than to the government.
UNWANTED = re.compile(
    r"casino|resort|hotel|golf|bingo|travel[-_ ]?(center|plaza)|sponsor|partner|facebook|twitter|"
    r"instagram|youtube|linkedin|tiktok|pinterest|google|apple[-_]?store|app[-_]?store|android|"
    r"translate|weather|award|badge|accessib|ada[-_]|loading|spinner|placeholder|pixel|tracking|"
    r"cropped-favicon|search|menu|arrow|icon-|social|share|banner[-_]?ad|cookie|recaptcha|gravatar|"
    r"wix\.com/|wixstatic.com/media/[^\"']*wix|squarespace-cdn.com/[^\"']*default|blank\.gif|spacer",
    re.I,
)
PAGE_LINK = re.compile(r"seal|flag|emblem|logo|insignia", re.I)
TERMS_LINK = re.compile(r"terms|copyright|legal|disclaimer|conditions[-_ ]of[-_ ]use|site[-_ ]policy|usage", re.I)
IMAGE_TYPES = {
    "image/png": ".png", "image/jpeg": ".jpg", "image/gif": ".gif", "image/webp": ".webp",
    "image/svg+xml": ".svg", "image/x-icon": ".ico", "image/vnd.microsoft.icon": ".ico", "image/avif": ".avif",
}
SIGNALS = {
    "terms-of-use": re.compile(
        r"(may not|must not|shall not|cannot|can not|do not|are not permitted to|is prohibited|are prohibited|prohibit\w*)"
        r"[^.]{0,120}(reproduc|copy|copied|republish|redistribut|modif|download|use|display|distribut)"
        r"|(reproduc|copy|republish|redistribut|use)[^.]{0,80}(without|unless)[^.]{0,40}"
        r"(express|written|prior|permission|consent|authoriz)",
        re.I,
    ),
    "trademark-notice": re.compile(r"[™®]|\(tm\)|\(r\)|\btrademark|service mark", re.I),
    "protected-by-law": re.compile(
        r"(seal|flag|logo|emblem|insignia)[^.]{0,160}(ordinance|statute|tribal code|resolution no|"
        r"protected by|unauthorized use|illegal|unlawful|official use only|"
        r"property of the (tribe|nation|band|community|pueblo))"
        r"|(ordinance|statute|code|resolution)[^.]{0,120}(official )?(seal|flag)[^.]{0,80}(use|reproduc)",
        re.I,
    ),
    "permission-required": re.compile(
        r"(seal|flag|logo|emblem|insignia|image|photo|graphic|content|material)[^.]{0,120}"
        r"(permission|approval|authoriz\w*|consent)[^.]{0,40}(required|must be obtained|needed|from the)"
        r"|(request|obtain|seek)[^.]{0,30}permission[^.]{0,80}(use|reproduc)",
        re.I,
    ),
    "copyright-notice": re.compile(r"(©|&copy;|\bcopyright\b)[^.]{0,120}|all rights reserved", re.I),
}


def fetch(url: str, limit: int = 3_000_000) -> tuple[str, str, bytes] | None:
    """Return (final address, content type, body), or None."""
    try:
        request = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(request, timeout=20) as response:
            return response.geturl(), response.headers.get("content-type", ""), response.read(limit)
    except Exception:
        return None


def fetch_page(url: str) -> tuple[str, str] | None:
    result = fetch(url)
    if not result or not any(kind in result[1] for kind in ("html", "xml", "text")):
        return None
    return result[0], result[2].decode("utf-8", "replace")


def visible_text(page: str) -> str:
    page = re.sub(r"(?is)<(script|style|noscript|svg)\b.*?</\1>", " ", page)
    page = re.sub(r"(?i)<(br|p|div|li|h\d|td|footer|section)\b", ". <", page)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"(?s)<[^>]+>", " ", page))).strip()


class Images(html.parser.HTMLParser):
    """Collects images with their attributes and the classes of the elements around them."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.stack: list[str] = []
        self.images: list[dict] = []
        self.icons: list[dict] = []
        self.links: list[tuple[str, str]] = []
        self.link_open: str | None = None
        self.link_text: list[str] = []

    VOID = {"img", "meta", "link", "br", "hr", "input", "source", "area", "base", "col", "embed", "wbr"}

    def handle_starttag(self, tag, attributes):
        attributes = {key: value or "" for key, value in attributes}
        context = " ".join([tag, attributes.get("class", ""), attributes.get("id", ""), attributes.get("role", "")])
        if tag == "img" or (tag == "source" and attributes.get("srcset")):
            sources = [attributes.get(key, "") for key in ("src", "data-src", "data-lazy-src", "data-orig-file")]
            srcset = attributes.get("srcset") or attributes.get("data-srcset") or ""
            if srcset:
                sources.append(srcset.split(",")[-1].strip().split(" ")[0])
            self.images.append({
                "sources": [s for s in sources if s and not s.startswith("data:")],
                "alternative_text": attributes.get("alt", ""),
                "title": attributes.get("title", ""),
                "own": " ".join([attributes.get("class", ""), attributes.get("id", "")]),
                "around": " ".join(self.stack[-8:]),
                "link": self.link_open or "",
                "order": len(self.images),
            })
        elif tag == "link" and "icon" in attributes.get("rel", "").lower():
            self.icons.append({"kind": attributes.get("rel", "").lower(), "source": attributes.get("href", ""),
                               "sizes": attributes.get("sizes", "")})
        elif tag == "meta" and attributes.get("property", attributes.get("name", "")).lower() in ("og:image", "og:logo"):
            self.icons.append({"kind": "og:image", "source": attributes.get("content", ""), "sizes": ""})
        if tag == "a":
            self.link_open = attributes.get("href", "")
            self.link_text = []
        if tag not in self.VOID:
            self.stack.append(context)

    def handle_endtag(self, tag):
        if tag == "a" and self.link_open is not None:
            self.links.append((self.link_open, " ".join(self.link_text)))
            self.link_open = None
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index].split(" ", 1)[0] == tag:
                del self.stack[index:]
                break

    def handle_data(self, data):
        if self.link_open is not None:
            self.link_text.append(data.strip())


def read_images(base: str, page: str) -> Images:
    parser = Images()
    try:
        parser.feed(page)
    except Exception:
        pass
    for image in parser.images:
        image["sources"] = [urllib.parse.urljoin(base, html.unescape(s.strip())) for s in image["sources"]]
    for icon in parser.icons:
        icon["source"] = urllib.parse.urljoin(base, html.unescape(icon["source"].strip()))
    # Schema.org organization logo
    for logo in re.findall(r'"logo"\s*:\s*(?:\{[^}]*?"url"\s*:\s*)?"([^"]+)"', page):
        parser.icons.append({"kind": "schema-logo", "source": urllib.parse.urljoin(base, logo.replace("\\/", "/")),
                             "sizes": ""})
    return parser


def score(image: dict, page_kind: str) -> tuple[int, str, str]:
    """Return (score, kind, reason) for one image."""
    words = " ".join([image["alternative_text"], image["title"], " ".join(image["sources"]), image["own"]])
    around = image["around"]
    reasons, kind, points = [], "website-logo", 0
    if SEAL.search(words):
        points, kind = points + 6, "seal"
        reasons.append("labelled seal")
    elif FLAG.search(words):
        points, kind = points + 4, "flag"
        reasons.append("labelled flag")
    if LOGO.search(words):
        points += 4
        reasons.append("labelled logo")
    if LOGO.search(around):
        points += 3
        reasons.append("inside a logo or brand element")
    if re.search(r"\bheader\b|masthead|navbar|site-header|top-bar", around, re.I):
        points += 2
        reasons.append("in the page header")
    link = image["link"]
    if link in ("/", "./", "#") or re.fullmatch(r"https?://[^/]+/?(index\.\w+)?", link or "x"):
        points += 2
        reasons.append("links to the home page")
    if image["order"] < 3:
        points += 1
    if page_kind == "seal-page" and kind in ("seal", "flag"):
        points += 2
    if UNWANTED.search(words) or UNWANTED.search(image["link"]):
        points -= 8
        reasons.append("looks like a business, social or utility image")
    return points, kind, "; ".join(reasons)


def signal_sentences(address: str, page: str) -> list[dict]:
    text = visible_text(page)
    found, seen = [], set()
    for sentence in re.split(r"(?<=[.!?])\s+", text):
        if len(sentence) > 600:
            sentence = sentence[:600]
        for name, pattern in SIGNALS.items():
            if name == "trademark-notice" and not re.search(r"seal|flag|logo|emblem|name|mark", sentence, re.I):
                continue
            if pattern.search(sentence) and (name, sentence) not in seen:
                seen.add((name, sentence))
                found.append({"signal": name, "page": address, "text": sentence.strip()})
    return found


def download(address: str, folder: pathlib.Path, stem: str) -> dict | None:
    result = fetch(address, limit=8_000_000)
    if not result:
        return None
    final, kind, body = result
    kind = kind.split(";")[0].strip().lower()
    suffix = IMAGE_TYPES.get(kind)
    if not suffix:
        guess = pathlib.PurePosixPath(urllib.parse.urlparse(final).path).suffix.lower()
        suffix = guess if guess in IMAGE_TYPES.values() or guess == ".jpeg" else None
        if body[:5] == b"<?xml" or b"<svg" in body[:300]:
            suffix = ".svg"
    if not suffix or len(body) < 200:
        return None
    digest = hashlib.sha256(body).hexdigest()
    path = folder / f"{stem}-{digest[:12]}{suffix}"
    path.write_bytes(body)
    return {"image_link": final, "file": str(path), "media_type": kind, "bytes": len(body), "sha256": digest}


def search(profile: dict, folder: pathlib.Path) -> dict:
    result = {"id": profile["id"], "name": profile["name"], "unreachable": [], "candidates": [], "signals": [],
              "pages_read": [], "retrieved": datetime.date.today().isoformat()}
    nation_folder = folder / profile["id"]
    for website, _ in profile["sites"]:
        home = fetch_page(website)
        if not home:
            result["unreachable"].append(website)
            continue
        base, page = home
        host = urllib.parse.urlparse(base).netloc.removeprefix("www.")
        result["pages_read"].append(base)
        pages = [("home", base, page)]
        parsed = read_images(base, page)
        extra, terms = [], []
        for href, label in parsed.links:
            address = urllib.parse.urljoin(base, html.unescape(href)).split("#")[0]
            if urllib.parse.urlparse(address).netloc.removeprefix("www.") != host or address == base:
                continue
            if PAGE_LINK.search(label) or PAGE_LINK.search(urllib.parse.urlparse(address).path):
                if address not in extra and not UNWANTED.search(address):
                    extra.append(address)
            if TERMS_LINK.search(label) or TERMS_LINK.search(urllib.parse.urlparse(address).path):
                if address not in terms:
                    terms.append(address)
        for address in extra[:4]:
            fetched = fetch_page(address)
            if fetched:
                pages.append(("seal-page", *fetched))
                result["pages_read"].append(fetched[0])
        for address in terms[:2]:
            fetched = fetch_page(address)
            if fetched:
                pages.append(("terms", *fetched))
                result["pages_read"].append(fetched[0])
        scored = []
        for page_kind, address, content in pages:
            result["signals"] += signal_sentences(address, content)
            if page_kind == "terms":
                continue
            images = parsed if page_kind == "home" else read_images(address, content)
            for image in images.images:
                points, kind, reason = score(image, page_kind)
                if points >= 4 and image["sources"]:
                    scored.append({"score": points, "kind": kind, "reason": reason, "page": address,
                                   "source": image["sources"][-1], "alternative_text": image["alternative_text"]})
            if page_kind == "home":
                for icon in images.icons:
                    if icon["source"] and not UNWANTED.search(icon["source"]):
                        points = {"apple-touch-icon": 3, "schema-logo": 4, "og:image": 1}.get(icon["kind"], 0)
                        scored.append({"score": points, "kind": "website-icon" if points < 4 else "website-logo",
                                       "reason": f"declared {icon['kind']}", "page": address,
                                       "source": icon["source"], "alternative_text": ""})
        scored.sort(key=lambda c: -c["score"])
        kept, seen = [], set()
        for candidate in scored:
            if candidate["source"] in seen:
                continue
            seen.add(candidate["source"])
            if len(kept) >= 5:
                break
            nation_folder.mkdir(parents=True, exist_ok=True)
            saved = download(candidate["source"], nation_folder, f"{len(kept) + 1:02d}-{candidate['kind']}")
            if saved:
                kept.append({**candidate, **saved})
        result["candidates"] += kept
    return result


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    folder = pathlib.Path(sys.argv[2])
    folder.mkdir(parents=True, exist_ok=True)
    profiles = []
    for path in sorted(pathlib.Path("content/tribes").glob("*/*.yaml")):
        record = yaml.safe_load(path.read_text(encoding="utf-8"))
        sites = [(c["value"], c.get("source")) for c in record.get("contacts", []) if c.get("kind") == "website"]
        if sites:
            profiles.append({"id": record["id"], "name": record["names"]["official"], "sites": sites})
    with concurrent.futures.ThreadPoolExecutor(max_workers=24) as pool:
        results = list(pool.map(lambda profile: search(profile, folder), profiles))
    pathlib.Path(sys.argv[1]).write_text(json.dumps(results, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    with_candidates = sum(1 for r in results if r["candidates"])
    print(f"{len(profiles)} profiles with websites; {with_candidates} with image candidates; "
          f"{sum(1 for r in results if r['unreachable'] and not r['pages_read'])} unreachable")
    return 0


if __name__ == "__main__":
    sys.exit(main())
