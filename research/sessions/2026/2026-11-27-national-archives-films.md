---
id: 2026-11-27-national-archives-films
date: '2026-11-27'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session wrote scripts/law/national_archives_films.py and ran it, sorted every item by hand and read 30 frames of each digitized film it kept; no record was written by hand.
- kind: page-fetch
  name: catalog.archives.gov
  detail: The National Archives Catalog's search service (the one its website calls, which needs no key) for every item in Record Group 75 described as moving images or sound recordings, and the catalog's media host for the five digitized films kept.
purpose: 'Trevor picked spike 5 of the audio, video and other sources study for content ("go and get the info", Nov. 27, 2026; spike note research/analyses/2026-11-27-appeals-audio-land-spectrum-films.md, section 4). This session catalogs the Bureau of Indian Affairs films and sound recordings at the National Archives that explain or carry out federal Indian policy, with a SHA-256 for every stored file, and leaves out ceremony films and recordings that may hold children''s voices (CARE principles).'
queries:
- https://catalog.archives.gov/proxy/records/search?recordGroupNumber=75&typeOfMaterials=Moving%20Images (44 descriptions, of which 42 items of series NAID 12678), Nov. 27, 2026
- https://catalog.archives.gov/proxy/records/search?recordGroupNumber=75&typeOfMaterials=Sound%20Recordings (21 descriptions, of which 14 items of series NAID 101898), Nov. 27, 2026
- https://catalog.archives.gov/proxy/records/search?naId=5962194 and naId=1105460 (the two Navajo student recording series, read at series level only), Nov. 27, 2026
sources_added: []
limits: 'Every record is Unverified. Only the catalog''s descriptions were read, and for the five digitized films 30 frames spread across each; no film or recording was watched or heard in full. The sorting into policy, ceremony, children''s and other items is the project''s judgment from those descriptions and frames. Five item numbers in the film series (75.19, 75.33, 75.34, 75.42, 75.46) have no description in the catalog, so the films the Guide to Federal Records names on Hopi and Navajo relocation and the life of the Papago Indians could not be found item by item.'
---

# Indian Affairs films and recordings at the National Archives: session notes

## Access

The spike note expected item-level reading to need a National Archives Catalog API key. It does not: the catalog website's own search service answers scripts with full JSON descriptions and no key, and the catalog's media host (`https://catalog.archives.gov/medialz/...`) serves the digitized films in full, with HTTP 200, from the cloud. The older address for the same files (`https://s3.amazonaws.com/NARAprodstorage/lz/...`) still answers 403 from the cloud, as the Supreme Court argument audio thread found; only its host name differs. No key, relay or other route was needed.

## What the catalog holds

Record Group 75 has 42 described film items in *Moving Images Documenting the Life and Culture of North American Indians* (NAID 12678; 46 film reels and 6 video cassettes, items 75.1 to 75.47) and 14 sound items in *Audio Recordings Documenting Programs Relating to Native Americans* (NAID 101898; items 75-GENERALa-1 to -14, 1964-1980). Sixteen films are digitized, all as Windows Media Video files of about 15 to 323 MB; no sound item is digitized.

## How each item was sorted

Each item was sorted by hand into one of four groups, written into the script's `SCREEN` table with a reason in a few words:

| Group | Films | Sound | What happens |
| --- | --- | --- | --- |
| Policy: made by or for the Bureau, explaining or carrying out a law, a program or the agency's organization | 21 | 10 | A record linking the catalog description; a digitized film is stored |
| Ceremony: ceremonies, dances and customs, including the Rodman Wanamaker expedition films of 1908-1920 and a 1966 film by a Navajo filmmaker on spiritual themes | 12 | 0 | No record and no copy until the nation filmed consents |
| Children: films and recordings whose subject is children or students, who may be heard | 6 | 4 | No record and no copy (the children's matters rule) |
| Other: not described, a Canadian university film, a private art film under copyright | 3 | 0 | No record |

The two Navajo student recording series (NAID 5962194, the Navajo Student Program Recordings of 1950-1954 in San Francisco, about 500 disks; and NAID 1105460, Recordings of Navajo Students, 1948-1961, in Fort Worth) are children's voices and were read only at series level. They get no records.

## Stored films

Five digitized policy films were downloaded unchanged, hashed and stored under `national-archives-films/` in the bucket, 932,603,471 bytes in all; each was checked in the bucket by size and SHA-256 after upload.

| Item | Title | Bytes | SHA-256 | Served |
| --- | --- | --- | --- | --- |
| 75.25 | Modern Indian Medicine Men (U.S. Indian Service, 1947) | 152,979,853 | eaf8cbc981f6117fa32e631afee3a58f6411d5c0e3ad7325aa2308f02fff25cd | No: it opens with dancers and a figure at a fire, which may be a ceremony; held for the nation's review |
| 75.26 | A New Frontier (Indian Service) | 148,891,679 | 73d166f16b4c2279f232ea4f44fa8258e308ea8db3631a3be13a2114da1a225c | Yes |
| 75.27 | An Approach to Indian Offender Rehabilitation (Bureau of Indian Affairs) | 154,739,931 | ab8827c96c84aaac7cc1025b416a9b0dc1ba97579ef71f51cf27d00bf43613ae | Yes |
| 75.43 | "North Star III" Resupply of Alaskan Villages | 322,587,011 | 42c4530beffaf8d7bbc2f4cd1cf4ee598b61cee7ea04278d75e8d64f144a7789 | No: the film does not name its maker |
| 75.44 | Cargo Operations - Beach, "North Star III" | 153,404,997 | bebcd7d9f52260fa6e5b9167dc46b9add8372186de28a7fae8830f3a43d32ddc | No: the film does not name its maker |

A copy is served only when the screen names a federal agency as maker, so it is a work of the United States government (17 U.S.C. § 105). Every record links the National Archives' own description first.

## Not found

The *Guide to Federal Records* names films on the Alaska Native Claims Settlement Act, Hopi and Navajo relocation, Indian claims and the life of the Papago Indians. Only the first has an item description (75.28, not digitized). Item numbers 75.19, 75.33, 75.34, 75.42 and 75.46 have no description, and the others may be among them; *A New Frontier* (75.26), on the Colorado River Indian Reservation, may concern the Bureau's resettlement of Hopi and Navajo families there, but its frames alone do not show that, so the record does not say it.

## Next

A person watches each stored film and listens for children's voices before the record is marked Verified. The Archives' Motion Pictures branch (mopix@nara.gov) can be asked what items 75.19, 75.33, 75.34, 75.42 and 75.46 are, and for copies of the policy films that are not digitized. The Wanamaker and other ceremony films wait for the filmed nations' consent through the Indigenous advisory council.
