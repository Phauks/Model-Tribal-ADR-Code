# Brief: check outreach citations seen only as search results

Input: `outreach/items.json`, the citations in `research/outreach/*.yaml` marked `verification: search-result-only`, each with its record, organization, title, link and `supports` (what the citation is meant to support). Read the record for context.

For each item, open the link and decide whether the page itself supports the `supports` statement.

Output: `outreach/verdicts.json`, one object per item: `record`, `source_id`, `link`, `verdict` (`supports`, `partly-supports`, `does-not-support`, `page-unavailable`), `evidence` (a short quotation, at most 40 words, or null), `better_link` (a working official page that supports it, if found while checking, else null), `reason` (one sentence). Record only organizational facts: no personal names, personal email addresses or telephone numbers. Do not guess.
