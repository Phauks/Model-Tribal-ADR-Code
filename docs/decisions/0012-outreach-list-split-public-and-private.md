# 0012. Keep outreach organizations public and the outreach plan private

- **Status:** Accepted
- **Date:** 2026-11-21

## Context

The project will ask organizations, scholars, judges and Native nations for
help: co-authoring, review, consultation and art. The lead author plans to
reach out only after a large amount of research has been gathered and
processed. The list of whom to approach first appeared as a table in the
planning analysis and needed to become structured, cited data.

This repository is public, and its git history keeps everything ever
committed. A public list naming individual people, what the project means to
ask of each, how each is ranked and what each has replied would announce an
ask before it is made and would publish other people's correspondence (project
analysis). The Tribe profile rules already keep officials' names and direct
contacts out of git and allow only official public office contacts.

## Decision

- **Public, in this repository:** one record per organization, office or
  Native nation in `research/outreach/<id>.yaml`, validated by
  [`schemas/outreach-organization.schema.json`](../../schemas/outreach-organization.schema.json).
  A record holds who the organization is, why it matters to the project, the
  kinds of help it could give, and its public, institutional contact paths,
  each with a cited source. A Native nation's record points to its Tribe
  profile for office contacts instead of repeating them.
- **Private, outside git:** named people, suggested asks, priority and the
  contact log, in a plan file validated by
  [`schemas/outreach-plan.schema.json`](../../schemas/outreach-plan.schema.json)
  and kept in the project's private file storage. When the website's private
  maintainer area exists, the plan can move to Cloudflare D1 beside the
  request records ([decision record 0009](0009-private-requests-from-nations.md)).
- Outreach records cite their web pages inline, not through
  `content/sources/`, because they are planning data and not part of the
  reader-facing bibliography.
- Outreach records are not published on the website.

## Consequences

- The public records double as a transparent account of which bodies the
  project intends to consult, consistent with the charter's consultation
  commitment.
- The private plan has no git history; it is backed up with the project's
  files. If history becomes important, a separate private repository is the
  fallback.
- `scripts/validate_records.py` checks the public records; the plan is
  checked against its schema when it is edited.
