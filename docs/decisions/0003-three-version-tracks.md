# 0003. Version content, website and print separately from 0.0.1

- **Status:** Accepted
- **Date:** 2026-11-20

## Context

A website fix does not change the model code, and a print edition may bundle many content releases. One version number would blur those changes.

## Decision

- `content/`, `site/` and `pdf/` each have a Semantic Version starting at 0.0.1, a `version.txt` and a `CHANGELOG.md`. Under Semantic Versioning, a 0.y.z version marks initial development ([semver.org](https://semver.org/)).
- Content: MAJOR for a renumbered or removed section or a changed provision meaning, MINOR for new sections, essays or profiles, PATCH for corrections.
- Print: 1.0.0 is the 1st Edition; each PDF records the content version it was built from.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/). [release-please](https://github.com/googleapis/release-please) in manifest mode turns them into one release pull request that bumps each changed track and writes its changelog; tags take the form `<track>-v<version>`.
- The website renders the three changelogs on a Changelog page.

## Consequences

- Nobody edits `version.txt` or `CHANGELOG.md` by hand.
- The release-please workflow uses only GitHub's automatic per-run token. Pull requests it opens do not trigger other workflows ([release-please-action](https://github.com/googleapis/release-please-action)), which is acceptable because they only change version and changelog files.
- The repository setting "Allow GitHub Actions to create and approve pull requests" may need to be turned on (same source).
