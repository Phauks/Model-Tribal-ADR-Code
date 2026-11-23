# Reading links

Every case and law the site cites is followed by a short line of other places to read it. They are the government's own text (GovInfo, eCFR, the Office of the Law Revision Counsel, the Library of Congress's scans of the United States Reports, the Supreme Court) and free sites (CourtListener, Justia, Oyez, Cornell's Legal Information Institute, Google Scholar). Westlaw and Lexis follow for readers with a subscription, and Wikipedia comes last as background, never as authority. Trevor asked for these links on Nov. 23, 2026, first for Supreme Court cases and then for laws.

## How it works

- `sites.yaml`: the settings. Each site's name, who can open it, the kinds of citation it serves, its address pattern and how a link to it is checked. Edit this file, not the script, to add a site or change a pattern.
- `scripts/caselaw/reading_links.py` reads every case, statute and regulation source record, works out its citation, builds a link for each site that fits and checks it. With `--apply` it writes the links that pass into a `reading_links` block in the record. It also writes `research/reviews/<date>-reading-links.csv`, one row for every link tried and what the check found.
- The website prints the block after the citation, wherever the source is cited (`site/src/lib/reading-links.ts`). Print editions leave it out.

## How each site is checked

| Site | Serves | Check |
| --- | --- | --- |
| Supreme Court | the slip opinion or report already in the record | the page answers |
| GovInfo | U.S. Code sections, Statutes at Large pages, public laws from 1995 on, C.F.R. sections and parts | GovInfo's link service redirects to the document |
| Office of the Law Revision Counsel | U.S. Code sections | the page answers |
| eCFR | C.F.R. sections and parts | eCFR's own data service finds the section or part |
| Library of Congress | scans of the United States Reports | the Library's data service has the item |
| CourtListener | cases matched in its bulk data | taken from the record's `courtlistener` block, which `check_case_citations.py` matched by citation, name and year |
| Justia | Supreme Court cases | not checked: Justia turns away automated requests, so the link follows Justia's own address pattern and the record marks it unchecked |
| Oyez | Supreme Court cases, with argument audio | Oyez's data service lists the case under its term, by citation or docket number |
| Cornell LII | Supreme Court cases, U.S. Code sections, C.F.R. sections and parts | the page answers; for recent Supreme Court cases the docket number is tried after the citation |
| Google Scholar | cases | not checked: a search for the citation, which Google does not let automated requests run |
| Westlaw, Lexis | cases, U.S. Code sections, C.F.R. sections, Statutes at Large pages, state statutes cited by section | the citation link redirects; a reader without an account is sent to sign in |
| Wikipedia | cases and acts | kept only when the article gives the same citation (for a Supreme Court case, the volume and page in its infobox), so a namesake is never linked |

State statutes already link to the legislature's own site in the citation; the script adds Westlaw and Lexis when the title gives the section in a standard form. Tribal codes already link to the nation's own copy and to this site's copy where it keeps one, so the script adds nothing for them.

## Running it again

Run it when case or law records are added, or every few months to catch moved pages:

```
python3 scripts/caselaw/reading_links.py --apply
```

A full run takes about twenty minutes, one request at a time with a pause per site. A link that fails its check is left out of the record until a later run finds it again.
