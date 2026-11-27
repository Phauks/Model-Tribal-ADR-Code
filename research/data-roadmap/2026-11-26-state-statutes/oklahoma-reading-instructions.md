# Reading instructions: is this Oklahoma statute section Indian law?

You will read one batch file of Oklahoma Statutes sections (JSON lines). Each line has `id`, `cite`, `title_name`, `heading`, `same_law_headings` (headings of up to three other sections enacted by the same session law, for context only), and `text` (the section, or an excerpt with `[…]` where words were cut).

For every line, decide one verdict:

- `core`: the section's subject is Native nations or Indian people as such. Examples: tribal-state compacts, Indian gaming, the Oklahoma Indian Child Welfare Act (including its short title, definitions and purpose sections), recognition of tribal court judgments, Indian country jurisdiction, tribal motor vehicle tags, taxation of tribal members or Indian lands, Indian affairs commissions, Native American cultural or language programs, restricted Indian land and allotments of tribal members, Five Civilized Tribes land title rules.
- `incidental`: the section is about something else but gives a Native nation, tribal government, tribal court, tribal agency, tribal member or Indian land a specific legal role, right, duty, exemption or mention with legal effect. Examples: "a federally recognized Indian tribe" listed among eligible grantees or among governments that may sign an agreement; a notice that must go to tribes; a definition of "government" that includes tribes; a fee exemption for tribal members.
- `none`: no legal effect on Native nations or Indian people. This includes: the word used in another sense (hotel or seat "reservation", water or budget "allotment", "the nation" meaning the United States, "native" plants or species, "Delaware" corporations, "tribal" or "nation" in an unrelated name); place names only (Cherokee County, Pawnee, Kiowa, Caddo, Ottawa, Muskogee, Seminole as a city or county; a highway named for a person); historic names with no rule about Native people.

Judge the text, not the title or the other headings. A section that only defines or cross-references another Indian law act counts as `core` if that act is Indian law. If the excerpt is cut and you cannot tell, judge on what you see and put "excerpt cut" in the reason.

Write your answers to the output file named in your task, one JSON object per line, in the same order as the batch, with exactly these keys:

```
{"id": "s123", "verdict": "core", "reason": "Oklahoma Indian Child Welfare Act definitions"}
```

Keep each reason to 12 words or fewer. Answer every line; do not skip any. Do not browse the web. Do not change the batch file.
