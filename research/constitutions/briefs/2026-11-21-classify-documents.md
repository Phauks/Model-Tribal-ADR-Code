# Classify captured documents for a catalog of Native nation constitutions

You are reviewing documents that a crawler saved while looking for the constitution of each federally recognized Native nation. Each item in your batch file gives: `key`, the nation the crawler was searching for (`nation`, `nation_name`), the `link` and its `link_text`, whether it came from a Wayback Machine capture (`wayback_capture`, a timestamp), the page count, how the text was read (`text_method`; `optical-character-recognition` text has scanning errors), the `title_line`, the `opening` and `closing` text of the document, and the `article_headings` a script found.

Read every item. For each, decide only what the text shows. Do not guess dates or facts that are not in the text you were given. If unsure, say so.

Write a JSON array to the answers file named in your task, one object per item, in the same order, with exactly these fields:

```json
{
  "key": "copied from the item",
  "document_type": "constitution | constitution-and-bylaws | bylaws | amendment | articles-of-association | proposed-constitution | corporate-charter | law-code | election-notice-or-ballot | web-page-about-constitution | other | unreadable",
  "belongs_to_nation": "yes | no | unsure",
  "other_nation": "the nation the document belongs to, if belongs_to_nation is no, else null",
  "printed_title": "the document's own title as printed, or null",
  "completeness": "full-text | partial | table-of-contents-only | not-the-text",
  "adopted": "date the text gives for adoption or ratification by the nation's people or council (YYYY-MM-DD, YYYY-MM or YYYY), or null",
  "approved": "date the text gives for approval by the Secretary of the Interior or another federal official, or null",
  "effective": "effective date if the text gives one, or null",
  "latest_amendment": "the latest amendment the text says is included or that it was amended through (label and date as given, e.g. 'Amendment XII, 2015-06-03'), or null",
  "amendments_named": ["each amendment or revision the text names, with its date, as short strings"],
  "secretarial_approval": "required | not-required | removed | not-stated  (does the text say amendments or the constitution need the Secretary of the Interior's approval; 'removed' if it says a former approval requirement was removed)",
  "is_proposed_or_draft": true,
  "evidence": "up to 25 words copied exactly from the text that support the dates, or null",
  "note": "anything a human reviewer should check, in one sentence, or null"
}
```

Rules:

- `document_type`:
  - `constitution` for a constitution without separate bylaws in the same file; `constitution-and-bylaws` when both are in the file.
  - `amendment` for a file that holds only one or more amendments (not the whole constitution).
  - `articles-of-association` for an Alaska Native village's articles.
  - `proposed-constitution` for a draft, a proposed revision, or a text put to a vote that the document does not say was adopted. Also set `is_proposed_or_draft` true.
  - `corporate-charter` for a federal corporate charter (Indian Reorganization Act section 17, or the Oklahoma or Alaska equivalent).
  - `law-code` for a code, ordinance or title of laws, even if it mentions the constitution.
  - `web-page-about-constitution` for a page that talks about the constitution (news, a committee page, a list of links) without its text.
  - `unreadable` when the text is too garbled to tell.
- `belongs_to_nation`: `no` when the document is plainly another nation's (for example the Minnesota Chippewa Tribe's constitution saved for one of its bands is `yes`, because the band is a component of that tribe: say so in `note`). `unsure` when the text names no nation.
- Dates: copy the dates printed in the text. An approval certificate at the end (for example "approved by the Assistant Secretary of the Interior on ...") is the `approved` date. A ratification or election certificate gives `adopted`. Leave a field null rather than guessing.
- `evidence` must be copied word for word from the `opening` or `closing` text, at most 25 words.
- Output valid JSON only, no comments, no trailing commas. Use `false` for `is_proposed_or_draft` when it is not a draft.
- When `nation` is `_unmatched`, a file name could not be matched to a nation. Set `belongs_to_nation` to `no` and put in `other_nation` the nation's name exactly as the document prints it (for example "Lac Courte Oreilles Band of Lake Superior Chippewa Indians"), or null if the text names none.
- Items whose `text_method` is `internet-archive-optical-character-recognition` come from scans of the Bureau of Indian Affairs' own files released under the Freedom of Information Act. Their text has scanning errors; read dates with care and say in `note` when a date is hard to read.
