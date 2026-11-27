---
id: 2026-11-27-appeals-court-argument-audio
date: '2026-11-27'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session wrote and ran scripts/caselaw/appeals_argument_audio.py.
- kind: page-fetch
  name: static.case.law
  detail: The Caselaw Access Project's case files, for each record's docket_number.
- kind: legal-database
  name: GovInfo
  detail: United States Courts Opinions (USCOURTS) search through the api.data.gov key, by court and decision date, for records with no docket number elsewhere.
- kind: page-fetch
  name: United States Court of Appeals for the Ninth Circuit
  detail: The public media search that the court's "Live Streams and Videos" archive page calls, searched by docket number, and the MP3 and WMA files on the court's own server (cdn.ca9.uscourts.gov/datastore/media/).
- kind: page-fetch
  name: United States Court of Appeals for the Tenth Circuit
  detail: All 136 pages of the court's argument recordings list (www.ca10.uscourts.gov/oralargument/search-results) and its MP3 files.
purpose: 'Trevor picked spike 3 of research/analyses/2026-11-27-appeals-audio-land-spectrum-films.md ("go and get the info", Nov. 27, 2026): collect the Ninth and Tenth Circuits'' argument recordings for our lower federal court Indian law records, audio only, joined on docket numbers rather than case names.'
queries:
- The docket number of each Ninth Circuit record decided from 2003 and each Tenth Circuit record decided from 2014
- Each docket number in the Ninth Circuit's media search and the Tenth Circuit's argument list
limits: 'Records with no docket number found (22) were not matched. Recordings argued after the decision were left out, since they belong to a rehearing or a later appeal. Whether a criminal appeal is a United States prosecution of a person is read from the caption (project inference), and no recording has been listened to or transcribed yet.'
---

# Courts of appeals argument audio: session notes

`scripts/caselaw/appeals_argument_audio.py` runs in five steps (`dockets`, `lists`, `match`, `download`, `write`); its opening comment says how. The working files are outside git.

## Docket numbers

The spike note found that our records carried no docket numbers, so the first step adds one to each record as `citation.number`, the field the citation style already prints for a case with no reporter citation ("No. 25-7504"). Of the 1,026 Ninth Circuit records decided from 2003 and Tenth Circuit records decided from 2014, 1,004 now have one. 735 came from the Caselaw Access Project's own `docket_number` and 158 from the record's notes (CourtListener records with no reporter citation). The other 111 came from GovInfo, where exactly one United States Courts Opinions package from the same court was issued on the decision date with a caption sharing a distinctive word with ours. 22 have none. The same steps found docket numbers for 34 of the 40 held opinions from those courts and years, which stay in the private files.

## Recordings

The Tenth Circuit's list held 2,719 recordings (April 2014 to Nov. 19, 2026). The Ninth Circuit's media search was asked for each docket number, and only hearings with that exact number were kept, with the MP3 or WMA address the court's own hearing record gives. A recording argued after the decision was left out.

694 records have at least one recording: 659 shown records with 682 recordings (556 Ninth Circuit records, 103 Tenth Circuit), and 34 held or child cases with 40. A record can have two (a panel argument and an en banc argument, or two appeals decided together), and parallel reports of one decision share a file, so there are 640 files, 9.2 GB and about 393 hours. The Ninth Circuit's files from 2007 to 2014 (212 of them) are Windows Media Audio; they are kept as the court published them, unchanged, so their SHA-256 matches the court's file. One file, No. 17-35722 (argued Nov. 8, 2018), is empty on the court's server and was not kept.

The 30 recordings whose court caption differs from our record's title were read by hand: all are the same case under the court's own caption ("USA v." for "United States v.", the other side of a consolidated case, or a subproceeding such as *United States v. Washington*'s).

## Storage

Each file is in `tribal-law-project-files` under `appeals-court-audio/<court>/<year>/<date argued>-<docket>.<mp3 or wma>`, checked after upload by size, and listed in the record's `argument_audio` with its SHA-256, size and length. The court's own address comes first, as `link`. Nothing is served yet: the site serves only files on its copy list, and the player waits for a mockup Trevor approves (the Supreme Court audio thread is designing one, and `argument_audio` is the same field it uses).

## Privacy

A recording follows its opinion: the 30 recordings of the 26 held opinions have no public record and are listed only in the private file `research/appeals-court-audio/private/held-recordings.csv` in the project files. So are the 10 recordings of 8 shown opinions whose caption names a child or a party only by initials ("Doe", "Juvenile Male", "Jonah R."), since an argument names people the opinion may not.

Criminal appeals under the Major Crimes Act often concern a child victim even when the caption names only the adult defendant (spike note, section 2.3). The 238 recordings of United States prosecutions of a person are therefore marked `held: true` with a note: they are stored and listed, but stay private until a reading of a transcript finds no child or victim named. The next step is machine transcripts of those recordings and the same sensitivity reading the opinions had.
