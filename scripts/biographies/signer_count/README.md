# Treaty signer count (Nov. 26, 2026)

Scripts behind [the signer count](../../../research/analyses/2026-11-26-treaty-signer-count.md). Nothing here writes site content.

1. `fetch_osu.py <repo> <dir>`: saves the OSU Tribal Treaties Database page (Kappler's transcription) for each of the 370 ratified treaties in `research/raw/2026-11-23/treaties.json`.
2. `osu_blocks.py <dir> <blocks.json>`: cuts each treaty's signature section, from the signing clause to the end.
3. U.S. signers were read from those sections by Haiku with [these instructions](../../../research/biographies/2026-11-26/us-signer-reader-instructions.md); the result, with every name checked against the text, is `research/biographies/2026-11-26/treaty-us-signers.json`.
4. `native_match.py <repo> <workdir>`: groups the Native signer lines (`research/biographies/2026-11-24/treaty-signers.json` plus the Kappler fill for 17 treaties) into people at each matching level.
5. `us_match.py <workdir>`: the same for U.S. signers; it reads `us-mentions.json` (the `signers` list of `treaty-us-signers.json` with `inText`).
