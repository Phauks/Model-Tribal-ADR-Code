---
id: 2026-11-27-supreme-court-argument-transcripts
date: '2026-11-27'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session wrote scripts/caselaw/supreme_court_argument_transcripts.py, matched every Supreme Court case record argued since the October 1968 term to the Court's transcript of its argument, stored the transcripts in the project's R2 bucket with their SHA-256 and page count, and wrote each case's argument_transcripts block.
- kind: page-fetch
  name: Supreme Court of the United States, argument transcript pages
  detail: 'One page per term: supremecourt.gov/oral_arguments/archived_transcripts/<term> for the 1968 to 1999 terms and supremecourt.gov/oral_arguments/argument_transcript/<term> for the 2000 to 2025 terms; 5,967 transcripts listed.'
- kind: page-fetch
  name: National Archives Catalog dataset (AWS Registry of Open Data)
  detail: 'The 400 description files of Record Group 267, searched for transcripts. The series "Transcripts of Oral Arguments" (catalog 562621) runs from 1968 and is held on paper in Washington, D.C., with no digital copies.'
purpose: 'Trevor asked on Nov. 27, 2026 for "official transcripts of the audio" for a player that shows the Justices, counsel and parties beside the transcript.'
queries:
- Which of the site's Supreme Court cases argued since the October 1968 term have an official transcript of the argument, and where is one for earlier cases
limits: 'Matching is by docket number and argument day, or by the parties'' names on an argument day where the Court''s list misprints the docket (*DeFunis v. Odegaard*, 73-235, is listed as 72-235). The scans before the 2000 term carry the text layer the Court''s library made, which has reading errors. Until 2004 the transcripts mark a Justice''s question "QUESTION" without naming the Justice. The transcripts are not yet matched to the recordings by time.'
---

# Supreme Court argument transcripts: session notes

**Where official transcripts exist.** The Court's own site has a transcript of every argument since the October 1968 term. The Court's page on transcripts says that those before the October 2000 term "have been scanned from the Supreme Court Library collection", and that since the October 2017 term the court reporter's same-day transcripts "are considered official but subject to final review" (supremecourt.gov/oral_arguments/archived_transcripts/1990). The National Archives describes its own series, "Transcripts of Oral Arguments" (Record Group 267, catalog 562621), as "verbatim transcripts" from 1968 on, adding that "From 1968-2003 the transcripts do not identity the name of the judge asking a question" and that from 2004 they do; that series is bound volumes in Washington, D.C., not digitized. Neither source has an official transcript before 1968, so the 16 cases argued from 1955 to 1968 have recordings but no transcript.

**Results.** 164 of the site's Supreme Court cases were argued since October 1968. 160 have at least one transcript; 167 transcripts in all (a case argued on two days, or reargued, has more than one). Four arguments are not on the Court's lists: *Tonasket v. Washington* (Dec. 12 to 13, 1972), *Mattz v. Arnett* (Mar. 27 to 28, 1973), *Oneida Indian Nation v. County of Oneida* (Nov. 6 to 7, 1973) and *United States v. Clarke* (Jan. 15 to 16, 1980). Their transcripts would be in the National Archives' paper series. The list is research/supreme-court-coverage/argument-transcripts.csv; the files are in the bucket under supreme-court-transcripts/<term>/ and in the capture index.

**What the transcripts give the player.** Each transcript opens with the Justices present (in the older scans, "BEFORE:"), the counsel who argued and for whom ("APPEARANCES:"), and a table of contents with the page each argument begins. Each speaker's turn is headed with the speaker's name (MR. McGILL:, JUSTICE SOTOMAYOR:, or before 2004 QUESTION:). The transcripts carry page and line numbers but no times, so the player's times will come from matching the text to the recording.
