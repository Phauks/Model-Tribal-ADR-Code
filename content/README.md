# Content

Everything a reader reads, as plain files. The website and the print edition
are both built from this folder. Version: see [version.txt](version.txt);
history: see [CHANGELOG.md](CHANGELOG.md).

| Folder | Holds | Format | License |
| --- | --- | --- | --- |
| `provisions/` | Model provisions, one file per section, with alternatives | Markdown with YAML front matter | CC0 1.0 |
| `commentary/` | Comment, illustrations and source note for each provision | Markdown with YAML front matter | CC BY 4.0 |
| `essays/` | Part I essays and Part III methods-and-manners pieces | Markdown with YAML front matter | CC BY 4.0 |
| `forms/` | Fill-in forms (referral, agreement to participate, settlement, arbitration clause) | Markdown with placeholders | CC0 1.0 |
| `tribes/` | One profile per nation or community | YAML | CC BY 4.0 |
| `sources/` | One record per source: citation data, archive links, rights | YAML | CC BY 4.0 (records only, not the works they describe) |
| `glossary/` | One entry per defined term or acronym, linked from text as `[[id]]` | YAML | CC BY 4.0 |
| `variables/` | Placeholder definitions such as `{{nation.name}}` for templates | YAML | CC0 1.0 |

Each record type has a schema in [`../schemas/`](../schemas/) and is described
in [the data model](../docs/data-model.md).
