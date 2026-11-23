# Brief: second search for dispute resolution sources (web)

You are helping a research project on a model tribal alternative dispute resolution code. For each Native nation in your input file, the project's first search (Nov. 22, 2026) found no dispute resolution provision and could not finish, because some places were blocked or dead (listed in `already_tried`). Your job: look for OTHER official public places that could show whether the nation has dispute resolution (mediation, arbitration, peacemaking, talking or healing circles, elders' panels or councils that settle disputes, family or community conferencing, a dispute resolution clause in its constitution, codes or court rules, a court's mediation or peacemaker program).

Rules:
- Use WebSearch (mode "standard"), at most 3 searches per nation and at most 95 in total. Good queries: "<official name> tribal code", "<name> peacemaking OR mediation OR \"dispute resolution\"", "<name> tribal court". For small Alaska villages one search is usually enough.
- Read promising pages with WebFetch if you have it. Read only official pages: the nation's own site, its code host (e.g. tribal.codes, codepublishing, municode, ecode360), its court site, NARF's National Indian Law Library, state court tribal court lists, the Tribal Court Clearinghouse (tribal-institute.org), an intertribal organization's page for the nation, or a federal page. News items count only as leads.
- Do not try to get past bot protection. If a site refuses (403, challenge page) record outcome `blocked`; do not retry it another way. Do not re-try addresses in `already_tried`.
- Never guess. A page that only says a court exists is not a dispute resolution finding: say "court only". A finding needs wording about mediation, arbitration, peacemaking, circles, elders resolving disputes, or "dispute resolution"/"alternative dispute resolution" (election disputes and plain judicial power do not count).
- Quotes: at most 30 words, copied word for word from the page you read, with the exact URL.

Output: write ONE JSON file (path given in your task), a list with one object per nation, in input order:
{
 "id": "<profile id>",
 "searches": [   // every search and page read, in order
   {"method": "script", "place_kind": "web-search" | "nation-website" | "nation-code-site" | "tribal-court-site" | "national-indian-law-library" | "state-court-directory" | "intertribal-organization" | "other",
    "address": "WebSearch: <query>" or "<url>", "query": "<what you looked for>",
    "outcome": "found" | "not-found" | "no-site" | "blocked" | "dead-link" | "not-public" | "error",
    "reason": "<one plain sentence: what the search or page showed>"}
 ],
 "findings": [ {"url": "...", "kind": "mediation|arbitration|peacemaking|circle|elders|adr-general|other", "quote": "<=30 words verbatim", "where": "section or heading", "confidence": "high|medium|low", "note": "..."} ],
 "court_only": ["<url of a court page with no dispute resolution wording>"],
 "new_places_not_read": ["<url you saw but could not read, and why>"]
}
"found" in a search means that place showed dispute resolution wording. Write the file as you go (rewrite it after every few nations) so nothing is lost. Final message: counts (nations with findings, searches used, blocked sites) in under 150 words. Do not edit the repository.
