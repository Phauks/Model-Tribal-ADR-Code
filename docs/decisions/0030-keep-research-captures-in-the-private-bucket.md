# 0030. Keep research captures in the private bucket, with an index in git

- **Status:** Accepted
- **Date:** 2026-11-22

## Context

The project keeps private copies of the documents its records describe: constitutions, Tribal codes, gaming compacts, nations' images, and printouts Trevor Goldsmith pulls by hand from Westlaw, court sites and the Wayback Machine. Until now they sat in the project's working files under `research/captures/<topic>/`, about 12,800 files and 8.8 GB on 2026-11-22, against a 10 GB limit on those files. No list said, file by file, where a copy came from, which record cites it, or what may be done with it. Decision record 0004 already put stored files in Cloudflare R2, and decision record 0017 serves nation images from the same bucket, but nothing had been copied there. Trevor asked to "move into r2 bucket" and to "make sure we are properly documenting these files" (2026-11-22).

## Decision

- The private bucket `model-tribal-adr-code-sources` is the one home for research captures. A file's object key is its path below `research/captures/`, for example `constitutions/caddo-nation-of-oklahoma/45f8a88c34c9cb61.pdf`, the same layout decision record 0017 uses for `nation-images/`.
- One script, `scripts/captures/mirror_captures.py`, does all filing: `index`, `upload`, `verify`, `prune` and `add` (for new hand-pulled files). Nobody uploads by hand.
- The repository keeps the index, not the files. `research/capture-index.csv` gives each file's key, size, SHA-256 and media type. It also says how and when the file was obtained, its title and nations, the records that cite it and the catalog that lists it. Each row ends with a rights note and a `redistribution` value (yes, no or unknown). `research/capture-orphans.csv` lists files no record cites, for follow-up.
- A local copy is deleted only after the bucket copy matches it by size and SHA-256. Text extracts (`.txt`, `.json`, `.raw`) stay in the working files, because the catalogs and searches read them.
- The website may serve a copy only when its `redistribution` is `yes`: set from a citing source record's `rights.redistribution: true`, or given to `add` for a public-domain document such as a U.S. government work. Westlaw prints and article copies are always `no`, because the print or the article belongs to its publisher even when the opinion or statute is public.
- Uploads use access keys scoped to this bucket only, kept as environment variables (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`), never in the repository (decision record 0006).

## Consequences

- A source record can fill its `file` field (`storage_key`, `checksum`, `media_type`, `bytes`) straight from its index row.
- The index is public in git history. It names files and their sources but holds no document text; a nation's request to remove a copy removes the object and its row, and the row's past presence in history says only that the project once held a copy.
- Sessions without the bucket keys can still file a document (`add` keeps it locally and indexes it); the next `upload`, `verify` and `prune` run moves it.
- Rights notes default by topic where no source record states rights; they are project analysis, not clearance. Nothing is served from the bucket unless a record's `rights.redistribution` allows it (source schema).

## Sources

- Trevor Goldsmith, project chat, 2026-11-22 ("move into r2 bucket"; "make sure we are properly documenting these files").
- Decision records [0004](0004-content-as-plain-files.md), [0006](0006-secrets-only-in-cloudflare.md) and [0017](0017-serve-nation-images-from-the-private-bucket.md).
- `schemas/source.schema.json`, `file` property.
