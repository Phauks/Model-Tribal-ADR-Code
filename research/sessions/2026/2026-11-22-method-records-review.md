---
id: 2026-11-22-method-records-review
date: '2026-11-22'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: other
  name: review page
  detail: A private claude.ai page listed the 33 method records in content/methods/ as they stood on main, each with its definition, sources, traits and forum count, and saved one decision per record (accept, set aside or needs changes) with an optional note.
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: Built the review page, read the saved decisions back and applied them to the records.
purpose: Gate 1, item 6 of the roadmap. The lead author accepts or sets aside each proposed method record, so every forum kind maps to an adopted method or stays "other" for a stated reason.
queries:
- every record in content/methods/ with status proposed (33)
- every forum in content/tribes/ recorded with kind other
sources_added: []
limits: >-
  The review covered the records as written; it did not re-check their sources. The forum counts shown on the review page came from the nation profiles on main on Nov. 22, 2026.
---

Decided: the lead author accepted all 33 method records on Nov. 22, 2026, with no notes and no changes asked. Each record's status moves from `proposed` to `adopted`, which the method schema defines as "reviewed" (`schemas/method.schema.json`, `status`).

Checked: 72 forums in the nation profiles carry a method as their kind, and one carries `other`. That one is Kalispel's Traditional Peacemakers Panel, whose note gives the reason: the code shows the panel acting in an adjudicative and enforcement role rather than as a consensual forum (`content/tribes/k/kalispel-indian-community-of-the-kalispel-reservation.yaml`).

Result: Gate 1 item 6 is complete ([roadmap](../../../docs/roadmap.md#gate-1-review-of-the-pull-request-2-data)).
