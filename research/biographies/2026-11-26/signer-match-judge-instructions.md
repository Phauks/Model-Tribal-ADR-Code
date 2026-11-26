# Same person or not? Native signers of U.S. treaties

Each item in the input file is a pair of signer entries taken from the signature pages of two different ratified U.S. treaties with Native nations. For each pair, decide whether the two entries are probably the SAME PERSON, probably DIFFERENT people, or whether you CANNOT TELL.

Each entry gives: the name as printed (often a phonetic spelling by a U.S. clerk, with hyphens, OCR errors and inconsistent spelling between treaties), the English rendering printed with it (if any), any title printed with it, the nation or band it was signed for (as printed), the treaty, and the year.

Things to weigh:
- Clerks spelled the same Native name very differently from treaty to treaty (for example "Me-she-kun-nogh-quoh" and "Mushekeuoghqua" for Little Turtle), so different spellings can be one person.
- Different people can have similar or identical names, especially short names, common English renderings ("Wolf", "Big Bear", "Lone Chief"), and Christian names ("John Smith", "Louison"). A name could also be a hereditary title held by successive people.
- Same nation or a closely related band, and a short gap in years, make the same person more likely. Different nations, or a gap of more than about 30 years, make it less likely.
- An English rendering that differs clearly in meaning points to different people; one that matches points to the same person, but only if the nation also fits.
- You may use what you reliably know about well-known historical leaders, but say so in the reason. If you are guessing, answer cannot_tell.

## Output

Write a JSON array to the output path you were given, one object per pair, in input order:

```json
{"id": "p001", "verdict": "same", "confidence": "high", "reason": "same English name Black Hoof, both Shawnee, ten years apart"}
```

verdict is one of "same", "different", "cannot_tell"; confidence is "high", "medium" or "low"; reason is one short line. Judge every pair. When finished, reply with one line: the output path and the counts of each verdict.
