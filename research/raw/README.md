# Raw research data

Cited facts gathered during research sessions, before they become records in
`content/`. Each dated folder holds one JSON file per session or research
assistant. They are kept so every value in a profile can be traced back to the
step that found it, and so facts that did not fit the schema are not lost.

Licensed like the rest of `research/` (CC BY 4.0). Facts were taken from public
sources; office contact points only, never personal contact details.

## File shape

```json
{
  "agent": "name of the session or assistant",
  "sources": [{ "key": "...", "kind": "...", "title": "...", "author": "...",
                "url": "...", "issued": "...", "accessed": "...",
                "archive_url": "...", "archive_captured": "...", "notes": "..." }],
  "entities": [{ "id": "...", "official_name": "...", "entity_type": "..." }],
  "facts": [{ "nation": "profile id", "field": "e.g. population",
              "value": { }, "source": "source key",
              "confidence": "high | medium | low", "as_of": "YYYY[-MM[-DD]]",
              "locator": "...", "note": "..." }],
  "log": { "queries": [], "tools": [], "limits": "...", "narrative": "..." }
}
```

`field` names map to profile fields in `scripts/tribes/build_profiles.py`.
Each folder's `build-report.json` lists what the build merged, dropped and why.

## Folders

| Folder | Session logs |
| --- | --- |
| `2026-11-21/` | `research/sessions/2026/2026-11-21-*.md` |
