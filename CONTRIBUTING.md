# Contributing

Thank you for helping. This project collects and models dispute resolution
practices of Native nations, so contributions follow the
[project charter](docs/charter.md) as well as the technical rules below.
Please read the charter first.

## Ways to contribute

- **Tribal reviewers, judges, peacemakers and scholars:** comment on drafts.
  When the website is live, you will be able to comment there without a GitHub
  account. Until then, open an issue or contact the maintainer.
- **Authors:** propose essays, commentary or illustrations through a pull
  request, or send text to the maintainer to submit for you.
- **Technical contributors:** improve the website, build or tooling through
  pull requests.

## Rules for content

1. **Cite everything.** Every factual claim needs a source record in
   `content/sources/` and a citation key in the text. Mark your own analysis as
   analysis. See [docs/citation-style.md](docs/citation-style.md).
2. **Say how you checked it.** Give every fact in a profile a `verification`
   level: `read-in-full`, `title-only`, `bulk-import` or `inferred` (see
   [docs/data-model.md](docs/data-model.md)). A pull request that adds or
   changes a fact without one fails the record lint
   (`python3 scripts/lint_records.py --base origin/main`).
3. **Archive what you cite.** Each web source needs an archived snapshot link
   and a retrieval date in its source record. The lint fails a source record
   that still has none 30 days after retrieval.
4. **Record rights before quoting.** Fill in the `rights` field of the source
   record before quoting more than a short passage. See the permission
   statuses in [docs/data-model.md](docs/data-model.md).
5. **Respect restricted knowledge.** Do not add ceremonial, restricted or
   community-held knowledge unless the community has approved it in writing.
   When unsure, mark the record `tribal-review-required` and ask.
6. **Use the project's words.** Follow the [style guide](docs/style-guide.md)
   and the [terminology guide](docs/terminology.md), and link defined terms
   with `[[id]]`.
7. **Log your research.** Add a dated session file under `research/sessions/`
   describing how you found what you added. See
   [research/README.md](research/README.md).

## Issues

Use the issue forms on GitHub: Correction, Source, Term or definition,
Content proposal, Bug, or Idea. Each form adds labels for its type and track,
and `status: needs triage` until the maintainer reviews it.

Requests from a Native nation to correct, restrict or remove material, and
anything involving restricted or community-held knowledge, are **not** opened
as public issues. Use the private route in [docs/requests.md](docs/requests.md)
([decision record 0009](docs/decisions/0009-private-requests-from-nations.md)).

A pull request that resolves an issue says so in its description, for example
`Closes #12`, so the issue closes when the pull request merges.

## Workflow

1. Create a short-lived branch from `main`, named by track and topic:
   `content/peacemaking-confidentiality`, `site/pwa-manifest`,
   `pdf/lulu-margins`, `docs/charter-wording`, `research/2026-11-nevada-codes`.
2. Write commit messages in the
   [Conventional Commits](https://www.conventionalcommits.org/) form, with a
   scope naming the track when one applies:
   - `feat(content): add peacemaking confidentiality provision`
   - `fix(site): correct footnote anchor links`
   - `docs: clarify permission statuses`
3. Sign off each commit (`git commit -s`) to certify, under the
   [Developer Certificate of Origin](https://developercertificate.org/), that you
   have the right to submit it under this project's licenses.
4. Run the checks locally (the same checks run on every pull request and are
   summarized as one required check, `All checks`): `python3 scripts/check_text.py` and, after
   `pip install -r scripts/requirements.txt`, `python3 scripts/validate_records.py`.
5. Open a pull request against `main` and fill in the template.
6. Pull requests are squash-merged. The branch is deleted automatically after
   merge.

Nobody pushes directly to `main`.

## Versions and changelogs

Do not edit `version.txt` or `CHANGELOG.md` files by hand. They are updated by
a release pull request generated from commit messages (see
[decision record 0003](docs/decisions/0003-three-version-tracks.md)). Your commit
message is your changelog entry, so make it clear.

## Code of conduct

Everyone taking part agrees to the [Code of Conduct](CODE_OF_CONDUCT.md).
