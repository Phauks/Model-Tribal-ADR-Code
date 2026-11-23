# Brief: confirm or reject name joins

You review joins between a row in a public data source and a Native nation's profile. A script joined each row to a nation by comparing names; the names did not match exactly, so a person needs a second look. You give a first-pass verdict that the lead author (a law student) will review.

Each item in your batch file has:
- `pair_id`
- `source` and `source_kind` (what the label is, and the question to answer)
- `label`: the name exactly as the source prints it
- `nation`: the profile's official name; `other_names`: alternate, former and own-language names on the profile
- `nation_states`: states where the profile records a presence
- `example_note`: the note recorded with the joined fact

For each item decide:
- `same`: the label clearly denotes this nation (or, for a Census area, the area clearly belongs to or is shared by this nation). Spelling variants, dropped words ("of the X Reservation, State"), older official names, a typo in the label, and reservation names that plainly match the nation are all `same`.
- `different`: the label denotes a different nation or group, or an area that is not this nation's (for example a reservation of a different band, a different "Band" of the same people, or a different state).
- `unsure`: you cannot tell from the names alone. Common causes: several bands share a people's name (Chippewa, Paiute, Shoshone, Pomo, Sioux, Ottawa, Potawatomi, Cherokee, Seminole, Creek), the label could fit more than one profile, or the Census area is named for a place, not a nation.

Rules:
- Use only the data in the item plus general, well-established knowledge of nation names. Do not browse.
- Be strict. If two different federally recognized nations could both answer to the label, say `unsure` and name the other candidate.
- Watch for "Band" versus "Tribe" versus "Nation" distinctions that are separate governments (for example Sac and Fox Nation of Oklahoma versus Sac and Fox Tribe of the Mississippi in Iowa; Eastern Shawnee versus Absentee-Shawnee versus Shawnee Tribe).
- `reason`: one short sentence.

Output: write a JSON array to the output path you are given, one object per item, in input order: {"pair_id": 12, "verdict": "same|different|unsure", "other_candidate": "name or null", "reason": "..."} Write valid JSON only. Every pair_id in the input must appear exactly once. When done, reply with the counts of each verdict and nothing else.
