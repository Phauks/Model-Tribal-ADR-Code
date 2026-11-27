# Model court forms

Fill-in forms for people filing in a Tribal court, for courts to adopt or change (decision record [0049](../../docs/decisions/0049-draft-model-court-forms-before-gate-2.md)). They are CC0. The website lists them at /forms and offers each as Word and PDF at /help/forms/, with SHA-256 hashes.

## Starting a new form

1. Copy [blank-court-form.md](blank-court-form.md), the base every form starts from, and name the copy for what it asks, such as `petition-to-change-a-name.md`.
2. In the front matter, set `id` to the file name, write a one-line `summary`, and list each court form you drew on under `based_on` (nation id from `content/tribes/`, title, link, and the private copy under `tribal-court-forms/`).
3. Keep the parts the site test checks: the court and nation line, the line "Form `id`, version x.y.z. A court may adopt or change this form . . .", "Before you start" with "Court staff can explain the steps but cannot give legal advice," "Case information," an oath beginning "I swear or affirm," the notary or clerk block, and "Notes for courts adapting this form."
4. Put anything that differs between courts in a placeholder such as `{{court.answer_days}}`, defined in `content/variables/court.yaml` or `nation.yaml`.
5. In the notes, say which courts each part came from and mark choices that are the project's own.
6. Run `python3 scripts/forms/build_forms.py` to rebuild the Word and PDF copies and their hashes, and commit them.
