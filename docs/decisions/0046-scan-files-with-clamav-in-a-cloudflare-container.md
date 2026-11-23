# 0046. Scan files for malware with ClamAV in a Cloudflare Container, and hold them until clean

- **Status:** Accepted (lead author, Nov. 23, 2026)
- **Date:** 2026-11-23

## Context

The website now takes files from people (decision record 0038) and is gaining a project inbox that keeps email attachments. Both put untrusted files in the private bucket for reviewers to open. On Nov. 23, 2026 the lead author asked for "our malware scanner, will be important for emails and other added files," built from the scanner in his Magna Carta repository.[^ask] Cloudflare's own scanning of uploaded content is part of its Enterprise plan,[^waf] and docs/uploads.md had planned ClamAV in a Cloudflare Container with files held at "Checking" until they pass. The Magna Carta scanner is that design: ClamAV, YARA rules and structural checks in a Container with no internet access, reporting facts that the application turns into a verdict.

## Decision

- **One scanner for the whole site**, in its own Worker (`model-tribal-adr-code-scanner`, `site/scanner/`), deployed by its own Workers Builds project, so the website's frequent deploys never rebuild the engine.
- **Held until clean.** A file is served, opened or filed only when its row in `file_scans` says clean for the exact bytes in the bucket, or a reviewer released a file that could not be checked. A file where something was found can never be released.
- **The database table is the only link.** The site adds a row; the scanner's desk (a Durable Object woken every minute) scans waiting files and writes results. The site needs no binding to the scanner, and without a scanner files wait instead of passing.
- **The engine is adapted from Magna Carta**: the Rust scan service with ClamAV, YARA Forge's extended rules and the PDF, Office and archive checks, on a `standard-1` Container that sleeps after ten idle minutes. The Magika file-type engine, the signature prefilter and per-firm policies are left out. The lead author owns Magna Carta, whose licence is "All rights reserved," and directed the reuse; the adapted code is published here under the repository's code licence (MIT).
- **The provider is a setting.** `SCAN_PROVIDER` is `container`, `http` (any service answering with the same JSON at `SCAN_HTTP_ADDRESS`, with an optional secret key) or `off`. A mistake in the setting holds files. Public multi-scanner services that share submitted files are not to be used.
- **Fresh signatures by rebuilding.** The container cannot reach the internet, so ClamAV's signatures are those of the last build. An optional deploy hook, called daily, rebuilds the scanner. Each result records the engine, rules and signature versions it used.

## Consequences

- No new paid service. Containers are billed by use on the Workers Paid plan the project already has; with the engine asleep between scans, ordinary use should stay within the plan's included hours. Running it all month would cost about $26 in memory.[^pricing]
- A scan starts within about a minute of a file arriving, plus about a minute to wake the engine. Senders and reviewers see "Checking for viruses" meanwhile.
- Files over 2 GiB (only videos can be that large) and password-locked files cannot be scanned; they wait for a reviewer to release them, with a reason.
- The uploads and inbox code call `requestScan` and check `mayServe` before serving; until they do, nothing changes for them.
- The lead author needs to create the scanner's Workers Builds project and apply migration 0021 once (site/SCANNING.md, "Setting it up").

## Sources

[^ask]: Lead author, message in the project chat, Nov. 23, 2026 (project records).
[^waf]: Cloudflare, "WAF: Malicious uploads detection," https://developers.cloudflare.com/waf/detections/malicious-uploads/.
[^pricing]: Cloudflare, "Containers: Pricing," https://developers.cloudflare.com/containers/platform/pricing/.
