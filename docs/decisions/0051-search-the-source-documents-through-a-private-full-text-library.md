# 0051. Search the source documents through a private full-text library

- **Status:** Accepted
- **Date:** 2026-11-23
- **Extends:** decision record [0030](0030-keep-research-captures-in-the-private-bucket.md)

## Context

By 2026-11-23 the private bucket `model-tribal-adr-code-sources` held 19,994 objects and 14.1 GB (bucket listing, 2026-11-23). About 2.3 GB of that is map tiles; the rest is the documents research threads gathered: constitutions, Tribal codes and ordinances, gaming compacts, tribal court opinions, Federal Register notices, saved web pages, journal articles and Westlaw prints. The capture index (`research/capture-index.csv`, decision record 0030) lists who obtained each file and which records cite it, but nothing let a writer search what the files say. 4,051 of the 5,224 PDFs had a text extract beside them, scanned pages had none, and only 1,213 of the 5,921 saved web pages did (capture index, 2026-11-23). Trevor Goldsmith asked whether the project can properly analyze the files and what would let writers find what they need. He added that "main entity using it will be Claude, so build as best for your use", that "we will have more documents over time" so it must be kept up to date, and that "it would be beneficial if there was a human interface as well" (2026-11-23).

## Decision

- The project keeps a source library: one SQLite file holding the text of every document in the bucket, page by page, with a full-text index (SQLite FTS5, Porter stemming). It sits in the same private bucket at `_library/library.sqlite.gz`, with `_library/manifest.json` giving its build date and SHA-256. It is never committed to git and never served by the website, because it holds the text of private copies (journal articles, Westlaw prints, NILL copies) as well as public ones.
- Each passage keeps its place: the PDF page, the printed page label where the PDF has one, and, for tribal court opinions from the Caselaw Access Project, the reporter's star page, so a pinpoint citation can be checked. Each document keeps the capture index's title, nations, topic, rights and citing records, and whether the website serves it at `/copies/`.
- PDF pages without a text layer are read by optical character recognition with Tesseract when the library is built. A passage records whether it came from the text layer or from OCR, since OCR text can misread words and numbers.
- `scripts/library/build_library.py` builds and publishes the library; `scripts/library/library.py` downloads it and searches it. Claude threads use `library.py` before reading or quoting a source; text it finds is a lead to read in context, and the published source is what gets cited.
- The library leaves out the website's own files in the bucket, some of which are private to the people who sent them: proof sent with nations' requests, uploads, profile pictures, sponsor logos, nation page pictures, event recordings, essay drafts and page versions.
- People search the same library on the workspace's Source library page, open to the lead author, editors, co-authors and advisors. It reads a copy in its own D1 database, `model-tribal-adr-code-library`, kept apart from the site's database. Each build writes the changes since the last one as SQL files under `_library/d1/` in the bucket, and the Worker's hourly run applies them, so no API token is needed to keep the copy current.
- A nightly scheduled task runs `build_library.py update --ocr`, which lists the bucket and reads only files the published library has not read. Documents keep their numbers from build to build, so the website's copy changes only where a document did.

## Consequences

- A writer or a Claude thread can ask "where do our sources discuss peacemakers and elders" across every constitution, code, compact and opinion at once, and get the page to cite, without downloading 12 GB.
- The library is a copy of text from private files, so it carries their limits: nothing in it may be quoted on the website unless the document itself may be (decision records 0031, 0043, 0047). Leaders' personal names stay off the public site even where the library holds documents that name them.
- A thread needs the bucket credentials and a download of about 260 MB (850 MB unpacked) to use it; on 2026-11-23 the library held 11,471 documents and 232,103 passages, about 458 million characters (`library.py stats`). The Cloudflare-hosted options were weighed and left for later: AI Search indexes an R2 bucket directly with hybrid search, but skips PDFs over 4 MiB (10 MiB with OCR) and bills ingestion at $0.75 per million tokens and storage at $2.00 per GB-month after the included usage; a separate D1 database with FTS5 would cap at 10 GB and needs a Worker to query it. The workspace page uses its own D1 database fed from this library's text, which costs only D1 storage and reads.
- Meaning-based (semantic) search is not part of the first library. Full-text search with stemming, phrases, NEAR and OR covers most of what Claude asks, because Claude can try synonyms itself.

## Sources

- Cloudflare, [AI Search limits and pricing](https://developers.cloudflare.com/ai-search/platform/limits-pricing/) (last updated Nov. 17, 2026).
- Cloudflare, [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) and [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/).
- Cloudflare, [Vectorize pricing](https://developers.cloudflare.com/vectorize/platform/pricing/).
- SQLite, [FTS5 extension](https://www.sqlite.org/fts5.html).
