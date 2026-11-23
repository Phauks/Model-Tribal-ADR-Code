# Stories

One record per story, account or teaching about resolving disputes, making peace or restoring relationships, as a Native nation or its people tell it (decision record [0019](../../docs/decisions/0019-story-records.md); schema [`story.schema.json`](../../schemas/story.schema.json)).

- Path: `stories/<first letter of id, or _other>/<id>.yaml`.
- The project never retells a story. A record quotes the telling exactly, in short excerpts (50 words or fewer) with a pinpoint, where the rights allow; otherwise it keeps the words privately and records only the pinpoint and a fingerprint. Each telling cites its own source record in `content/sources/`, or a private contributor filing.
- Credit, permitted uses, access and cultural authority use the shapes in `schemas/common.schema.json`, shared with contributor records.
- Protocols (season, setting, clan or family ownership, ceremony, names not spoken) are recorded only when a source states them.
- A nation may correct, restrict or remove any record here (charter, commitment 6).
- `full_text` holds the whole story in the teller's exact words, paragraph by paragraph, and the website shows it first (decision records [0034](../../docs/decisions/0034-show-stories-in-full-where-rights-allow.md) and [0036](../../docs/decisions/0036-show-every-story-in-full.md)). Its `basis` says why it may be shown: a public-domain telling, a nation's own law or court decision, permission to publish in full, or the lead author's decision to show every story in full. Passages left out are marked where they were.
- The website shows every story here at `/stories` (decision record [0029](../../docs/decisions/0029-show-stories-while-nations-review-them.md)). A story still marked `nation-review-first` carries a notice that the nation has not reviewed it, and every story page links to a removal request. A story or telling marked `restricted`, or embargoed before its date, is never shown. A new record appears on the next build.
