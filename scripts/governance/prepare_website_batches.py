#!/usr/bin/env python3
"""Group the saved website pages into batches for the website readers.

Reads the folders written by crawl_websites.py and writes batch-NNN.json files,
each a list of {nation, nation_name, folder} rows whose page texts add up to at
most --limit characters. A nation with no page holding text is left out and
listed in skipped.json with the reason (blocked, error page, no government
pages). A page longer than --page-limit characters (a whole code of laws) is
dropped from its manifest's reading list and noted, so one long file does not
fill a batch.

Usage, from the repository root:

  python3 scripts/governance/prepare_website_batches.py PAGES_FOLDER BATCH_FOLDER [--limit 260000] [--page-limit 200000]

Nations already in a batch in BATCH_FOLDER are left out and new batches are
numbered after the last, so the readers can start while the crawl is running.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('pages', type=Path)
    parser.add_argument('batches', type=Path)
    parser.add_argument('--limit', type=int, default=260_000)
    parser.add_argument('--page-limit', type=int, default=200_000)
    arguments = parser.parse_args()
    arguments.batches.mkdir(parents=True, exist_ok=True)
    existing = sorted(arguments.batches.glob('batch-[0-9][0-9][0-9].json'))
    batched = {row['nation'] for path in existing for row in json.loads(path.read_text())}
    skipped_path = arguments.batches / 'skipped.json'
    skipped = json.loads(skipped_path.read_text()) if skipped_path.exists() else []
    batched |= {entry['nation'] for entry in skipped}
    rows = []
    for manifest_path in sorted(arguments.pages.glob('*/manifest.json')):
        manifest = json.loads(manifest_path.read_text())
        if manifest['id'] in batched:
            continue
        pages = manifest['pages']
        readable = [page for page in pages if 200 <= page['characters'] <= arguments.page_limit]
        long = [page['number'] for page in pages if page['characters'] > arguments.page_limit]
        if len(readable) == 0 or (len(readable) == 1 and len(pages) == 1 and readable[0]['characters'] < 1500):
            reason = 'no page could be fetched' if not pages else 'only a short home page (a bot check or an empty page)'
            skipped.append({'nation': manifest['id'], 'reason': reason, 'failures': manifest['failures'][:3]})
            continue
        manifest['pages'] = readable
        manifest['left_out'] = long
        (manifest_path.parent / 'reading.json').write_text(json.dumps(manifest, indent=1))
        size = sum(page['characters'] for page in readable)
        rows.append(({'nation': manifest['id'], 'nation_name': manifest['name'], 'folder': str(manifest_path.parent.resolve()), 'manifest': 'reading.json'}, size))
    batches, current, total = [], [], 0
    for row, size in rows:
        if current and total + size > arguments.limit:
            batches.append(current)
            current, total = [], 0
        current.append(row)
        total += size
    if current:
        batches.append(current)
    for number, batch in enumerate(batches, len(existing) + 1):
        (arguments.batches / f'batch-{number:03d}.json').write_text(json.dumps(batch, indent=1))
    skipped_path.write_text(json.dumps(skipped, indent=1))
    print(f'{len(rows)} nations in {len(batches)} batches; {len(skipped)} skipped')


if __name__ == '__main__':
    main()
