---
id: blank-court-form
title: Blank court form
version: 0.1.0
status: draft
license: CC0-1.0
kind: model-court-form
summary: The parts every model court form shares, for a court to write a form of its own or for anyone filing when the court has no form.
based_on: []
---

# Blank court form

**{{court.name}}**, {{nation.name}}

Form `blank-court-form`, version 0.1.0. A court may adopt or change this form under its own law. If your court has its own form for this, use the court's form.

## Before you start

- Use this form to ask the court to: ______
- Attach: ______
- Filing fee: ______. If you cannot pay, file the request to waive court fees with this form.
- Give a copy to every other party, and file a proof of service. Do not hand papers to a person you are afraid of; ask the clerk how they will be served.
- Court staff can explain the steps but cannot give legal advice.

## Case information

| | |
| --- | --- |
| Your name | |
| Your mailing address | |
| Your phone or email | |
| Other party, if any | |
| Other party's address, if known | |
| Case number (clerk fills in) | |

## 1. What you are asking the court to do

- ☐ ______
- ☐ ______
- ☐ Other: ______

## 2. Why

Say what happened, in order, with dates and places. Put each fact in its own numbered paragraph.

1. ______
2. ______
3. ______

## 3. Documents

- ☐ I attach documents that support this request. List: ______

## 4. Other cases

- ☐ There is no other case about these matters, in any court.
- ☐ There is another case. Court, case number and what it is about: ______

## 5. Oath and signature

I swear or affirm that what I have written in this form is true, to the best of my knowledge. I understand that a false statement can be punished under {{nation.name}} law.

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

## Order

- ☐ **Granted.** ______
- ☐ **Denied**, because: ______
- ☐ A hearing is set for: ______

| | |
| --- | --- |
| Judge | |
| Date | |

## Notes for courts adapting this form

These notes are not part of the form. They explain how to use it.

- **What it is.** The parts that all nine of the project's model court forms share: the court and nation at the top, the version line, "Before you start," case information, an oath and signature with a notary or clerk block, and notes like these (comparison of the forms in this folder, Nov. 23, 2026). Each model form starts from this one, and a site test checks that each keeps those parts.
- **For a court.** Replace the blanks in "Before you start" and section 1 with what this kind of request needs, add numbered sections for the facts the judge must have, and delete what does not apply. Keep "Court staff can explain the steps but cannot give legal advice," which tells people what the clerk can do.
- **For a person filing.** Where a court has no form for a request, many courts accept a written request with this information. Ask the clerk first.
- **Writing style.** Plain words and short sentences; one question per line; ☐ for a choice and ______ for a blank; a placeholder such as `court.answer_days` for anything that differs from court to court, defined in `content/variables/`. Legal information only: say what to file, when and where, never whether someone should.
