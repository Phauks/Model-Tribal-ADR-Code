# Brief: check quotations in method and glossary records

Input: `quotes/quote-check.json`, every quotation followed by a citation in `content/methods/*.yaml` and `content/glossary/*.yaml`, with the record file, field, quoted text, cited source key and a script status (`found`, `partly`, `not-found`, `not-fetched`). Check the items whose status is not `found`.

For each item:
1. Read the quotation in context in the record (the extraction is crude: the "quote" may be a fragment or span two quotations).
2. Find the source: its record in `content/sources/` (original link or citation URL), a fetched copy in `quotes/src/<key>`, or, if there is no usable copy (missing, an error page, a landing page), the document itself fetched again.
3. Compare word for word. Ignore curly versus straight quotes, dashes, line breaks and end-of-line hyphenation. Bracketed alterations ("[t]he") and ellipses are allowed if they match the source's words.

Output: `quotes/quote-verdicts.json`, one object per checked item: `file`, `key`, `quote_in_record` (up to 300 characters), `verdict` (`exact`, `minor-difference`, `wrong` (materially different, or the words are not there), `not-a-quotation` (the extraction caught unquoted text), `cannot-check`), `source_text` (the matching passage, up to 300 characters, or null), `where`, `reason`. Do not guess.
