# Copies of public documents

The website keeps its own copy of some documents it links to and serves them at `/copies/<key>`. Trevor Goldsmith asked for this on 2026-11-22, so that a link such as `https://www.govinfo.gov/link/statute/108/4791?link-type=pdf` opens quickly from the project's own storage and keeps working if the government site is slow, moves the file or goes down. This page says which documents qualify, how the copies are made and checked, and how the site uses them. The legal notes are the project's analysis, not legal advice.

## Which documents are copied

Only documents that anyone may share:

- Works of the United States government, which have no copyright (17 U.S.C. § 105): the Statutes at Large, Public Laws, Federal Register documents and other federal PDFs. A source record qualifies when its `rights.basis` is `us-government-work` or `public-domain` and its `rights.redistribution` is `true`.
- The Statutes at Large, Public Law and Federal Register citations that nation pages link to GovInfo ([src/lib/legal-citations.ts](../site/src/lib/legal-citations.ts)).

Never copied:

- Nations' own laws, codes and constitutions. They stay link-only, as the permission statuses in [data-model.md](data-model.md) and each record’s rights field require, even where a nation publishes them openly.
- Anything under copyright, or whose rights are unclear (`redistribution: false` or `unknown`). State court documents marked `government-edict` are not copied yet either: some, such as the Alaska restorative justice plans, were written with tribes, so each needs a look first.
- Web pages, such as the eCFR or the Legal Information Institute. A page changes, and a copy would go stale. Only fixed files (PDFs) are copied.

For a Federal Register document, the source record usually links the document's page on federalregister.gov. The copy is the official PDF of the same document, which the Federal Register API names; the record's link stays the source cited.

## One index for the bucket

Every file in the private bucket, copies included, has one row in the capture index, `research/capture-index.csv` (decision record 0027). A copy's row has:

- `key`: `govinfo/<package>/<file>.pdf` for GovInfo files (for example `govinfo/STATUTE-108/STATUTE-108-Pg4791.pdf`), or `<host>/<path>` for other government sites.
- `link`: every address the document was published at, separated by spaces, with the address that serves the PDF directly first. The site matches a page's link against all of them.
- `sha256`, `bytes`, `media_type`, `captured`, `title`, `records` (the source or nation records that cite it) and `rights` (a note on why it may be shared).
- `redistribution: yes`. This column alone decides what the website serves. A row marked `no` or `unknown` is never served, whatever the bucket holds.

## Making copies

`site/tools/fetch-public-copies.mjs` finds the qualifying documents, downloads each one, checks that it is a PDF, and files it with `scripts/captures/mirror_captures.py add --redistribution yes`. Files already in the index (same SHA-256) are not filed again. Run it from `site/`:

```
node tools/fetch-public-copies.mjs --out <download folder> --file <captures folder>
```

Without `--file` it only downloads and writes `plan.json` in the download folder, so the list can be checked first.

## How the website serves a copy

- The build reads the capture index and bundles the list of servable copies into the Worker (`virtual:public-copies`). A key not on the list gets "not found".
- When the bucket has the file, the Worker streams it, with byte ranges for PDF viewers. It checks the object's size and recorded SHA-256 against the index.
- When the bucket does not have it yet, the Worker fetches the file from its government address (https, `.gov` sites only), keeps it only if its SHA-256 matches the index, stores it in the bucket and serves it. This is how the nations' images are filled too ([official-images.md](official-images.md)). So the upload script with R2 keys is the quick way to fill the bucket, but not the only one.
- If no copy can be had, the reader is sent to the original address, so a link never ends at an error page.

## How pages show a copy

- In a Sources list, the citation is unchanged and still links the original address. A link "copy on this site, saved <date>, PDF" follows it.
- In a nation's recognition status, a linked citation such as "108 Stat. 4791" opens the copy.
- The page [/copies](https://model-tribal-adr-code.trevordgoldsmith.workers.dev/copies) lists every copy with the address it was published at, the date it was made and its SHA-256, so anyone can check a copy against the original.
