# Tribal court opinions

An index of the tribal court opinions in the Caselaw Access Project's free files. Trevor chose on Nov. 23, 2026, to load them as research data. Trevor then chose to show each opinion on the website as its own page, with a link the nation can use to ask for its removal ([decision record 0047](../../docs/decisions/0047-show-tribal-court-opinions-from-the-caselaw-access-project.md); [sources note](../analyses/2026-11-23-free-legal-information-sources.md), section 4).

## What is here

- `sources.yaml`: the settings. The reporters to read, which Native nation each court belongs to, and the topic patterns. Edit this file, not the script, to add a reporter, a court or a topic.
- `opinions.csv`: one row per tribal court opinion with its citation, court, date, nations, docket number, length and topic tags. It also has the key of the opinion's page in the bucket (`copy_key`), the key of its volume's private copy (`volume_key`) and a link to the case on static.case.law. Federal and state decisions that the reporters reprint are left out.
- `cites-to-records.csv`: each time one of these opinions cites a case that has a source record in `content/sources/`. It is the data for "cited by tribal courts" lists.
- `counts.json`: totals by nation, court and topic, the cases cited most, and any court with no nation yet.

The opinions' text is not in the repository. Each volume's zip file is filed as a private capture in the project's bucket under `caselaw-access-project/` (redistribution "no"). Each opinion of a court serving a Native nation is also filed there as a page of its own, `caselaw-access-project/<reporter>/<volume>/<case>.html`. The page is the project's HTML for the case, with the case name, citation, court, date, credit and an "Ask to remove it" link added. Those pages are marked redistribution "yes", so the website serves them at `/copies/caselaw-access-project/…`, lists them on each nation's page and at `/nations/<nation>/opinions`. A nation's removal request is carried out in `research/capture-index-overrides.json`, which takes the page off every list too. Short passages around each topic word are in the project files at `research/tribal-court-opinions/snippets.json`.

## Coverage and limits

The first run (Nov. 23, 2026) found 2,368 opinions from courts serving 24 Native nations, decided from June 27, 1969, to Jan. 20, 2017. The Navajo Nation has 949 and the Fort Peck Tribes 353. The data comes from two reporters, West's American Tribal Law Reporter (13 volumes, 1997 to 2017) and the Navajo Reporter (8 volumes, 1969 to 2006). Nothing after early 2017 is here. For later opinions, see the National Indian Law Library's Tribal Court Bulletin and the courts' own sites.

The Caselaw Access Project files 17 opinions of the Grand Ronde Court of Appeals under the Navajo Nation. The settings match courts by name, so they are counted for Grand Ronde.

Topic tags mean the words appear in an opinion, not that the opinion is about the topic. Read the opinion before relying on a tag.

## Running it again

Run it when the Caselaw Access Project updates a volume, when a reporter is added to `sources.yaml`, or after new case source records are added (to refresh `cites-to-records.csv`):

```
python3 scripts/caselaw/tribal_court_opinions.py --cache ~/caselaw-cache \
    --private /mnt/project-files/research/tribal-court-opinions \
    --file-captures --captures /mnt/project-files/research/captures
```

A volume or opinion page already filed with the same SHA-256 is not filed again. A changed volume is filed beside the old one with the date in its name; a changed opinion page replaces the old one under the same key. Without `--file-captures`, the script keeps the page keys already in the capture index.

## Sources

The files are from the Harvard Library Innovation Lab's Caselaw Access Project, https://static.case.law/, released "without restriction on access or use" in March 2024 (Harvard Library Innovation Lab, *Transitions for the Caselaw Access Project* (Mar. 26, 2024), https://lil.law.harvard.edu/blog/2024/03/26/transitions-for-the-caselaw-access-project). Every volume is marked redacted, which removes the publisher's headnotes and summaries.
