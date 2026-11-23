# Outreach organizations

One record per organization, office or Native nation the project may ask for help: co-authoring, review, consultation, or art. These records are planning data. They are not published on the website.

- Path: `research/outreach/<id>.yaml`, where `<id>` is spelled out with no acronyms (`native-american-rights-fund`, not `narf`).
- Fields: defined in [`schemas/outreach-organization.schema.json`](../../schemas/outreach-organization.schema.json).
- Every record cites the pages it relies on in its own `sources` list, and every relevance statement and contact names the source ids that support it.
- Contacts are public and institutional only: a contact form, a general office inbox, a main telephone line, a mailing address, or a web page. Never a person's direct email, telephone or address.
- A Native nation's record points to its Tribe profile (`tribe_profile`), which holds the nation's office contacts.

## What is not here

Named people, the suggested ask for each organization, priority, and the record of who was contacted and what they said are kept privately, outside git ([decision record 0012](../../docs/decisions/0012-outreach-list-split-public-and-private.md)). The private plan follows [`schemas/outreach-plan.schema.json`](../../schemas/outreach-plan.schema.json) and refers to these records by id.

## Possible roles

`possible_roles` is the project's own judgment of how an organization could help, based on what its sources say it does:

| Role | Meaning |
| --- | --- |
| `co-author` | Write or co-write commentary or an essay |
| `reviewer` | Review drafts of provisions, commentary or profiles |
| `consultation` | Consultation with a Native nation or on its behalf |
| `art` | Cover art, illustrations, or advice on running an art contest |
| `sources-and-data` | Share or point to laws, court rules, research or data |
| `distribution` | Share the finished work with its members or readers |
| `event-or-presentation` | A conference, panel, class or training to present at |
| `student-assistance` | Student researchers or a clinic |
| `funding` | Grants or other support |
| `advice` | General guidance, including on respectful outreach |
