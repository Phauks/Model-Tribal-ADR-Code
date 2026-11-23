# 0006. Keep secrets only in Cloudflare

- **Status:** Accepted
- **Date:** 2026-11-20

## Context

The repository may be public, and its history permanent. A secret committed or stored in GitHub is hard to remove completely.

## Decision

- No secret is stored in GitHub.
- Deployment uses Cloudflare Workers Builds, which deploys from the GitHub repository using an API token Cloudflare generates for the build ([build configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)).
- Build variables live in Cloudflare's build settings, where they are "accessible only to your build" (same source); runtime secrets are Worker secrets in Cloudflare.
- GitHub Actions use only GitHub's automatic per-run token.
- Local secret files (`.env`, `.dev.vars`) are listed in `.gitignore`.

## Consequences

Turn on GitHub secret scanning and push protection as a safety net. Until a domain is chosen, the site deploys to a `workers.dev` address.
