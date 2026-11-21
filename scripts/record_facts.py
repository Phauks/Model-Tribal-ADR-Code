"""Shared helpers for scripts/lint_records.py and scripts/coverage_report.py.

Reads tribe profiles, source records and the content that goes into an
edition from a repository tree (the working tree, or a copy of another
commit), and breaks profiles into cited facts: every object that carries a
`source` key, as defined by `cited` in schemas/common.schema.json.

Not run on its own.
"""

import json
import pathlib
import re
import subprocess
import urllib.parse

import yaml

try:  # The C loader is several times faster on the 948 profiles.
    YAML_LOADER = yaml.CSafeLoader
except AttributeError:  # pragma: no cover - depends on how PyYAML was built
    YAML_LOADER = yaml.SafeLoader

VERIFICATION_LEVELS = ("read-in-full", "title-only", "bulk-import", "inferred")

# Profile sections reported one level deeper, because their lists differ.
SPLIT_SECTIONS = ("names", "gaming", "dispute_resolution")

# Source kinds whose current status a citator (KeyCite, Shepard's) can check.
CITATOR_KINDS = {
    "federal-case", "state-case", "territorial-case",
    "federal-statute", "state-statute", "territorial-statute",
    "federal-regulation", "state-regulation", "territorial-regulation",
    "court-rule",
}

# A source cited by at least this many profiles is a list, directory or table.
BULK_SOURCE_PROFILES = 20

CITATION_KEY = re.compile(r"\[@([a-z0-9]+(?:-[a-z0-9]+)*)")
FRONT_MATTER = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)
UNVERIFIED = re.compile(r"\bunverified\b|\bnot verified\b", re.IGNORECASE)

# Wording in a fact's own note that shows how it was gathered, for facts that
# predate the `verification` field. Checked in this order; the first match
# wins, so the weaker level is reported when a note shows two.
NOTE_LEVELS = [
    ("inferred", re.compile(
        r"matched (to the nation |to the roster |to [A-Z][a-z]+ )?by (name|former name|office state|spelling)"
        r"|row name matched|name matched|spelling variant|matched to the roster|exact name match"
        r"|state model compact|nation-specific text not checked|assigned (by|from) the|tag assigned"
        r"|for the community where the nation is based", re.IGNORECASE)),
    ("title-only", re.compile(
        r"section title|section headings|section or chapter title|statute title|title is the link text"
        r"|link text|table of contents|listed on the national indian law library page|result title only"
        r"|named in the title of", re.IGNORECASE)),
    ("bulk-import", re.compile(
        r"bulk record|machine-extracted|read from images|page images|listed as[: ]", re.IGNORECASE)),
]


def load_yaml(text):
    return yaml.load(text, Loader=YAML_LOADER)


def read_front_matter(text):
    match = FRONT_MATTER.match(text)
    return (load_yaml(match.group(1)) or {}) if match else {}


def section_of(path):
    parts = path.split(".")
    if parts[0] in SPLIT_SECTIONS and len(parts) > 1:
        return parts[0] + "." + parts[1]
    return parts[0]


def walk_facts(value, path, found):
    """Collect (path, fact) for every dict with a string `source`."""
    if isinstance(value, dict):
        if isinstance(value.get("source"), str):
            found.append((path, value))
        for key, item in value.items():
            walk_facts(item, f"{path}.{key}" if path else key, found)
    elif isinstance(value, list):
        for item in value:
            walk_facts(item, path, found)
    return found


def profile_facts(profile):
    """(section path, fact) pairs for one profile, skipping review and sensitivity."""
    found = []
    for key, value in profile.items():
        if key in ("id", "entity_type", "review", "sensitivity"):
            continue
        walk_facts(value, key, found)
    return found


def fact_identity(path, fact):
    """A fact as text, ignoring its verification level, so that an unchanged
    fact in an edited profile is recognized as unchanged."""
    def strip(value):
        if isinstance(value, dict):
            return {k: strip(v) for k, v in value.items() if k != "verification"}
        if isinstance(value, list):
            return [strip(v) for v in value]
        return value
    return path + " " + json.dumps(strip(fact), sort_keys=True, default=str, ensure_ascii=False)


def level_from_note(fact, bulk_sources):
    """The verification level a fact's note implies, or None if it says nothing.
    Used only to report on facts that predate the `verification` field."""
    note = str(fact.get("note", ""))
    for level, pattern in NOTE_LEVELS:
        if pattern.search(note):
            return level
    if fact.get("source") in bulk_sources:
        return "bulk-import"
    return None


def normalized_link(link):
    """An address with scheme, 'www.', a trailing slash, an index page and a
    fragment removed, so two spellings of one address compare equal."""
    if not isinstance(link, str) or "://" not in link:
        return None
    parsed = urllib.parse.urlsplit(link.strip())
    host = parsed.netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    if host.endswith(":80") or host.endswith(":443"):
        host = host.rsplit(":", 1)[0]
    path = re.sub(r"/(index|default)\.(html?|php|aspx?)$", "/", parsed.path, flags=re.IGNORECASE)
    path = path.rstrip("/")
    query = f"?{parsed.query}" if parsed.query else ""
    return f"{host}{path}{query}"


def source_links(source):
    links = {source.get("original_link"), (source.get("citation") or {}).get("URL")}
    return {normal for normal in (normalized_link(link) for link in links) if normal}


class Tree:
    """Records read from one copy of the repository."""

    def __init__(self, root):
        self.root = pathlib.Path(root)
        self._profiles = None
        self._sources = None

    def files(self, pattern):
        return sorted(self.root.glob(pattern))

    def relative(self, path):
        return path.relative_to(self.root).as_posix()

    @property
    def profiles(self):
        if self._profiles is None:
            self._profiles = {}
            for path in self.files("content/tribes/*/*.yaml"):
                profile = load_yaml(path.read_text(encoding="utf-8")) or {}
                self._profiles[self.relative(path)] = profile
        return self._profiles

    @property
    def sources(self):
        """Source records by key, each with its file path under `_file`."""
        if self._sources is None:
            self._sources = {}
            for path in self.files("content/sources/*/*.yaml"):
                record = load_yaml(path.read_text(encoding="utf-8")) or {}
                record["_file"] = self.relative(path)
                self._sources[record.get("key", path.stem)] = record
        return self._sources

    def yaml_records(self, pattern):
        return [(self.relative(path), load_yaml(path.read_text(encoding="utf-8")) or {})
                for path in self.files(pattern)]

    def profile_citations(self):
        """Number of profiles citing each source key."""
        counts = {}
        for profile in self.profiles.values():
            for key in {fact["source"] for _, fact in profile_facts(profile)}:
                counts[key] = counts.get(key, 0) + 1
        return counts

    def bulk_sources(self):
        return {key for key, count in self.profile_citations().items() if count >= BULK_SOURCE_PROFILES}

    def method_ids(self):
        return {record.get("id") for _, record in self.yaml_records("content/methods/*.yaml")}

    def edition_citations(self):
        """(file, status, cited keys) for each piece of content the print
        pipeline puts in an edition (pdf/pipeline/content.mjs): essays,
        provisions and commentary that are not withdrawn, and glossary entries
        that are not retired."""
        found = []
        for pattern in ("content/essays/*.md", "content/provisions/*.md", "content/commentary/*.md"):
            for path in self.files(pattern):
                text = path.read_text(encoding="utf-8")
                front = read_front_matter(text)
                if front.get("status") == "withdrawn":
                    continue
                keys = sorted(set(CITATION_KEY.findall(text)))
                found.append((self.relative(path), str(front.get("status", "draft")), keys))
        for file, record in self.yaml_records("content/glossary/*.yaml"):
            if record.get("status") == "retired" or record.get("redirect_to"):
                continue
            text = json.dumps(record, default=str)
            keys = sorted(set(CITATION_KEY.findall(text)) | set(record.get("sources") or []))
            found.append((file, str(record.get("status", "draft")), keys))
        return found


def changed_files(base, pathspecs):
    """Files added or modified since `base` (a git ref), as repository paths."""
    output = subprocess.run(
        ["git", "diff", "--name-only", "--diff-filter=AMR", f"{base}...HEAD", "--", *pathspecs],
        check=True, capture_output=True, text=True,
    ).stdout
    return [line for line in output.splitlines() if line]


def file_at(base, path):
    """A file's text at `base`, or None if it did not exist there."""
    result = subprocess.run(["git", "show", f"{base}:{path}"], capture_output=True, text=True)
    return result.stdout if result.returncode == 0 else None
