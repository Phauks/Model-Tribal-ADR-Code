# Security

## Reporting a problem

Please report security problems privately through GitHub's [private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) on this repository (Security tab, "Report a vulnerability"). Do not open a public issue for a security problem.

This also applies to privacy problems, such as a page that exposes a reviewer's personal information or a record marked as restricted.

## Secrets

This repository stores no secrets. Deployment credentials and runtime secrets live only in Cloudflare (see [decision record 0006](docs/decisions/0006-secrets-only-in-cloudflare.md)). If you find a secret committed to the repository, report it as above.
