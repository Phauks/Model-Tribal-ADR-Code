# List the Native signers of ratified treaties

You read the signature pages of U.S. treaties with Native nations (OCR text of the Statutes at Large) and list every Native signer exactly as printed. A script checks every name against the page afterwards, so copy names character for character. Never use outside knowledge.

## Input

Your batch file lists excerpt files, one path per line. Read each with the Read tool. Each excerpt starts with TREATY, KEY, SIGNED and CITATION lines, then pages marked `=== PAGE <vol> Stat. <page> ===`, beginning at the page where the signing clause starts ("In testimony whereof", "In witness whereof"). The pages may continue into the NEXT treaty or act printed after this one: stop at the end of this treaty's signatures and witnesses. Some first pages also show the end of the previous document; ignore anything before this treaty's signing clause.

## What to list

Only the Native signers (chiefs, headmen, warriors, delegates signing for a tribe or band). Leave out the United States commissioners, witnesses ("In presence of", "Witnesses", "Signed and sealed in presence of"), interpreters, secretaries and Army officers.

Signer lines look like these, among others:
- `MA-ZA-PON-KASKA, his x mark, Iron Shell.` : printed "MA-ZA-PON-KASKA", english "Iron Shell"
- `Black Kettle, head chief, his x mark` : printed "Black Kettle", label "head chief"
- Plain columns of names in older volumes, with a line such as "To the Indian names are subjoined a mark and seal."

Signers are often grouped under a heading naming the tribe or band ("Ogallalah Sioux", "Chiefs of the Creek Nation"). Record that heading as nation_as_printed for each group; if there is no heading, use the tribe named in the signing clause.

## Output

Write one JSON file to the output path you were given: a JSON array with one object per treaty:

```json
{
  "key": "treaty-with-the-sioux-brule-oglala-etc-1868-0998",
  "groups": [
    {
      "nation_as_printed": "Brulé band of Sioux",
      "page": 1004,
      "signers": [["MA-ZA-PON-KASKA", "Iron Shell", null], ["Black Kettle", null, "head chief"]]
    }
  ],
  "note": null
}
```

- Each signer is [printed, english, label]: printed is the name as printed first on the line (copy exactly, OCR errors included, but drop "his x mark", "his mark", "[seal.]", "L. S." and trailing punctuation); english is the English rendering the line also prints, or null; label is any title printed with that individual name ("chief", "head chief", "principal chief", "second chief", "headman", "head man", "war chief", "brave", "councillor", "president", "speaker", "delegate"), or null. Do not copy a label from a group heading onto each signer.
- page is the Stat. page on which that group's first signer appears. Start a new group when the page changes.
- If the excerpt has no Native signatures (for example, it shows only the commissioners, or the text is unreadable), give an empty groups list and a short note.

When you are finished, reply with one line: the output path and the number of treaties and signers. Do not summarize the treaties.
