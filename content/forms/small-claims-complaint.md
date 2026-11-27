---
id: small-claims-complaint
title: Small claims complaint
version: 0.1.0
status: draft
license: CC0-1.0
kind: model-court-form
summary: Ask the court for a small amount of money or property in a simple, quick hearing.
based_on:
  - nation: fond-du-lac-band
    title: Small Claim Complaint and Affidavit, with instructions
    link: https://about.fdlband.org/government/courtforms/smallclaimsplaintiffpacket030519.pdf
    capture: tribal-court-forms/small-claims__fond-du-lac-band.pdf
  - nation: grand-traverse-band-of-ottawa-and-chippewa-indians
    title: Affidavit and Claim, Small Claims
    link: https://gtbindians.org/downloads/small_claims.pdf
    capture: tribal-court-forms/small-claims__grand-traverse-band.pdf
  - nation: kaw-nation
    title: Instructions for Filing a Small Claims Case
    link: https://www.kawnation.gov/wp-content/uploads/2023/12/Small-Claims-Instructions-2024.pdf
    capture: tribal-court-forms/small-claims__kaw-nation-instructions.pdf
  - nation: wyandotte-nation
    title: Small Claims Packet
    link: https://wyandotte-nation.org/wp-content/uploads/2025/02/WN-Small-Claims-Packet-2-21-2025001.pdf
    capture: tribal-court-forms/small-claims__wyandotte-nation.pdf
---

# Small claims complaint

**{{court.name}}**, {{nation.name}}

Form `small-claims-complaint`, version 0.1.0. A court may adopt or change this form under its own law. If your court has its own form for this, use the court's form.

## Before you start

- Use this form to ask for **{{court.small_claims_limit}} or less**, or for the return of property worth that much or less.
- Small claims are simple. The defendant does not have to file papers. Both of you tell your side to the judge at a hearing. {{court.small_claims_representation}}
- **Ask for payment first.** Before you file, ask the other person to pay or return the property, and keep a copy of what you sent.
- Filing fee: {{court.fee_small_claims}}. If you cannot pay, file the request to waive court fees with this form.
- The clerk will set a hearing date. The papers must be served on the defendant at least {{court.small_claims_notice_days}} days before the hearing. {{court.service_rule}}
- **Bring everything to the hearing:** witnesses, receipts, contracts, photos and letters.
- Court staff can explain the steps but cannot give legal advice.

## Case information

| | |
| --- | --- |
| Case number (clerk fills in) | |
| Hearing date and time (clerk fills in) | |

## 1. The parties

| | Plaintiff (you) | Defendant |
| --- | --- | --- |
| Full name, or business name | | |
| Mailing address | | |
| Physical address (needed for service) | | |
| Phone or email | | |
| Enrolled member of (nation, if any) | | |

## 2. Your claim

- ☐ The defendant owes me $______
- ☐ The defendant has my property and should return it: ______ Its value: $______

Why the defendant owes you, with dates:

______

Where it happened:

- ☐ Within {{nation.name}}'s territory or jurisdiction.
- ☐ Somewhere else: ______

## 3. Trying to settle

- ☐ I asked the defendant to pay or return the property on ______ (date), and they did not.
- ☐ I would try mediation or peacemaking before the hearing.

## 4. Oath and signature

I swear or affirm that what I have written in this claim is true, to the best of my knowledge, and that no part of the amount has been paid except as stated. I understand that a false statement can be punished under {{nation.name}} law.

| | |
| --- | --- |
| Signature | |
| Printed name | |
| Date | |

Notary or clerk, if the court requires it:

| | |
| --- | --- |
| Sworn or affirmed before me on (date) | |
| Signature and title | |

## Notice to the defendant

- You are being sued in small claims court for the amount or property listed above.
- You do not have to file any papers. **Come to the hearing** on the date set by the clerk and bring your witnesses and documents.
- **If you do not come, the court may decide the case without you** (a default judgment).
- If the plaintiff owes you money from the same events, ask the clerk how to file a counterclaim.
- Court address and hours: {{court.address}}

## Notes for courts adapting this form

These notes are not part of the form. They explain where each part came from.

- **What the four courts share.** All four issue a notice of hearing, need the defendant's address for service, use certified mail or another method, and let the defendant respond at the hearing. Three state a fee, require a sworn claim, state the amount, tell parties to bring witnesses, warn of default, require a prior demand and set a minimum time before the hearing (comparison of the forms listed in `based_on`, read Nov. 23, 2026).
- **No papers from the defendant.** Fond du Lac says, "The Defendant is not required to file any paperwork in response to your complaint." The model's notice says the same.
- **Dollar limit.** Fond du Lac caps claims at $5,000 and Grand Traverse Band at $7,000; Kaw and Wyandotte state no cap. The model uses `court.small_claims_limit`.
- **Lawyers.** Fond du Lac and Grand Traverse Band bar attorneys; Fond du Lac allows unpaid family spokespersons; Kaw allows lawyers registered with its bar. The model uses `court.small_claims_representation`.
- **Prior demand and mediation.** Fond du Lac requires a "good faith effort . . . to resolve the dispute," and Grand Traverse Band asks whether the dispute could be resolved "through mediation or other means." The model asks for both.
- **Who may file.** Fond du Lac requires one party to be an enrolled member and the debt to arise within the reservation; Wyandotte has a territory rule too. Those are jurisdiction rules for the court's code, so the form asks the facts only.
- **Time limit.** Fond du Lac bars claims filed more than one year after the plaintiff knew of them. That is a code rule.
