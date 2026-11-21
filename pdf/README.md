# Print edition and ebook

The builds that turn `content/` into a print-ready PDF and an EPUB ebook for
Lulu will live here. No build code exists yet. Version: see [version.txt](version.txt);
history: see [CHANGELOG.md](CHANGELOG.md).

The print version is separate from the content version: 1.0.0 will be the
1st Edition. Each PDF records the content version it was built from.
The PDF is typeset with Typst, chosen after a test build against Paged.js; see
[decision record 0005](../docs/decisions/0005-print-with-lulu.md).
The ebook is built by a custom pipeline that shares the website's Markdown
parser and citation engine; see
[decision record 0011](../docs/decisions/0011-ebook-custom-pipeline.md).
