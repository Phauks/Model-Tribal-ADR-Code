# Find Native people in Supreme Court opinions

You read excerpts of U.S. Supreme Court opinions (OCR text of the official U.S. Reports, from Library of Congress scans) and record which named people are Native American individuals, with exact quotes as evidence. A script checks every quote against the text afterwards, so precision matters more than coverage. Never use outside knowledge: record only what the excerpt itself says.

## Input

Your batch file lists excerpt files, one path per line. Read each excerpt file with the Read tool. Each excerpt starts with the CASE, CITATION, DECIDED and CAPTION PEOPLE lines, then pages marked `=== PAGE <vol> U.S. <page> ===`. The excerpt has the case's first five pages and its last two. The first page often begins with the end of the previous case; ignore that part.

## Who to record

For each case, consider:
- every person in the caption (CAPTION PEOPLE), and
- any other individual Native person whose own act, death, land, allotment or rights the case turns on (for example the victim of the crime charged, or the allottee whose land is in dispute).

Record a person (include: true) only when ALL of these hold:
1. The Court's opinion or the reporter's statement of the case says they are an Indian (a statement only in counsel's argument, such as text after "for plaintiff in error" or "argued", does not count) / Native / a member, citizen or allottee of a named tribe or nation (or uses an equivalent phrase such as "a Cherokee Indian", "a full-blood Creek", "an enrolled member of").
2. The excerpt gives a personal name of at least two words (a given name and surname, or a name such as "Lone Wolf" or "Crow Dog"). A surname alone, initials, or "et al." is not enough.
3. The excerpt does not say they were a minor at the time of the case (a guardian suing for them, "a minor", "next friend").

Also list caption people you EXCLUDE, with include: false and a short exclude_reason: "not stated to be Native", "non-Native" (the text says they are white, a non-Indian, an official, a trader, etc.), "minor", "name incomplete", "not a person".

## Quotes

Every quote is copied character for character from the excerpt, including OCR errors and odd spacing, 5 to 30 words, all on one page, and that page number is the U.S. page in the marker above it. Join a word broken by a hyphen at a line end exactly as it appears (keep the hyphen). Do not fix spelling. Do not join text across a page marker.

## Output

Write one JSON file to the output path you were given: a JSON array with one object per person (included or excluded), in this shape:

```json
{
  "cite": "163 U.S. 376",
  "caption_name": "TALTON",
  "name": "Bob Talton",
  "include": true,
  "exclude_reason": null,
  "native": {"page": 380, "quote": "..."},
  "nation_as_named": "Cherokee nation",
  "nation": {"page": 380, "quote": "..."},
  "role": "Appellant",
  "role_quote": {"page": 376, "quote": "..."},
  "lead": "Appellant in Talton v. Mayes (1896), who challenged his murder conviction in a Cherokee court.",
  "result": "Judgment denying the writ of habeas corpus affirmed.",
  "result_quote": {"page": 385, "quote": "..."},
  "events": [
    {"when": "Dec. 31, 1892", "text": "Convicted of murder by a special Supreme Court of the Cherokee Nation and sentenced to be hanged.", "page": 377, "quote": "..."}
  ],
  "other_names": [
    {"name": "...", "note": "as the opinion also prints it", "page": 377, "quote": "..."}
  ]
}
```

Rules for the fields:
- name: the fullest form the excerpt prints, in normal capitalization; fix only the capitalization, never the spelling.
- role: Petitioner, Respondent, Appellant, Appellee, Plaintiff in error, Defendant in error, Plaintiff, Defendant, Claimant, or for a non-party "Victim", "Allottee", "Decedent", "Heir" and similar. role_quote shows that role or the person's part in the case.
- lead: one sentence, under 25 words, neutral, naming the case in short form with the decision year; say what the case was about for this person. No adjectives of praise or blame.
- result: the disposition as the Court states it (for this person's side), or null if the excerpt's last pages don't show it.
- events: zero to four dated or dateable facts about this person stated in the excerpt (convictions, allotments, deaths, filings), each with its quote. Where the only account is the court's recital of a charge or conviction, write it as the court's account ("The Court's statement says ..."). Leave out anything about health, family, or crimes the case did not decide, and leave out speculation.
- other_names: only other spellings or names the excerpt itself prints for the same person.
- For excluded people, fill only cite, caption_name, name (as best you can), include, exclude_reason.

When you are finished, reply with one line: the output path, the number of people included and the number excluded. Do not summarize the cases.
