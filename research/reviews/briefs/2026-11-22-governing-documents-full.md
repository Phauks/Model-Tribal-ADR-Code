# Brief: what each governing document link actually holds (Nov. 22, 2026)

You are checking links in the `governing_documents` list of Native nation profiles. Each item names a nation (`official_name`, `other_names`), the kind of document (`kind`: constitution, law-code, corporate-charter, articles-of-association, court-rules, other), its `title` and `year` as the profile records them, and the `link`. The question for each item is: **what does the link hold?**

You get an `excerpt` of the page (up to 2,500 characters) and, where the page was downloaded, `file` in the item's work directory. If the excerpt is not enough, open the link or the downloaded file yourself (`pdftotext`, `tesseract` for scanned PDFs). Ignore any field that records an earlier automatic guess (`script`, `reason`): judge the page fresh.

## Verdicts

Pick one:

- `the-document`: the page or file is the text of this document for this nation (all of it, or the part that opens it).
- `contents-page-with-text`: a table of contents for this document whose linked pages, on the same site, hold its text. Open at least one linked page to confirm.
- `page-linking-to-it`: a page that names this document and links to its text elsewhere. Give that link as `direct_link`.
- `page-naming-only`: a page that names the document but neither holds nor links to its text.
- `different-document`: a page of this nation that is not this document and does not name it (for example the nation's home page, or another law).
- `wrong-nation`: the page is about another nation's document.
- `generic-page`: a page not about this nation at all (a directory, a topic page, a list covering many nations).
- `error-or-empty`: error, sign-in, bot-check, parked or empty page.
- `cannot-tell`: you could not settle it; say why.

Do not count a page as `the-document` because it names the nation and the word "constitution" or "code". Look for the document's own text: a preamble, articles and sections, enacting clauses, a certificate of approval.

## Also record

- `title_seen`: the document's title as the page shows it, if any.
- `date_seen`: the adoption, approval, ratification or amendment date the text shows (YYYY or YYYY-MM-DD), or null. For a constitution, note in the reason if the text is an original 1930s to 1950s version and the page says it was later amended or replaced.
- `direct_link`: for `page-linking-to-it`, the link to the text; else null.
- `reason`: one or two sentences: what you saw that settles the verdict.

## Output

Write a JSON array to the output file you are given, one object per item:

```json
{"profile": "...", "index": 0, "link": "...", "verdict": "the-document",
 "title_seen": "...", "date_seen": "1936", "direct_link": null, "reason": "..."}
```

Keep `profile` and `index` exactly as given. Never copy names, emails or telephone numbers of officials or other people into any field.
