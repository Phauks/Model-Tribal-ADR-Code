# Confirm and summarize constitution articles

Each item in your batch is one article of a Native nation's constitution that
a word match tied to one or more topics. Fields: `key`, `nation_name`,
`article` (label and heading), `topics` (the topics the word match
suggested), `text_method` (`optical-character-recognition` text has
scanning errors), and `text` (the article, possibly cut off at 3,500
characters).

Topics:

- `judicial-power`: courts, judges, judicial power, appeals to a court,
  who interprets the constitution or hears cases.
- `dispute-resolution`: how disputes, controversies or grievances are
  resolved by anyone (council, court, board, arbitration, mediation, a
  traditional body), including disputes between districts, villages or
  officials.
- `peacemaking`: peacemaking, traditional or customary dispute
  resolution, elders' or clan bodies that resolve disputes.
- `election-disputes`: how election results or eligibility are challenged
  or contested, and who decides.
- `sovereign-immunity`: the nation's immunity from suit and how it may be
  waived.

For each item, for each topic in `topics`, decide from the text alone:

- `confirmed`: true if the article actually provides something on that
  topic; false if the word match was a false alarm (for example "court"
  only in "courtesy", or "disputes" only in a list of council powers
  unrelated to resolving disputes... but a council power "to resolve
  disputes" IS dispute resolution).
- `summary`: if confirmed, ONE neutral sentence (at most 40 words) saying
  what the article provides on that topic, in plain words, in the present
  tense, without quoting more than five words in a row. Start with what the
  article does, e.g. "Vests judicial power in a Tribal Court and an appellate
  court created by the council." Do not add facts not in the text. If the
  text is cut off, say only what is shown. Null if not confirmed.
- `methods`: if confirmed, the dispute resolution methods the article names,
  using only these ids: administrative-adjudication, arbitration,
  circle-process, conciliation, council-hearing, customary-dispute-resolution,
  elders-council, facilitation, fact-finding, mediation, negotiation,
  peacemaking, restorative-justice. A court trial or appeal is not a method
  in this list; leave it out. Empty list if none.

Write a JSON array to the answers file named in your task, one object per
item, in order:

```json
{"key": "copied from the item", "topics": [{"topic": "judicial-power", "confirmed": true, "summary": "...", "methods": []}]}
```

Valid JSON only. Every item and every topic must have an answer.
