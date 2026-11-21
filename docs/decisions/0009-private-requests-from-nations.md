# 0009. Take requests from nations privately, not in public issues

- **Status:** Accepted
- **Date:** 2026-11-20

## Context

Charter commitment 6 lets a Native nation correct, restrict, remove or
contribute to material about it. GitHub issues on a public repository are
public, so an issue asking to restrict material would repeat or point to that
material and could identify the person asking (project analysis). The charter
also commits that restricted knowledge is never published (commitment 5).

## Decision

- Requests to correct, restrict or remove material about a nation, and offers
  to contribute, are received through a private form on the website, specified
  in [docs/requests.md](../requests.md).
- Until the website exists, sensitive requests use GitHub's private
  vulnerability reporting or the maintainer's GitHub profile, as
  [SECURITY.md](../../SECURITY.md) already provides for privacy problems.
- Public issue forms are used only for material that is not sensitive, and
  each form points people with a sensitive request to the private route.
- Request records live in Cloudflare D1 and R2, not in git, and are not
  served by any public API.

## Consequences

- Building the request page is part of the website's first release, not a
  later enhancement.
- A project contact address is needed when the domain is set up.
- Public changes resulting from a request are logged without repeating
  withdrawn content (charter, commitment 6).
