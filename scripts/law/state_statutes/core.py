"""The shared half of the state statutes sweep: the section shape every state adapter yields, the keyword pass, the reading
batches, and the merge of the readers' verdicts into each state's list of Indian law sections.

Nothing here knows about any one state. A state's adapter (adapters/<state>.py) supplies the only state-specific parts: how to
download the code, how to split it into sections, and how to cite and link a section. See README.md in this folder.
"""
from __future__ import annotations

import csv
import json
import random
import re
from collections import defaultdict
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Iterable, Iterator

ROOT = Path(__file__).resolve().parents[3]
RESEARCH = ROOT / 'research/state-statutes'
INSTRUCTIONS = RESEARCH / 'reading-instructions.md'

# Term families, from the Oklahoma pilot (research/analyses/2026-11-26-state-statutes-pilot.md, section 3), widened by the
# acronyms the pilot missed (I/T/U, IHS, ICWA). STRONG = unmistakable Indian law phrases; WEAK = any other Native signal worth a
# reader's look. A state adds its own nations' names to WEAK and its own place names to the list taken out before matching.
STRONG = re.compile(
    r"\bIndian (?:tribes?|nations?|country|reservations?|child(?:ren)?|lands?|allotments?|affairs|trust|gaming|health|education|territory|peoples?|communit(?:y|ies)|organizations?)\b"
    r"|\bfederally[- ]recognized (?:Indian )?(?:tribes?|nations?|bands?)\b"
    r"|\btribal (?:governments?|courts?|nations?|lands?|members(?:hip)?|councils?|gaming|compacts?|police|law enforcement|jurisdiction|sovereign|citizens?|enrollment|governing bod(?:y|ies)|colleges?|schools?|health|housing|governing)"
    r"|\b(?:Native American|American Indian|Alaska Native|Native Hawaiian)s?\b|\bIndian Child Welfare\b|\bFive Civilized Tribes\b|\bInter-?Tribal\b"
    r"|\b(?:Bureau|Commissioner) of Indian Affairs\b|\btribal-state\b|\bstate-tribal\b|\btribe(?:s)? of Indians\b|\bIndian Gaming Regulatory\b"
    r"|\bIndian Health Service\b|\bI/T/U\b|\bICWA\b|\bIHS\b|\bconfederated tribes\b|\bband of (?:\w+ )?Indians\b|\bNative (?:nations?|tribes?|villages?)\b",
    re.I)
WEAK_BASE = (r"\bIndians?\b|\btribes?\b|\btribal(?:ly)?\b|\bNative\b|\bsovereign nations?\b|\bNation\b|\brestricted (?:lands?|Indian|heirs?|allottees?)\b"
             r"|\ballot(?:ted|tee|ment)s?\b|\breservations?\b|\bpueblos?\b|\brancherias?\b|\bindigenous\b")


@dataclass
class Section:
    """One section of a state code, as an adapter splits it out of the official text."""
    number: str            # the section's own number, as the code prints it: "37.12.010", "3A-281"
    heading: str           # the official catchline, without the number
    text: str              # the section's text, one line, without history or editorial notes
    url: str               # the official page (or page anchor) for this one section
    title: str = ''        # the title, chapter or article the section sits in, for grouping and context
    title_name: str = ''   # that title's name, for the readers
    history: str = ''      # the source note or history line, as printed
    status: str = 'live'   # live, or repealed / recodified / expired / renumbered: only live sections are read
    act: str = ''          # a key for the session law that enacted it ("1957-240"), so readers see its siblings
    enacted: list[int] | None = None  # [year] or [year, month, day] of first enactment, when the history line says
    extra: dict = field(default_factory=dict)  # anything else an adapter's record needs (a PDF page number)
    strong: list[str] = field(default_factory=list)
    weak: list[str] = field(default_factory=list)
    words: int = 0


class Terms:
    """The keyword pass for one state: the shared families plus the state's own nation names, less its place names."""

    def __init__(self, nation_names: Iterable[str] = (), place_names: Iterable[str] = ()):
        names = [re.escape(name) for name in nation_names]
        self.weak = re.compile(WEAK_BASE + (r'|\b(?:' + '|'.join(names) + r')\b' if names else ''), re.I)
        places = [re.escape(name) for name in place_names]
        self.places = re.compile(r'\b(?:' + '|'.join(places) + r')\b', re.I) if places else None

    def tag(self, section: Section) -> Section:
        full = f'{section.heading} {section.text}'
        section.strong = sorted({match.group(0).lower() for match in STRONG.finditer(full)})
        bare = self.places.sub(' ', full) if self.places else full
        section.weak = sorted({match.group(0).lower() for match in self.weak.finditer(bare)})
        section.words = len(section.text.split())
        return section


def clean(text: str) -> str:
    """One line, with the spaces that stripping links leaves before punctuation taken out ("NRS 41.420 , inclusive")."""
    return re.sub(r' ([,;:.)\]])', r'\1', re.sub(r'\s+', ' ', text)).replace('( ', '(').replace('[ ', '[').strip()


def write_sections(sections: Iterable[Section], path: Path) -> dict:
    path.parent.mkdir(parents=True, exist_ok=True)
    counts = defaultdict(int)
    with path.open('w') as file:
        for section in sections:
            counts['sections'] += 1
            counts[section.status] += 1
            if section.status == 'live':
                counts['strong'] += bool(section.strong)
                counts['weak_only'] += bool(section.weak and not section.strong)
            file.write(json.dumps(asdict(section), ensure_ascii=False) + '\n')
    return dict(counts)


def read_sections(path: Path) -> Iterator[Section]:
    with path.open() as file:
        for line in file:
            yield Section(**json.loads(line))


def excerpt(section: Section, terms: Terms, cap: int = 380) -> str:
    """The section's text, or, for a long section, its opening and the words around its first few term hits."""
    words = section.text.split()
    if len(words) <= cap:
        return ' '.join(words)
    spans = [match.start() for match in list(STRONG.finditer(section.text)) + list(terms.weak.finditer(section.text))][:4]
    if not spans:
        return ' '.join(words[:cap]) + ' […]'
    # The words around each hit come first, then the opening, so a long section's hits are never the part cut.
    keep = set()
    for start in spans:
        at = len(section.text[:start].split())
        keep |= set(range(max(0, at - 50), min(len(words), at + 50)))
    keep |= set(range(min(60, max(0, cap - len(keep)))))
    out, last = [], -1
    for at in sorted(k for k in keep if k < len(words)):
        if at != last + 1:
            out.append('[…]')
        out.append(words[at])
        last = at
    return ' '.join(out)


def batches(sections: list[Section], terms: Terms, out: Path, near_sample: int, other_sample: int, size: int, seed: int, extend: bool = False) -> dict:
    """Blind reading batches. Pools: A = strong-term hits (all), B = weak-term-only hits (all), E = non-hits in a chapter whose
    own name is Indian law, such as a definitions section of a state Indian child custody chapter (all), C = non-hits enacted by
    the same session law as a strong hit or within two sections of one (sample), D = every other live section (random sample).
    The readers are not told the pool. C and D measure recall: a "yes" there is a section the keyword pass missed.

    With `extend`, the batches already read are kept and only the A, B and E sections not yet read go into new batches (after a
    change to the terms or the parser); C and D stay as first drawn."""
    rng = random.Random(seed)
    live = [section for section in sections if section.status == 'live']
    hit = lambda section: bool(section.strong or section.weak)
    by_act = defaultdict(list)
    for index, section in enumerate(live):
        if section.act:
            by_act[section.act].append(index)
    near = set()
    for indexes in by_act.values():
        if len(indexes) <= 60 and any(live[i].strong for i in indexes):
            near |= {i for i in indexes if not hit(live[i])}
    for index, section in enumerate(live):
        if section.strong:
            for other in range(index - 2, index + 3):
                if 0 <= other < len(live) and live[other].title == section.title and not hit(live[other]):
                    near.add(other)
    chapter_law = lambda section: bool(STRONG.search(section.title_name))
    pool_a = [i for i, section in enumerate(live) if section.strong]
    pool_b = [i for i, section in enumerate(live) if section.weak and not section.strong]
    pool_e = [i for i, section in enumerate(live) if not hit(section) and chapter_law(section)]
    near -= set(pool_e)
    pool_d = [i for i, section in enumerate(live) if not hit(section) and i not in near and not chapter_law(section)]
    old = json.loads((out / 'pool-key.json').read_text()) if extend else None
    if old:
        done = set(old['cite'].values())
        fresh = {**{i: 'A' for i in pool_a}, **{i: 'B' for i in pool_b}, **{i: 'E' for i in pool_e}}
        pools = {i: p for i, p in fresh.items() if live[i].number not in done}
        prefix = f"x{len(list(out.glob('batch-*.jsonl')))}-"
        first = len(list(out.glob('batch-*.jsonl')))
    else:
        pool_c = rng.sample(sorted(near), min(near_sample, len(near)))
        pool_d_sample = rng.sample(pool_d, min(other_sample, len(pool_d)))
        pools = {**{i: 'A' for i in pool_a}, **{i: 'B' for i in pool_b}, **{i: 'E' for i in pool_e}, **{i: 'C' for i in pool_c}, **{i: 'D' for i in pool_d_sample}}
        prefix, first = 's', 0
    items = []
    for index, pool in pools.items():
        section = live[index]
        siblings = [live[i].heading for i in by_act.get(section.act, []) if i != index][:3] if section.act else []
        items.append({'id': f'{prefix}{index}', 'cite': section.number, 'title_name': section.title_name, 'heading': section.heading,
                      'same_law_headings': siblings, 'text': excerpt(section, terms)})
    rng.shuffle(items)
    out.mkdir(parents=True, exist_ok=True)
    if not old:
        for stale in list(out.glob('batch-*.jsonl')) + list(out.glob('answers-*.jsonl')):
            stale.unlink()
    count = max(1, -(-len(items) // size)) if items else 0
    per = -(-len(items) // count) if count else 0
    for number in range(count):
        with (out / f'batch-{first + number + 1:02d}.jsonl').open('w') as file:
            for item in items[number * per:(number + 1) * per]:
                file.write(json.dumps(item, ensure_ascii=False) + '\n')
    key = {f'{prefix}{i}': p for i, p in pools.items()}
    cite = {f'{prefix}{i}': live[i].number for i in pools}
    if old:
        meta = {**old['meta'], 'live': len(live), 'A': len(pool_a), 'B': len(pool_b), 'E': len(pool_e),
                'items': old['meta']['items'] + len(items), 'batches': first + count, 'extended': old['meta'].get('extended', 0) + 1}
        key, cite = {**old['key'], **key}, {**old['cite'], **cite}
    else:
        meta = {'live': len(live), 'A': len(pool_a), 'B': len(pool_b), 'E': len(pool_e), 'C': len(near), 'C_sample': len(pool_c),
                'D': len(pool_d), 'D_sample': len(pool_d_sample), 'items': len(items), 'batches': count}
    (out / 'pool-key.json').write_text(json.dumps({'meta': meta, 'key': key, 'cite': cite}, indent=0))
    return {**meta, 'new_items': len(items)}


def read_verdicts(batch_dir: Path) -> dict[str, dict]:
    """Every reader's answers (answers-NN.jsonl beside batch-NN.jsonl), by item id."""
    verdicts = {}
    for path in sorted(batch_dir.glob('answers-*.jsonl')):
        for line in path.read_text().splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                answer = json.loads(line)
            except json.JSONDecodeError:
                continue
            if answer.get('verdict') in ('core', 'incidental', 'none'):
                verdicts[answer['id']] = answer
    return verdicts


FIELDS = ['citation', 'number', 'heading', 'relevance', 'reader_reason', 'pool', 'terms_found', 'title', 'act', 'enacted', 'history', 'url', 'extra']


def merge(sections: list[Section], batch_dir: Path, settled: dict[str, dict], cite, out_csv: Path) -> dict:
    """Join the readers' verdicts with the sections and write the state's list of Indian law sections. `settled` holds hand
    fixes by section number ({"verdict": ..., "reason": ...}) that win over a reader. Returns the recall counts."""
    key = json.loads((batch_dir / 'pool-key.json').read_text())
    verdicts = read_verdicts(batch_dir)
    live = [section for section in sections if section.status == 'live']
    by_number = {}
    for section in live:
        by_number.setdefault(section.number, section)
    missing = sorted(set(key['key']) - set(verdicts) - {item for item, number in key['cite'].items() if number in settled})
    rows, tally = [], defaultdict(lambda: defaultdict(int))
    for item, pool in key['key'].items():
        section = by_number.get(key['cite'][item])
        if section is None:  # read, then dropped by a later parse (a repealed section the first parse took for live)
            continue
        answer = settled.get(section.number) or verdicts.get(item)
        if not answer:
            continue
        verdict = answer['verdict']
        tally[pool][verdict] += 1
        if verdict == 'none':
            continue
        rows.append({'citation': cite(section), 'number': section.number, 'heading': section.heading, 'relevance': verdict,
                     'reader_reason': answer.get('reason', ''), 'pool': pool, 'terms_found': '; '.join(section.strong + section.weak),
                     'title': section.title, 'act': section.act, 'enacted': json.dumps(section.enacted) if section.enacted else '',
                     'history': section.history, 'url': section.url, 'extra': json.dumps(section.extra) if section.extra else ''})
    for number, answer in settled.items():  # a hand fix for a section no reader saw
        if number in by_number and number not in {row['number'] for row in rows} and answer['verdict'] != 'none' and number not in key['cite'].values():
            section = by_number[number]
            rows.append({'citation': cite(section), 'number': number, 'heading': section.heading, 'relevance': answer['verdict'],
                         'reader_reason': answer.get('reason', ''), 'pool': 'settled', 'terms_found': '; '.join(section.strong + section.weak),
                         'title': section.title, 'act': section.act, 'enacted': json.dumps(section.enacted) if section.enacted else '',
                         'history': section.history, 'url': section.url, 'extra': json.dumps(section.extra) if section.extra else ''})
    order = {}
    for index, section in enumerate(live):
        order.setdefault(section.number, index)
    rows.sort(key=lambda row: order[row['number']])
    out_csv.parent.mkdir(parents=True, exist_ok=True)
    with out_csv.open('w', newline='') as file:
        writer = csv.DictWriter(file, FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    return {'missing_answers': len(missing), 'rows': len(rows), 'core': sum(r['relevance'] == 'core' for r in rows),
            'incidental': sum(r['relevance'] == 'incidental' for r in rows), 'by_pool': {p: dict(v) for p, v in sorted(tally.items())},
            'meta': key['meta']}


def read_list(path: Path) -> list[dict]:
    with path.open(newline='') as file:
        return list(csv.DictReader(file))
