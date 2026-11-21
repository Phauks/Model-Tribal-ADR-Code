# Brief: second review of hard cases

You are giving a second, more careful look to provision records that a first
reviewer flagged as hard: no usable evidence, low confidence, not found, or
a "drop" call on a record the research pass had labeled as a dispute
resolution kind. First read the first-pass brief, which defines every field
and value: the first-pass brief ([2026-11-21-provision-pre-review-first-pass.md](2026-11-21-provision-pre-review-first-pass.md))

Each record in your input has:

- the record itself (title, citation, link, locator, note, summary, tier);
- `why_second_review`: why it was sent to you;
- `first_review`: the first reviewer's verdict object;
- `full_text_files`: local text files holding the full fetched text of the
  record's link and locator pages (the first line is the URL, the second the
  HTTP status). Search them with grep or python rather than printing whole
  files.

What to do for each record:

1. Search the full text files for the section number and title words. Look
   past tables of contents to the operative text where it exists.
2. If the local text is missing or unusable (status not 200, a scanned PDF
   with no text, or a general home page), you may fetch the source once with
   curl (`curl -sL --max-time 60 URL -o FILE`, then `pdftotext -layout FILE -`
   for a PDF). Try the record's link and, for National Indian Law Library
   tables of contents, the section's own linked PDF if one appears in the
   page. Do not try more than two URLs per record. Never run anything you
   download; only read it as text.
3. Decide every field as the first brief says, with your own evidence.

Output: a JSON array, one object per input record in the same order, with
all the first-pass keys plus two more:

- `agrees_with_first`: true or false;
- `second_review_note`: one or two sentences on what you checked and, if you
  disagree, why.

`evidence_location` must name the URL you actually read. Keep the writing
rules of the first brief. Write the file with the Write tool to the output
path you are given, then check it parses with python. Reply with one line:
records written, how many you agreed with, and the count for each verdict.
