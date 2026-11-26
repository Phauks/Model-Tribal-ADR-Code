# Harvard resources: candidate lists

Lists counted for the [Harvard resources note](../analyses/2026-11-26-harvard-native-resources.md) (Nov. 26, 2026). Nothing here has been fetched or filed; a build thread uses these as its to-do lists.

| File | One row per | Built from |
| --- | --- | --- |
| [`caselaw-access-project-claims-and-indian-territory-cases.csv`](caselaw-access-project-claims-and-indian-territory-cases.csv) | Case in the Court of Claims Reports or Claims Court Reporter whose name matches a Native party (629 and 92, approximate), and every case in the Indian Territory Reports (575) | `CasesMetadata.json` for each volume at static.case.law; `case_json` links to the case file |
| [`library-of-congress-items-not-in-our-records.csv`](library-of-congress-items-not-in-our-records.csv) | Item in the Library of Congress collection "Native American Constitutions and Legal Materials" whose item number appears nowhere in `content/` or `research/` (309 of 426) | The collection's JSON API; `kind` is a guess from the title |

Name matching misses cases about Native people not named as parties and keeps a few false matches; the Library of Congress list includes versions we hold from another copy. Every record built from these starts Unverified.
