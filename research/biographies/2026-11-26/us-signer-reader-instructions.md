# List the United States signers of ratified treaties

You read the signature sections of U.S. treaties with Native nations (Kappler's transcription, from the Oklahoma State University Tribal Treaties Database) and list every person who signed FOR THE UNITED STATES. A script checks every name against the text afterwards, so copy names character for character. Never use outside knowledge about who was present; decide only from the text.

## Input

Your batch file lists excerpt files, one path per line. Read each with the Read tool. Each excerpt starts with TREATY, KEY and SIGNED lines, then the text from the signing clause ("In testimony whereof", "Done at ...") to the end. Lines starting with # were bold headings. Runs of Native signers marked "his x mark" have been replaced by a line like `[25 line(s) of names marked "his x mark" omitted]`. Some excerpts also hold supplementary articles, schedules or later assents with their own signatures; include U.S. signers of those too. If a NOTE line says no signing clause was found, the excerpt is the last part of the treaty text: find the signatures in it.

## Who counts as a U.S. signer

People who signed as parties for the United States: commissioners, plenipotentiaries, governors or superintendents signing as commissioners, Indian agents signing as commissioners, Army officers signing as commissioners. They usually sign right after the signing clause, before or after the Native signers, often with a title like "commissioner", "Commissioner of Indian Affairs", "superintendent", "U. S. agent", or a military rank, and the clause often names them ("we, the said commissioners").

Leave out:
- Witnesses: everyone listed after "In presence of", "Witnesses", "Attest", "Test", "Signed and sealed in presence of", "Signed in presence of", even if they are officials or agents.
- Interpreters, secretaries and clerks to the commission, unless the text clearly makes them a signing commissioner.
- Native signers, including Native signers who signed their own names without a mark (for example literate Cherokee, Choctaw, Creek, Stockbridge or Seneca signers listed under the nation's chiefs, delegates or a tribal heading).
- People only named in the body of the text or in a schedule of payments.

If a signer could be either a U.S. commissioner or a Native or witness and the text does not settle it, put the name in "unsure" instead.

## Output

Write one JSON file to the output path you were given: a JSON array with one object per treaty, in the order of the batch file:

```json
{"key": "treaty-with-the-delawares-1778-0003", "us_signers": [["Andrew Lewis", null], ["W. T. Sherman", "Lieutenant-General"]], "unsure": [], "note": null}
```

- Each U.S. signer is [name, title]: name exactly as printed (drop "[L. S.]", "[SEAL.]" and trailing punctuation), title is the title printed with the name or null.
- If a name is printed twice (for example signing the treaty and a supplementary article), list it twice.
- If the excerpt shows no U.S. signers, give an empty list and a short note.

When you are finished, reply with one line: the output path and the number of treaties and U.S. signers. Do not summarize the treaties.
