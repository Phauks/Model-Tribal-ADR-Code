# Brief: second-pass check of name joins the first pass accepted

Read first the brief at WORK_DIRECTORY/names/brief.md (definitions of same, different, unsure). A smaller model marked every item in your file `same`. A 100-item sample re-check found it wrong about 3 percent of the time, mostly in these patterns, so look hard for them:
- A constituent or component band, or a component reservation's own government, joined to the umbrella tribe (for example "Fond du Lac Band of Minnesota Chippewa Tribe" or "Leech Lake Band" joined to the Minnesota Chippewa Tribe; "Kanosh Band" or "Shivwits Band" joined to the Paiute Indian Tribe of Utah). Mark `different` and say the fact is about the band. Exception: Census reservation areas of component reservations of the umbrella tribe are `same`.
- A Census area or row named only for a place or state reservation where the link to the profile rests on other lists (mark `unsure`).
- A truncated or joint label naming several nations (mark `unsure` and name them).
- Similar names that are separate governments (Sac and Fox, Shawnee, Cherokee, Creek, Seminole, Chippewa, Potawatomi, Ottawa, Paiute, Shoshone, Pomo, Sioux bands). For the Office of Indian Gaming compact list, the list's Tribe column is sometimes misaligned; judge by the document title in the note.

Use only the item data and general knowledge; you may read the profile YAML at <profile path> if you need more context (find it by searching content/tribes for the nation's name). Do not browse. Do not modify any file except your output.

Output: a JSON array, one object per item, in input order: {"pair_id": n, "verdict": "same|different|unsure", "agrees_with_first_pass": true|false, "suggested_fix": "or null", "reason": "one sentence"}. Write valid JSON only. When done, reply with your verdict counts and the pair_ids you did not mark `same`.
