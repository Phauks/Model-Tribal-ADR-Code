---
title: "Source Watch"
part: about
status: draft
updated: 2026-11-26
description: "How the Tribal Law Project's source watch finds new and changed public legal documents, and how to ask it to stop."
---

# Source Watch

The Tribal Law Project's source watch looks for new and changed public legal material that belongs in this library: Federal Register documents from the agencies that work with Native nations, changes to the Code of Federal Regulations, and changes to the documents this site already cites. A person reviews everything it finds before anything is added to the site.

## How It Behaves

It names itself in every request as `TribalLawProjectWatch/1.0`, with a link to this page. It reads each site's robots.txt once a day and follows it, including a `Crawl-delay`, and it treats a robots.txt that cannot be read as asking it to stay away. It waits at least 5 seconds between requests to a government site and at least 30 seconds between requests to any other site, and it stops for a while when a site answers that it is busy. It asks whether a page has changed before downloading it again.

It does not send the text of a page from a site whose robots.txt or Content Signals say no to AI use to any artificial intelligence (AI) model.

## Asking It to Stop

To keep the source watch off your site, add `User-agent: TribalLawProjectWatch` and `Disallow: /` to your robots.txt; it follows that within a day. A Native nation that wants its documents handled differently can also choose how this site shows them on its nation page.
