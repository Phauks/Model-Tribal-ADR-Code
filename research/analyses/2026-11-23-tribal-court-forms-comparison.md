# Tribal court forms compared, for the model court forms

**Status:** research notes, written Nov. 23, 2026, for the nine model court forms in `content/forms/`. Trevor asked for model forms "based upon what exists" after the [self-help forms note](2026-11-23-self-help-forms.md) found that Tribal court forms are scattered across single courts. Statements marked "project analysis" are my reading of the forms, not a court's words. Each form's own "Notes for courts adapting this form" section cites the courts behind each choice.

## 1. What was collected

I searched Native nations' court websites and the Bureau of Indian Affairs' Court of Indian Offenses pages for fill-in forms of the kinds the self-help note ranked highest. I saved 64 files from 30 courts and one Tribal consortium (Tanana Chiefs Conference), each kept as a private copy in the R2 bucket under `tribal-court-forms/` and listed in [capture-index.csv](../capture-index.csv). 19 links failed (errors or bot checks); they are on the hand-pull list, part 4f.

| Form type | Courts read | Model form |
| --- | --- | --- |
| Fee waiver (in forma pauperis) | 12 | [Request to waive court fees](../../content/forms/request-to-waive-court-fees.md) |
| Protection order petition | 10 | [Petition for a protection order](../../content/forms/petition-for-a-protection-order.md) |
| Recognizing another court's order | 8 | [Petition to recognize an order from another court](../../content/forms/petition-to-recognize-an-order-from-another-court.md) |
| Guardianship of a minor | 9 | [Petition for guardianship of a child](../../content/forms/petition-for-guardianship-of-a-child.md) |
| Name change (adult or child) | 7 | [Petition to change a name](../../content/forms/petition-to-change-a-name.md) |
| Civil complaint and summons | 6 | [Complaint and summons](../../content/forms/complaint-and-summons.md) |
| Answer | 3 | [Answer to a complaint](../../content/forms/answer-to-a-complaint.md) |
| Proof of service | 3 | [Proof of service](../../content/forms/proof-of-service.md) |
| Small claims | 4 | [Small claims complaint](../../content/forms/small-claims-complaint.md) |

## 2. How the comparison was made

For each type, the text of every form was read and each element (a field, a statement, a warning, a deadline) was counted by the number of courts using it, with a short quote and the file it came from. Those tables are in [tribal-court-forms/](tribal-court-forms/): [fee waivers](tribal-court-forms/fee-waiver.md), [protection orders](tribal-court-forms/protection-order.md), [orders from other courts](tribal-court-forms/foreign-order.md), [guardianship and name change](tribal-court-forms/family-status.md) and [civil cases](tribal-court-forms/civil.md). The texts came from OCR of scanned PDFs, so quotes keep its errors.

A model form keeps an element that most of the courts share, and adds one that only a few use when it protects the person filing or saves the court work (project analysis). Examples: the protection order form puts the choice to keep an address private first, as five of ten courts allow; the fee waiver form lets a person on public benefits skip the money questions, as Leech Lake and Kickapoo do. Where a choice is the project's own and no court made it, the form's notes say so.

## 3. What the forms share

- **Plain words.** Each form starts with "Before you start," says what to attach, who serves the papers and that court staff "cannot give legal advice," which BIA Southern Plains, Comanche, Kaw and Wyandotte all say in some form ([civil comparison](tribal-court-forms/civil.md#plain-language-features)). This keeps the forms to legal information, not advice, as the self-help note recommends ([self-help note, section 4](2026-11-23-self-help-forms.md#4-legal-information-not-legal-advice)).
- **Placeholders.** What differs court to court (fees, deadlines, service rules, the age a child's view is asked) is a placeholder defined in [content/variables/court.yaml](../../content/variables/court.yaml) and [nation.yaml](../../content/variables/nation.yaml), with the range the forms showed. Jurisdiction rules, such as membership or residence to file, stay out of the forms and belong in each court's code.
- **One oath.** Every form ends with the same sworn statement and a notary or clerk block, to be dropped where the court accepts unsworn filings.
- **Settlement.** The civil forms point to mediation or peacemaking. Only Grand Traverse Band's small claims form does this among the sources ([civil comparison](tribal-court-forms/civil.md#differences-worth-noting)); adding it is the project's choice, because this project is about dispute resolution.

## 4. Gaps found

- No source form cites 18 U.S.C. § 2265, 25 U.S.C. § 1911(d) or the Full Faith and Credit for Child Support Orders Act in a petition to recognize another court's order ([orders comparison](tribal-court-forms/foreign-order.md)). The model form names them.
- None of the 13 fee waiver files says how to ask the court to reconsider a denial ([fee waiver comparison](tribal-court-forms/fee-waiver.md)).
- None of the nine guardianship forms mentions the Indian Child Welfare Act, which governs state courts, not Tribal courts (National Indian Child Welfare Association, *The Indian Child Welfare Act: A Family's Guide* (2026)).
- The one earlier set of model Tribal court forms found, a Wisconsin set on WisLawHelp, could not be downloaded (hand-pull list, part 4f).

## 5. Where the forms appear

The website lists files in `content/forms/` at /forms as "Model forms," which can be filled in on screen and printed, and sends nothing to the project ([forms.ts](../../site/src/lib/forms.ts)). Word and PDF copies are built by [scripts/forms/build_forms.py](../../scripts/forms/build_forms.py) and offered on each form's page with their SHA-256 hashes (decision record [0049](../../docs/decisions/0049-draft-model-court-forms-before-gate-2.md)).

## Sources

- The 64 court forms listed in each model form's `based_on` front matter and in [capture-index.csv](../capture-index.csv) under `tribal-court-forms/`, all downloaded Nov. 23, 2026.
- National Indian Child Welfare Association, *The Indian Child Welfare Act: A Family's Guide* (2026), cited in the [self-help forms note](2026-11-23-self-help-forms.md).
