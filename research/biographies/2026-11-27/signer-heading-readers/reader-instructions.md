# Which group heading was each treaty signer printed under?

You check the Native signers of one U.S. treaty at a time. Each packet file has three parts:

- **A.** The Statutes at Large signature pages, laid out as printed (columns side by side).
- **B.** The same treaty as printed in Kappler (a transcription; Kappler also prints signers in two columns, and this transcription often interleaves the two columns line by line, so a heading in B can appear one line away from the names it belongs to).
- **C.** The recorded signers: id, printed name, English name, label, and the recorded GROUP (the nation or band heading the signer was recorded under).

An earlier reader read the pages line by line across both columns, so a heading printed at the top of the right column was sometimes attached to the name on the same line in the left column, and names printed below a heading in one column were sometimes given the heading from the other column. Your job is to decide, for every id in C, which heading the page actually prints above that name.

## How printed signature columns work

- Signers are printed in one, two or three columns. Read the left column from top to bottom, then the next column from top to bottom.
- A heading (for example "Wyandots.", "Munsee.", "Stockbridges.", "Seminoles.", "Chiefs of the Ottawas:") applies to the names below it **in its own column**, until the next heading in that column. A heading centred across the whole page applies to all columns below it.
- At the top of a column with no heading of its own, the names continue the group that was running at the bottom of the previous column (or of the previous page).
- A name printed before any heading has no heading. A label printed beside a single name ("Munsee chief") is not a heading.
- Use A first. Use B to confirm, keeping in mind it may interleave columns. If A and B disagree or the layout is unclear, say so with confidence "low".
- Do not use outside knowledge about who these people were.

## Output

For each packet listed in your batch file, write one JSON file to your output folder, named `<KEY>.json`:

```json
{"key": "treaty-with-the-stockbridge-and-munsee-1839-0529",
 "party_in_text": "Stockbridge and Munsee tribes of Indians",
 "signers": [[7770, null, "high", "first name under the commissioner; the Munsee heading is in the right column"], [7771, "Munsee", "low", ""]]}
```

- `party_in_text`: the tribe or tribes the treaty's opening or signing clause names, copied as printed.
- `signers`: one entry for EVERY id in part C: `[id, group, confidence, note]`.
  - `group` is the heading printed above that name in its column. If the heading is the same as one of the recorded GROUP strings in C (allowing for small spelling or punctuation differences), copy that recorded string exactly. Otherwise copy the heading as printed. Use `null` when no heading is printed above the name.
  - `confidence`: "high" when the page layout makes it clear, "low" otherwise.
  - `note`: a few words, required when your group differs from the recorded GROUP; otherwise "".
- If a recorded name is not a Native signer at all (a witness, interpreter or U.S. commissioner), give group `"NOT A SIGNER"`.

Write each file as soon as you finish that treaty. When all are done, reply with one line: how many treaties you wrote and how many ids you gave a group different from the recorded one.
