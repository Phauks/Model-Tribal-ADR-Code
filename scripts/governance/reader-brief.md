# Brief for the AI readers: governance facts from a nation's constitution

You read the text of one Native nation's constitution (or articles of association, or constitution and bylaws) at a time and copy out plain facts about how its government is set up. You never summarize, interpret or guess. Every fact you give must be stated in the text, and you must copy the words that state it exactly.

## Input

A batch file (JSON list). Each row names a nation (`nation`, `nation_name`), the version of its document (`version_label`) and `text_path`, the plain-text extract of that document. Many extracts come from scanned pages, so they have reading errors (for example `nay` for `may`, broken words, stray characters). Read each text in full with the Read tool (use `offset` and `limit` to page through a long file).

## Output

Write one JSON file, the path given to you, holding a list with one object per row of the batch, in the same order:

```json
{
  "nation": "<nation id from the batch>",
  "version": "<version id from the batch>",
  "readable": true,
  "problem": "",
  "facts": [
    {
      "aspect": "governing-body",
      "value": "Tribal Council",
      "quote": "The governing body of the Example Tribe shall be the Tribal Council.",
      "locator": "Article IV, Section 1"
    }
  ]
}
```

- `readable`: false when the text is not this nation's governing document (another nation's, a charter of a business corporation, a letter, a ballot, an amendment only) or is too garbled to read; say why in `problem` and give no facts.
- `problem`: anything a checker should know, in one sentence (for example "Pages 4-6 missing from the scan"). Empty when nothing.
- `facts`: as many as the text supports, at most one per aspect unless the text sets up two distinct bodies or offices (for example a General Council and a Business Committee). Leave an aspect out when the text does not state it.

### Each fact

- `aspect`: one of the aspects below.
- `value`: a few plain words giving the fact, using the document's own names for bodies and offices (keep "Chairman" if the text says "Chairman"; keep "Business Committee"). No sentence, no explanation, no judgment such as "strong" or "independent". Numbers as digits: "7 members", "4 years", "18".
- `quote`: the words of the text that state the fact, copied character for character from the extract, reading errors included, as one unbroken passage of at most 300 characters. Do not fix spelling, do not join two passages, do not add or drop words, do not use "...". A checker program looks for the quote in the text and throws the fact away if it is not there.
- `locator`: where it is, as the text labels it: "Article V, Section 2" or "Art. V, § 2". Empty if the text has no labels.

### Aspects

| aspect | what to give as `value` |
| --- | --- |
| `form` | How the document itself names the form of government or the authority it is adopted under, in its words, for example "Constitution adopted under the Indian Reorganization Act of June 18, 1934", "Articles of association", "General Council". Only when the text says it. |
| `governing-body` | Name of the body that holds the nation's lawmaking or governing power ("Tribal Council", "Business Committee", "Village Council"). |
| `governing-body-size` | How many members it has, "7 members". If the text gives a formula (one per district), give the formula in a few words. |
| `governing-body-selection` | How its members are chosen: "Elected at large", "Elected by district", "Chosen by the General Council". |
| `governing-body-term` | Term of office of its members: "4 years, staggered". |
| `general-council` | A body of all voting citizens, when the document sets one up: who sits in it, for example "All enrolled citizens 18 or older". |
| `head-of-government` | Title of the office that leads the government or presides over the governing body ("Chairman", "President", "Governor", "Principal Chief"). |
| `head-of-government-selection` | How that officer is chosen: "Elected by the voters", "Chosen by the Council from its members". |
| `head-of-government-term` | That officer's term: "4 years". |
| `other-officers` | Titles of the other officers the document names, in its order: "Vice-Chairman, Secretary, Treasurer". |
| `elections` | When regular elections are held: "Every 2 years on the first Saturday in June". |
| `voting-age` | Minimum age to vote: "18". |
| `election-authority` | The body that runs elections: "Election Board". |
| `branches` | The branches of government the document sets up, when it names them: "Legislative, executive and judicial". |
| `separation-of-powers` | Give "Stated" when the text says the branches' powers are separate or that one branch shall not exercise another's powers; the quote must say it. |
| `judiciary` | The court or judicial body the document sets up, or the power it gives to set one up: "Tribal Court and Court of Appeals", "Council may establish a tribal court by ordinance". |
| `judicial-selection` | How judges are chosen: "Appointed by the Council", "Elected by the voters". |
| `judicial-term` | Judges' term: "4 years". |
| `judicial-independence` | A protection the text gives judges or the courts, in a few words: "Judges removable only for cause", "Pay may not be reduced during term", "Council may not overturn court decisions". One fact per protection. |
| `amendment` | How the document is amended: "Majority vote in a Secretarial election", "Two-thirds vote of the General Council". |
| `secretarial-approval` | Whether amendments (or ordinances) need the Secretary of the Interior's approval: "Required for amendments", "Not required", "Requirement removed". The quote must say it. |
| `recall-and-removal` | How an official can be removed or recalled: "Recall by petition of 30% of voters", "Removal by two-thirds vote of the Council". Removal by the council and recall by the voters are both this aspect, one fact each. |
| `other` | Another fact about how the government is set up that a reader would want (for example a council of elders with a stated role, or clans choosing representatives). Use sparingly. |

## Rules

- Only what this text states. Do not use what you know about the nation from elsewhere.
- Facts about how the government is set up only. Nothing about membership rules, land, a bill of rights, or business enterprises, unless it is one of the aspects above.
- Copy names faithfully, including Native-language words and diacritics.
- If the text contradicts itself (for example an amendment changes the council's size), give the later or amended value, and say so in `problem`.
- If the text is plainly a different version from `version_label` (another year), still read it and say so in `problem`.
- Work through every row of the batch; do not skip any. Write the output file once, at the end, with the Write tool, as valid JSON.
