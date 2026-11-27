# Offices the treaty text gives its United States signers

Each item in the input file is one ratified U.S. treaty with Native nations, from Kappler's transcription: `opening` (the first part of the treaty text, which usually names the commissioners), `signatures` (the signature section), and `signers` (the people already found to have signed for the United States).

For each name in `signers`, list every office, rank or position that THIS treaty's text gives that person, for example "Governor of the Territory of Michigan", "Superintendent of Indian Affairs", "brigadier general in the army of the United States", "Secretary of War", "agent of Indian affairs", "Commissioner of Indian Affairs", "major-general". Also list "commissioner" (or "commissioner plenipotentiary", "special commissioner") when the text calls the person that.

Rules:
- Copy each office exactly as printed in the text (same words, same order, same spelling), as short as it can be while still complete: "Governor of Missouri Territory", not the whole sentence. Leave out the person's name and words like "and", "the said".
- Only offices the text ties to that person. A title printed next to a group ("commissioners on the part of the United States") counts for each person in the group.
- Do not add anything you know from elsewhere. If the text gives the person no office, give an empty list.
- Names in the text may be spelled a little differently from `signers` (for example "Wm. Clark" and "William Clark"); match them sensibly.

## Output

Write a JSON array to the output path you were given, one object per treaty, in input order:

```json
{"key": "treaty-with-the-sioux-1815", "signers": [{"name": "William Clark", "offices": ["Governor of Missouri Territory", "commissioner plenipotentiary"]}]}
```

Use the names exactly as given in `signers`. When finished, reply with one line: the output path and how many treaties you read.
