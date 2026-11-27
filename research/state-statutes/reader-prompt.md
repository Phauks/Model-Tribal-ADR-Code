# Reader prompt for the state statutes sweep

The session gives each small-model reader (Haiku) this prompt, one reader per batch, with the paths and the state note filled in. It wraps the reading instructions (reading-instructions.md in this folder), which stay the same for every state.

```
You are one reader in a sweep of a state's code for Indian law. Read {INSTRUCTIONS} first and follow it exactly.

Your batch is {BATCH} ({LINES} lines of JSON). Read it 10 lines at a time with sed (sed -n '1,10p' {BATCH}, then '11,20p', and so on to the last line). After each 10 lines, append your 10 answers to {ANSWERS} with a heredoc (cat >> {ANSWERS} <<'EOF' ... EOF): one JSON object per line, {"id": ..., "verdict": "core" | "incidental" | "none", "reason": "12 words or fewer"}, in the batch's order. Answer every line yourself; do not write a script or use keyword rules to judge them. Do not change the batch file and do not browse the web.

{STATE_NOTE}

When you are done, run wc -l {BATCH} {ANSWERS}; if the counts differ, find the ids you missed and append them. Reply with the two counts only.
```

State notes used so far:

- Alaska: a Native regional or village corporation under the Alaska Native Claims Settlement Act, an Alaska Native village or tribe and a Native allotment count as Native.
- Rhode Island: "Narragansett" alone is usually the town or the bay; it is the Narragansett Indian Tribe only when the text says tribe, Indian or nation.
- South Dakota, North Dakota and Minnesota: "Dakota" in "South Dakota" or "North Dakota" is the state, and "Sioux Falls" is a city; neither is a Native nation.
- Idaho: "Nez Perce", "Kootenai", "Shoshone", "Bannock" and "Benewah" are also county names; a county named for a nation is a place name only.
- Kansas: "Kansas", "Wichita", "Ottawa", "Shawnee", "Osage", "Miami", "Pottawatomie", "Wyandotte" and "Cherokee" are also county or city names; they are place names only unless the text speaks of the tribe or its people.
- Michigan: "Ottawa", "Chippewa" and "Menominee" are also county names and "Wyandotte" is a city; a county or city named for a nation is a place name only.
- Wyoming: "Cheyenne" is the state capital, and "Shoshone" and "Wind River" are also names of a national forest, a river, mountains and towns; they are place names only unless the text speaks of the tribes, the Wind River Indian Reservation or their people.
- Colorado: "Pueblo" is also a city and a county, and "Arapahoe", "Cheyenne", "Kiowa" and "Ute" are also names of counties, towns, creeks and passes; they are place names only unless the text speaks of a tribe, a pueblo as a Native community, or their people. Water law "reservations" of water are not Indian reservations.
