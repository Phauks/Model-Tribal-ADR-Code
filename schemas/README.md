# Schemas

JSON Schemas (draft 2020-12) for every record type. See
[docs/data-model.md](../docs/data-model.md) for what each record is for and how
they connect. `examples/` holds one valid example per schema; the tribe example
uses a fictitious nation on purpose.

| Schema | Validates |
| --- | --- |
| `common.schema.json` | Shared types used by the others |
| `source.schema.json` | `content/sources/<letter>/*.yaml` |
| `permission.schema.json` | The `rights` field of a source |
| `document-history.schema.json` | `content/documents/<letter>/*.yaml` (decision record 0018) |
| `tribe.schema.json` | `content/tribes/<letter>/*.yaml` |
| `provision.schema.json` | Front matter of `content/provisions/*.md` |
| `commentary.schema.json` | Front matter of `content/commentary/*.md` |
| `glossary.schema.json` | `content/glossary/*.yaml` |
| `method.schema.json` | `content/methods/*.yaml` |
| `variable.schema.json` | `content/variables/*.yaml` |
| `research-session.schema.json` | Front matter of `research/sessions/**/*.md` |
| `outreach-organization.schema.json` | `research/outreach/*.yaml` |
| `outreach-plan.schema.json` | The private outreach plan, kept outside git (decision record 0012) |
