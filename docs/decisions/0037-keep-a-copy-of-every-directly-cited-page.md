# 0037. Keep our own copy of every page a record directly cites

- **Status:** Accepted
- **Date:** 2026-11-22

## Context

Every source record with an original link now gets a Wayback Machine capture in its `archives` list (the archive workflow's catch-up job, `scripts/find_archived_copies.py`). Those captures live at the Internet Archive, not in the project's private bucket. The bucket held copies only of the documents filed through the capture index (decision record 0030): constitutions, Tribal law, gaming compacts, federal works, nation images and hand pulls. Asked whether the archived pages were also going into R2, Trevor Goldsmith answered: "If we directly cite it. We should keep a copy. If not, this is fine" (2026-11-22).

## Decision

- A source record is directly cited when a tribe profile, document, essay, bibliography, story, method or glossary entry names its key. The project keeps its own copy of each such record's original link in the private bucket.
- `scripts/captures/copy_cited_pages.py` finds the directly cited records that no index row covers, downloads each original link, files it under `cited-pages/<first character>/<record key>.<extension>`, checks the object by size and SHA-256, and adds its row to `research/capture-index.csv` through the same writer as `mirror_captures.py`. A record whose original link is already held under another key (matched by link or by SHA-256) is added to that row's `records` instead of being copied twice.
- A copy's `redistribution` follows its source record, as in decision record 0030: `yes` only when the record's `rights.redistribution` is true. Every other copy is private.
- Source records that no other record cites keep only their Wayback capture.

## Consequences

- On 2026-11-22, 5,737 source records were directly cited. 1,679 of them had a copy already held under another key. Of the other 2,477, 2,297 were copied (1.1 GB), 5 turned out to be files already held, and 175 could not be copied.
- HTML pages are saved as the server sent them, without images or style sheets, so a copy keeps the text but may not look like the page.
- Pages that refuse scripted downloads, answer with a bot check instead of the page, or are larger than 64 MB are listed in `research/cited-pages-not-copied.csv`, and keep only their link and Wayback capture until someone pulls them by hand.
- New directly cited records need a re-run of the script (`plan`, `fetch`, `deep`, `index`).

## Sources

- Trevor Goldsmith, project thread on Wayback captures, 2026-11-22.
- Decision records [0030](0030-keep-research-captures-in-the-private-bucket.md) and [0031](0031-serve-copies-of-documents-from-the-private-bucket.md).
