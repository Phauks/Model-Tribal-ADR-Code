# Brief: does each governing document link lead to the document?

Input: `govdocs/batch-residual.json` (links the automatic check could not confirm) or `govdocs/batch-sample.json` (a random sample of 60 links it did confirm, to measure how often the automatic check is wrong). Each item is a constitution, law code, corporate charter, articles of association or court rules listed for a Native nation, with the title the dataset records, the link, the address it ended at (`final_url`), and local copies of what the link returned: `text_file` (first ~4,000 characters of extracted text) and `full_file` (the raw download; for a PDF, `pdftotext -l 5 FILE -` reads more).

For each item decide what the link leads to today.

Output: `govdocs/verdicts-residual.json` or `govdocs/verdicts-sample.json`, one object per item: `profile`, `index`, `link`; `verdict`: `the-document` (the right nation and kind of document), `page-linking-to-it` (a page that lists or links to this document for this nation, such as a law library page), `different-document` (this nation, but not this document), `wrong-nation`, `error-or-empty` (error page, parked domain, login page, nothing readable), `cannot-tell`; `date_seen` (adoption, amendment or publication date printed, or null); `title_seen` (or null); `reason` (one sentence). Do not guess.
