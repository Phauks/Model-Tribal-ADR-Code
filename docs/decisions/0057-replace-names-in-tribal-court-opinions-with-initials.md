# 0057. Replace names in Tribal court opinions with initials

- **Status:** Accepted
- **Date:** 2026-11-24
- **Extends:** decision record [0047](0047-show-tribal-court-opinions-from-the-caselaw-access-project.md) ("Show Tribal court opinions from the Caselaw Access Project")

## Context

Of the 2,368 Tribal court opinions the site hosts, 477 involve children, protection orders, guardianships or similar matters, and many name a child or the child's family. They were held back on Nov. 24, 2026 until they could be redacted. The research note of the same day (`research/analyses/2026-11-24-redaction-practices-for-opinions.md`) found that courts and publishers replace such names with initials, mark every change, and put a notice at the top of the page, and Trevor Goldsmith chose who gets initials.

## Decision

- **Who gets initials.** Children; protected persons; child victims and victims of sexual offenses; wards and other vulnerable adults; parents in custody, paternity and support cases; and any relative, guardian or household member whose name would identify one of them, including a respondent or defendant. Judges, lawyers, guardians ad litem, caseworkers, officials and parties to unrelated cited cases keep their names.
- **Format.** Real initials in brackets in the text ("[J.D.]"), as the Indigo Book allows for substitutions in quoted material (R8.2.3). Captions and citations use initials without brackets. Initials the court already used stay as they are, without brackets. Where two people share initials, a short role word is used ("[Mother]", "[Mother 2]"); a surname shared by several protected people becomes its initial ("[T.]"). Protected people's addresses and birth dates are removed ("[address removed]").
- **Names map.** The names to replace live in a private names map (R2 key `private/redaction/tribal-court-opinions-names-map.json` and the project's private files), never in git. Each original page is kept under `private/redaction/originals/`, which the site never serves. `scripts/caselaw/redact_opinions.py` merges the name finders' lists with hand fixes, checks each page, and files the redacted page under the original key.
- **Check before showing.** A page is shown again only after `redact_opinions.py check` finds no listed name, or any generated form of it ("First Last", "First L.", "Mr. Last", upper case), left in its visible text. The same check runs again on the exact bytes that are filed.
- **Notice.** Each redacted page says "Names and some details are replaced to protect privacy. Our changes are in [brackets]." with a link to ask for a name to be replaced, carries a `noindex` robots tag, and has no link to the original at static.case.law. The copy's page shows the same notice line, and the nation's opinions list shows a "Names replaced" badge. `research/tribal-court-opinions/redacted.csv` lists which copies were redacted, without names.
- **Requests.** A new request kind, "Replace a name with initials", lets a person named in an opinion, or their family, ask for a name to be replaced without a court order. It is stored as a restriction request.
- **Nations.** A nation's own restriction on its opinions (decision record 0056) still applies on top of the redaction, and the stricter rule wins.

## Consequences

- A new opinion that involves a child must be redacted before it is shown: add its names to the private map, run the check, then file it.
- Over-redaction is possible: a common surname shared with a protected person may also be replaced in a cited case name. A reader sees it in brackets and can report it.
- Opinions where the finders found nothing to replace (most use the court's own initials already) are shown again unchanged and listed in `redacted.csv` as "nothing to replace".

## Sources

- *The Indigo Book* R8.2.3 (2.1 ed.), https://law.resource.org/pub/us/code/blue/indigobook-2.1.html.
- Cal. R. Ct. 8.90(b) and 8.401(a); Tex. R. App. P. 9.8; Fed. R. Civ. P. 5.2(a)(3); 18 U.S.C. § 2265(d)(3); as read in the research note above.
- CourtListener, Content Removal Policy (notice at the top of a redacted opinion), as read in the research note above.
