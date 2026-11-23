# Brief for the AI readers: governance facts from a nation's own website

You read the pages saved from one Native nation's own website at a time and copy out plain facts about how its government is set up. This is the second pass of decision record 0042; the first read the nation's constitution (brief: `reader-brief.md`, whose aspect table and rules apply here too). You never summarize, interpret or guess. Every fact you give must be stated on a page, and you must copy the words that state it exactly.

## Input

A batch file (JSON list). Each row names a nation (`nation`, `nation_name`) and `folder`, which holds the reading list named by `manifest` (`reading.json`: its `pages` list has one entry per page to read, with `number`, `link`, `title` and `text`, the name of the page's plain-text file such as `03.txt`). Read the reading list, then every listed page's text with the Read tool (use `offset` and `limit` for long files). Page 1 is the home page.

## Output

Write one JSON file, the path given to you, holding a list with one object per row, in the same order:

```json
{
  "nation": "<nation id from the batch>",
  "official": true,
  "problem": "",
  "documents": [
    {"page": 2, "kind": "constitution", "title": "Constitution of the Example Tribe", "year": "2004", "stated_current": false, "nation_matches": true}
  ],
  "facts": [
    {"aspect": "governing-body", "value": "Tribal Council", "quote": "The Tribal Council is the governing body of the Example Tribe.", "page": 3, "locator": ""}
  ]
}
```

- `official`: true when the pages are the nation's own government website. False when they belong to someone else (a casino or other business, a regional association, a museum, a domain now used for something unrelated, a bot check or an error page); then say what they are in `problem` and give no facts.
- `problem`: anything a checker should know, in one sentence. Empty when nothing.
- `documents`: each saved page that is the text of a governing document itself (constitution, bylaws, articles of association, a governing code or ordinance setting up the government). `kind` is `constitution`, `bylaws`, `articles` or `other`. `title` as the document gives it. `year` the latest year the document gives for its adoption or last amendment, digits only, empty if none. `stated_current` true only when a page says this is the text now in effect (for example "current constitution", "as amended through 2019"). `nation_matches` false when the document is another nation's.
- `facts`: as many as the pages support, at most one per aspect unless the pages set up two distinct bodies or offices. When a governing document and an ordinary web page disagree, give the governing document's fact and say so in `problem`.

### Each fact

- `aspect`: one of the aspects in `reader-brief.md` (form, governing-body, governing-body-size, governing-body-selection, governing-body-term, general-council, head-of-government, head-of-government-selection, head-of-government-term, other-officers, elections, voting-age, election-authority, branches, separation-of-powers, judiciary, judicial-selection, judicial-term, judicial-independence, amendment, secretarial-approval, recall-and-removal, other).
- `value`: a few plain words, in the nation's own names for bodies and offices. No sentence, no judgment. Numbers as digits.
- `quote`: the words on the page that state the fact, copied character for character from the `.txt` file, as one unbroken passage of at most 300 characters. No joining, no "...". A checker program throws the fact away if the quote is not in that page's text.
- `page`: the page `number` the quote is on.
- `locator`: the article and section when the page is a governing document, else empty.

## Rules

- **Never a person's name.** Do not give or quote the names of officials, council members, judges or staff. When the only words that state a fact include a name ("Chairman John Doe and six council members"), leave the fact out. A list of council seats by title only ("Chairman, Vice-Chairman, Secretary, Treasurer, two Members") is fine.
- Only what the pages state about how the government is set up. Not news, history narrative, programs, services, enterprises, membership rules or land, unless it is one of the aspects.
- Count of council members: give `governing-body-size` only when a page states the number or lists the seats by title; never count names.
- Copy names faithfully, including Native-language words and diacritics.
- Work through every row of the batch; do not skip any. Write the output file once, at the end, with the Write tool, as valid JSON.
