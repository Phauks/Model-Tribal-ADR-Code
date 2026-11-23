# Nations' seals, emblems, flags and logos

Tribe profiles record each nation's seal, emblem, flag or logo as the nation itself publishes it on its own website (`official_images` in [tribe.schema.json](../schemas/tribe.schema.json)). This page explains how the images were found, how the project tells whether it may **not** reuse one, the rule that decides whether an image is shown, and the legal and ethical background. The legal notes are the project's analysis, not legal advice.

The starting point, set by Trevor Goldsmith on 2026-11-21, is that **an image may be reused unless a signal says otherwise**. Every signal found is recorded with the image, including those that do not restrict it, so anyone can see why an image is or is not shown.

## Where the images come from

- The nation's own website comes first, as listed in the profile's contacts. The finder script, [scripts/tribes/find_official_images.py](../scripts/tribes/find_official_images.py), reads the home page, pages whose links mention a seal, flag, emblem, logo or insignia, and the site's terms of use, copyright or legal pages. It saves candidate images and every sentence about reuse to a private folder and never writes to a profile. Sites that refuse the plain reader are opened in a headless browser.
- When the nation's website has no usable image, or the nation has no website, another reliable copy may be used (Trevor Goldsmith, 2026-11-22): a file on Wikimedia Commons or English Wikipedia, or the nation's page on an intertribal organization's website, but only when the image is clearly labelled as that nation's seal or logo. The record then says who made or published the copy and under what license (`credit`), and the website shows that in the image's Sources entry instead of "As the nation's website publishes it."
- A person (or the AI assistant, whose choices are reviewed in the pull request) picks at most one image per nation by eye. Marks that belong to someone else are rejected: intertribal consortia's own logos, Alaska Native corporations, boroughs, state agencies, casinos, website vendors and social media icons.
- The project **never** draws, generates, edits or substitutes an image, and never uses stock or pan-Indian imagery (a standing project rule). When no image is found, the profile has none.
- The image file is kept privately (see [Storage](#storage)). The profile holds only the link, the date, the media type, a SHA-256 fingerprint and the path of the private copy.

The first collection (research session `2026-11-21-official-images`) chose images for 360 of the 545 nations with a listed website. A later run on the Minnesota Chippewa Tribe's six component bands added five more.

The second collection (research session `2026-11-22-official-images-second-pass`) looked again for the 589 nations that still had no image, reading their websites by script and in a browser, Wikipedia infoboxes, Wikimedia Commons categories and the web. It chose images for 24 nations (15 from the nation's own website, 4 from an intertribal organization's page and 5 from Wikimedia Commons or Wikipedia); 17 may be shown and 7 are restricted because the nation filed the same or a similar design in the USPTO database. Each nation's searches are logged under [research/search-logs/official-images/](../research/search-logs/official-images/). Flags were found on Wikimedia Commons for some nations that have no seal or logo; they were left out until Trevor decides whether a flag drawn by a volunteer should stand in for a nation's own image.

## How "can't reuse" is detected

Each signal has a **kind** (where it came from) and an **effect** (what it does to reuse). The finder flags candidate sentences with simple patterns; a person reads each one and sets the effect. Most flagged sentences turn out to be about privacy or cookies and are not recorded.

| Signal kind | How it is detected | Usual effect |
| --- | --- | --- |
| `terms-of-use` | The site's terms, copyright or legal page says content, images or logos may not be copied, displayed or redistributed without permission. | `blocks-reuse` (or `allows-with-conditions` when only some uses are barred, such as commercial use) |
| `copyright-notice` | A general line such as "© 2025 Example Nation. All rights reserved." | `does-not-block`: it says who owns the site, not that the logo may not be shown |
| `trademark-notice` | The site says its logo or seal is a trademark or service mark, is "protected", or needs a license. | `blocks-reuse` |
| `trademark-symbol` | A ® or ™ is printed on the image itself (checked by eye). | `blocks-reuse` |
| `tribal-insignia-database` | The nation filed the same or a closely similar design in the USPTO Native American Tribal Insignia database (searched with `nonRegistration:"Native American Tribal Insignia"` and compared by eye). A different filed design is recorded in `tribal_insignia_database_entries` but is not a signal. | `blocks-reuse` (a project choice; see [below](#the-uspto-tribal-insignia-database)) |
| `tribal-law` | A law of the nation governs use of its seal, emblem, flag or logo (found by web search and on the nation's code pages). | Depends on the law; `unverified` when the law could not be read |
| `permission-required` | The nation asks to be contacted before its logo or content is used. | `blocks-reuse`, or `allows-with-conditions` when some uses need no request |
| `nation-request` | The nation asks the project directly, through the private request route ([decision 0009](decisions/0009-private-requests-from-nations.md)). | Whatever the nation asks |

The effects:

- **blocks-reuse**: the project may not show the image without permission.
- **allows-with-conditions**: the image may be shown where the conditions in the signal's note are met (for example, not commercially, or without suggesting endorsement).
- **does-not-block**: recorded for transparency only.
- **unverified**: a signal exists but could not be read or confirmed, such as a seal law whose published copy returned an error.

## The display rule

The image's `reuse.status` follows from its signals, and `scripts/validate_records.py` fails if it does not:

1. any `blocks-reuse` signal: **restricted**
2. otherwise any `unverified` signal: **needs-checking**
3. otherwise any `allows-with-conditions` signal: **conditions-apply**
4. otherwise: **no-restriction-found**

Three statuses come only from the nation's own answer and override the rule: **permission-granted**, **permission-denied** and **withdrawn-at-request**. The trail of a request is kept in `reuse.permission` ([permission.schema.json](../schemas/permission.schema.json)), naming offices, not people.

| Status | Shown? |
| --- | --- |
| no-restriction-found | Yes, with attribution to the nation, a link to the page it came from, and a "request removal" link |
| conditions-apply | Only where the conditions are met; checked again for each new use, such as the printed book |
| needs-checking | No, until someone reads the signal and updates it |
| restricted | No; the nation's name and a link to its page are shown instead |
| permission-granted | Yes, within the scope granted (`permission.scope`: web, print, ebook) |
| permission-denied | No |
| withdrawn-at-request | No, and the private copy is deleted (the validator refuses a withdrawn image that still names one) |

The printed book is sold, so a signal that bars only commercial use still blocks the image in print. Black-and-white printing is an alteration under at least one nation's law (Mississippi Band of Choctaw Indians, § 36-3-5(3)), so print needs its own check even for images shown on the website.

## When a nation asks

A nation can ask to correct, restrict or remove its image at any time (charter, commitment 6). The request is recorded as a `nation-request` signal, the status is set to what the nation asked, and a withdrawn image's private copy is deleted. Restricted material is never published, exported, cached offline or served by any API (charter, commitment 5). Permission requests can go out through the outreach plan in the project files (`outreach/`).

## Storage

Copies live outside this repository, in the project's private research captures under `nation-images/<nation id>/`, with a `manifest.json` that lists each file's source link, retrieval date and SHA-256. Images are never committed to git, because a public history cannot be fully rewritten if a nation later asks for removal.

The website serves images from the private source documents bucket (R2), under the same paths ([decision record 0017](decisions/0017-serve-nation-images-from-the-private-bucket.md)):

- The build lists the images whose status allows showing them (`site/src/lib/official-images.ts`). Only those are served, at `/nations/<nation id>/image`; any other image is never served, whatever the bucket holds.
- The bucket copy is filled the first time an image is asked for: the Worker fetches it from the nation's own website and keeps it only if its SHA-256 matches the reviewed copy. If the nation has changed or removed the image, nothing is shown until it is reviewed again, and the page hides the figure.
- Images from the second collection are put in the bucket when they are reviewed ([scripts/tribes/capture_official_images.py](../scripts/tribes/capture_official_images.py)), so they show even when the nation's website refuses the Worker or the copy came from somewhere else.
- Responses are cached for an hour at most and never saved for offline use.
- To withdraw an image, set its status, rebuild the site, and delete the object `nation-images/<nation id>/...` from the bucket (and the private research copy, for `withdrawn-at-request`).

## Legal and ethical background

### Copyright

A seal or logo is a pictorial or graphic work, which copyright protects.[^copyright-subject] The exclusion for works of the United States Government does not reach tribal governments, which are separate sovereigns (project analysis).[^government-works] The government edicts doctrine covers works that lawmakers and judges create in their official duties, such as statutes and opinions,[^edicts] so a nation's seal *law* can be quoted, but the seal image itself is not an edict (project analysis).

Fair use is uncertain here. Courts have found small thumbnails in a search engine transformative,[^thumbnails] but when a use shares the original's purpose, transformation counts for less.[^warhol] Showing a nation's seal to identify the nation is close to the purpose the seal already serves, so the project does not rely on fair use to show an image a nation has restricted (project analysis).

### Trademark

Trademark infringement needs a use in commerce that is likely to cause confusion about source or endorsement.[^infringement] Referring to a nation by name is ordinarily allowed, but nominative fair use covers only as much of a mark as is reasonably necessary, which favors the name over a distinctive design.[^nominative] Attribution and a plain statement that the nation does not endorse the project reduce the risk of implied endorsement (project analysis).

### The USPTO tribal insignia database

The Trademark Act bars registering a mark that may "falsely suggest a connection with persons, living or dead, institutions, beliefs, or national symbols."[^false-connection] The USPTO keeps the insignia database so that examiners can "determine whether trademarks falsely suggest a connection to the tribal insignias of participating Native American tribes."[^uspto-insignia] It affects registration, not use: entry "does not grant any rights to the tribe that submitted the tribal insignia" and "is not the legal equivalent of registering the tribal insignia as a trademark," and the Office does "not investigate whether the tribal insignia is the official tribal insignia of the tribe that made the submission."[^uspto-insignia][^uspto-faq]

So a database entry is not a legal bar on this project's use. The project still treats a matching entry as `blocks-reuse`, because filing is a formal step the nation took to protect the design, and the CARE principle of authority to control asks the project to respect that.[^care] This is the largest single reason images are restricted (57 of 88 in the first collection). Changing it would mean setting those signals to `allows-with-conditions` with a note; the display rule would follow.

### Website terms

Terms posted on a website bind a visitor only with actual or reasonable notice of them.[^browsewrap] The project follows a nation's stated terms whether or not they would bind it, because they state the nation's wishes (project analysis).

### Nations' laws

Several nations regulate their seals by law. Examples found in the first collection:

- Jamestown S'Klallam Tribe: unauthorized use of the Tribal Crest "is strictly prohibited"; educational use needs a written agreement.[^jamestown]
- Little River Band of Ottawa Indians: no reproductions of the seal "in any manner not specifically authorized by resolution of the Tribal Council," with a civil fine of up to $5,000.[^little-river]
- Coquille Indian Tribe: anyone wishing to use the seal must ask the Tribal Council Chairperson in writing.[^coquille]
- Mississippi Band of Choctaw Indians: noncommercial use that implies no endorsement is authorized, but copies must come from the Office of Public Information, the emblems may not be altered, and other uses need a license.[^choctaw]
- Little Traverse Bay Bands of Odawa Indians: the Tribal Emblem "may be used by any Tribal Citizen, person, or entity, provided that its use does not mislead or convey any impression of official action or endorsement," while the Tribal Seal is for official business.[^odawa]

How far a nation's law reaches a publisher outside its territory is a question of tribal jurisdiction,[^montana] but the project follows these laws as the nations' own rules (project analysis).

### Ethics

The United Nations Declaration on the Rights of Indigenous Peoples recognizes that "Indigenous peoples have the right to maintain, control, protect and develop their cultural heritage, traditional knowledge and traditional cultural expressions."[^undrip] The project's charter adopts the CARE principles, under which "Indigenous Peoples' rights and interests in Indigenous data must be recognised."[^care] Some images carry sacred or ceremonial imagery; a nation can ask for any image to be restricted for that reason alone.

## Ways to show the images

Trevor Goldsmith chose the first option on 2026-11-21.

| Option | For | Against |
| --- | --- | --- |
| Serve from the private R2 bucket through a Worker route that serves only images the rule allows (chosen) | No copies in git; removal is one delete; the rule is enforced when the image is served | Needs a small route; the first view of each image depends on the nation's website being reachable |
| Link to the image on the nation's own website | No copy at all; the nation keeps control | Breaks when the site changes; embedding may still count as display;[^embedding] the nation's server sees the project's visitors |
| Commit shown images to the website's static files | Simplest | Images stay in public git history even after removal, against charter commitment 6 |
| Show no images; name and link only | No reuse questions | Loses the visual identification the nations chose |

## Re-running

1. `python3 scripts/tribes/find_official_images.py candidates.json <private folder>` with a list of profiles and websites.
2. Review the candidates and signals by hand into `research/raw/<date>/official-images.json` and `research/raw/<date>/tribal-insignia-database.json`.
3. `python3 scripts/tribes/write_official_images.py` writes the profiles and source records; `python3 scripts/validate_records.py` checks the result.

For nations that still have no image, the second collection's steps are: run the finder with a third argument naming a file of profile ids (`python3 scripts/tribes/find_official_images.py candidates.json <private folder> only.txt`), look on Wikimedia Commons and Wikipedia, review the choices into `research/raw/2026-11-22/official-images-second-pass.json`, then run `python3 scripts/tribes/add_official_images.py` (writes the profiles and source records; it never replaces an image) and `python3 scripts/tribes/capture_official_images.py --captures <captures folder> --files <reviewed downloads>` (files the private copies and uploads them to the bucket).

[^copyright-subject]: 17 U.S.C. § 102(a)(5).
[^government-works]: 17 U.S.C. § 105 ("Copyright protection under this title is not available for any work of the United States Government . . . .").
[^edicts]: Georgia v. Public.Resource.Org, Inc., 590 U.S. 255 (2020).
[^thumbnails]: Kelly v. Arriba Soft Corp., 336 F.3d 811 (9th Cir. 2003); Perfect 10, Inc. v. Amazon.com, Inc., 508 F.3d 1146, 1165 (9th Cir. 2007).
[^warhol]: Andy Warhol Found. for the Visual Arts, Inc. v. Goldsmith, 598 U.S. 508 (2023).
[^infringement]: 15 U.S.C. §§ 1114(1), 1125(a)(1).
[^nominative]: New Kids on the Block v. News Am. Publ'g, Inc., 971 F.2d 302, 308 & n.7 (9th Cir. 1992).
[^false-connection]: 15 U.S.C. § 1052(a). The same paragraph's bars on "disparag[ing]" and "immoral . . . or scandalous" matter were held unconstitutional in Matal v. Tam, 582 U.S. 218 (2017), and Iancu v. Brunetti, 588 U.S. 388 (2019); the false-connection bar was not at issue.
[^uspto-insignia]: U.S. Pat. & Trademark Off., *Native American Tribal Insignia*, https://www.uspto.gov/trademarks/laws/native-american-tribal-insignia (last visited Nov. 21, 2026).
[^uspto-faq]: U.S. Pat. & Trademark Off., *Native American Tribal Insignia: Database FAQs*, https://www.uspto.gov/trademarks/laws/native-american-tribal-insignia/native-american-tribal-insignia-database (last visited Nov. 21, 2026).
[^care]: Global Indigenous Data Alliance, *CARE Principles for Indigenous Data Governance*; see [charter.md](charter.md).
[^browsewrap]: Nguyen v. Barnes & Noble Inc., 763 F.3d 1171 (9th Cir. 2014).
[^jamestown]: Jamestown S'Klallam Tribal Code § 41.01.03(B), (D) (2025), https://jamestowntribe.org/wp-content/uploads/2025/11/Title-41-Tribal-Crest-and-Tribal-Flag-Code-10-30-25.pdf.
[^little-river]: Little River Band of Ottawa Indians, Ordinance No. 96-0107-01, §§ 4–5, https://lrboi-nsn.gov/sites/default/files/pages/96-0107-01-Tribal-Seal_0.pdf.
[^coquille]: Coquille Indian Tribal Code § 196.160(1) (2018), https://www.coquilletribe.org/wp-content/uploads/2018/09/196-Tribal-Seal-9_2018.pdf.
[^choctaw]: Choctaw Tribal Code §§ 36-3-3, 36-3-5, 36-3-6 (Mississippi Band of Choctaw Indians), https://www.choctaw.org/wp-content/uploads/2024/04/Title-36-Tribal-Government.pdf.
[^odawa]: Waganakising Odawak Statutes §§ 6.2104, 6.2106 (WOS 2016-004) (Little Traverse Bay Bands of Odawa Indians), https://ltbbodawa-nsn.gov/wp-content/uploads/2023/04/Vol-6-Title-VI-Chapter_21.pdf.
[^montana]: See Montana v. United States, 450 U.S. 544, 565–66 (1981).
[^undrip]: United Nations Declaration on the Rights of Indigenous Peoples, G.A. Res. 61/295, art. 31(1) (Sept. 13, 2007).
[^embedding]: See Goldman v. Breitbart News Network, LLC, 302 F. Supp. 3d 585 (S.D.N.Y. 2018).
