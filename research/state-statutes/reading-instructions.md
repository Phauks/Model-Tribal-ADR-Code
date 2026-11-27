# Reading instructions: is this state statute section Indian law?

These are the instructions the small-model readers follow in the state statutes sweep (scripts/law/state_statutes/). They are the Oklahoma pilot's instructions (research/data-roadmap/2026-11-26-state-statutes/oklahoma-reading-instructions.md) with the state left open.

You will read one batch file of a state code's sections (JSON lines). Each line has `id`, `cite` (the section number), `title_name` (the title, chapter or part it sits in), `heading`, `same_law_headings` (headings of up to three other sections enacted by the same session law, for context only), and `text` (the section, or an excerpt with `[…]` where words were cut).

For every line, decide one verdict:

- `core`: the section's subject is Native nations or Native people as such. Examples: tribal-state compacts, Indian gaming, a state Indian child welfare act (including its short title, definitions and purpose sections), recognition of tribal court judgments, Indian country jurisdiction (including Public Law 280 assumption or retrocession), tribal motor vehicle tags, taxation of tribal members or Indian lands, Indian affairs commissions, Native American cultural, language, graves or education programs, restricted Indian land and allotments.
- `incidental`: the section is about something else but gives a Native nation, tribal government, tribal court, tribal agency, tribal member or Indian land a specific legal role, right, duty, exemption or mention with legal effect. Examples: "a federally recognized Indian tribe" listed among eligible grantees or among governments that may sign an agreement; a notice that must go to tribes; a definition of "government" or "public agency" that includes tribes; a fee exemption for tribal members; a tribal police officer counted as a peace officer.
- `none`: no legal effect on Native nations or Native people. This includes: the word used in another sense (hotel or seat "reservation", water or budget "allotment", "the nation" meaning the United States, "native" plants, fish or species, "tribal" or "nation" in an unrelated name); place names only (a county, city, river, lake or school district named for a nation); a highway or building named for a person; historic names with no rule about Native people.

Judge the text, not the other headings. A section that only defines or cross-references another Indian law act counts as `core` if that act is Indian law. So does a section of a chapter whose own name (`title_name`) is about Native nations or Native people, such as a definition, staffing or meeting rule of a state Indian commission or a state Indian child custody chapter: it is part of that Indian law, even if its own words name no Native term. If the excerpt is cut and you cannot tell, judge on what you see and put "excerpt cut" in the reason.

Write your answers to the output file named in your task, one JSON object per line, in the same order as the batch, with exactly these keys:

```
{"id": "s123", "verdict": "core", "reason": "State Indian child welfare act definitions"}
```

Keep each reason to 12 words or fewer. Answer every line; do not skip any. Do not browse the web. Do not change the batch file.
