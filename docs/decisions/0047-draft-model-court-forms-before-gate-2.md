# 0047. Draft model court forms for people using Tribal courts before Gate 2

- **Status:** Accepted
- **Date:** 2026-11-23

## Context

The outline's scope question 10 decided on Nov. 22, 2026 to include "a small set" of model forms "tied to the general division first," and the roadmap holds drafting until Gate 1 and Gate 2. On Nov. 23 a survey found no national help center for Tribal law. Each court's forms stand alone, and the kinds people need most (fee waivers, protection orders, recognizing outside orders, family and civil filings) differ from court to court ([self-help forms note](../../research/analyses/2026-11-23-self-help-forms.md)). Trevor Goldsmith wrote, "If it is disparate. We should make our own model forms and stuff based upon what exists," and then asked that forms be offered "as docs and as PDF," with "a hash verifier that ppl can use."

## Decision

Trevor chose "Draft help forms now" on the thread's decision card.

- **Court forms now; dispute resolution forms later.** Model court forms for people filing in a Tribal court are drafted now, from the forms courts already use. Forms tied to the code's dispute resolution divisions (asking for peacemaking, an agreement to take part) still wait for the general division, under scope question 10.
- **They are model forms, not the code.** They carry no provision text. Each says a court may adopt or change it and that a court's own form comes first. What differs between courts is a placeholder in `content/variables/`.
- **Grounded in sources.** Each form lists the court forms it was based on in its front matter, and a "Notes for courts adapting this form" section names the courts behind each choice. Choices no court made are marked as the project's.
- **Legal information only.** The forms tell people what to file, when and where, never whether they should, and say court staff cannot give legal advice.
- **Word, PDF and hashes.** Every form is built as .docx and .pdf, with a SHA-256 hash for each file, by `scripts/forms/build_forms.py`. The site serves the copies at `/help/forms/<slug>.docx` and `.pdf` and shows each hash beside its link on the form's page, with a list for `sha256sum -c`. Each form is also fillable and printable at /forms.

## Consequences

- Nine forms in `content/forms/` (version 0.1.0, CC0), with `court` and `nation` placeholder groups.
- The /forms page builder now skips a form's front matter and uses its summary.
- The copies are committed under `site/static/help/forms/`, because the site's build has no pandoc or LibreOffice. Whoever changes a form or a placeholder runs the script again; a site test fails until they do. The .docx files come out the same byte for byte; each PDF build gets a new hash, so a PDF is rebuilt only when its form changes.
- The shared download verifier (`/verify`, from the offline downloads work) covers `/help/forms/` once it lands, so people can also check a file in the browser.
- Advisors should review the forms before they are offered to courts, as the self-help note recommends for anything a person might file.

## Sources

- Trevor Goldsmith, project thread "Draft model forms for Tribal court users", 2026-11-23 (messages "If it is disparate. We should make our own model forms and stuff based upon what exists" and "When we offer forms, we should offer as docs and as PDF. When we offer documents or downloads, we should also generate a hash verifier that ppl can use"; decision card answer "Draft help forms now").
- [Working outline](../outline.md), scope question 10.
- [Tribal court forms comparison](../../research/analyses/2026-11-23-tribal-court-forms-comparison.md).
