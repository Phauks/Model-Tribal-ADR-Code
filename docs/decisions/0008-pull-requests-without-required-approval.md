# 0008. Require pull requests and checks, not a second approval

- **Status:** Accepted
- **Date:** 2026-11-20

## Context

All changes go through pull requests. The lead author is also the only
technical reviewer, and GitHub states that "pull request authors cannot approve
their own pull requests"
([GitHub docs](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/approving-a-pull-request-with-required-reviews)).

## Decision

Protect `main` with a ruleset that requires a pull request and passing status
checks, with zero required approvals, and blocks force pushes and deletion.
Pull requests are squash-merged, and head branches are deleted automatically
after merge (turned on 2026-11-20). When content co-authors join, `CODEOWNERS`
requests their review on content paths.

## Consequences

The lead author's review is reading the diff and the preview build before
merging. Requiring approvals can be revisited when there is a second reviewer.
