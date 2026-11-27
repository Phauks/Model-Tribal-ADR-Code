---
id: 2026-11-27-supreme-court-argument-audio
date: '2026-11-27'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session wrote scripts/caselaw/supreme_court_argument_audio.py, matched every Supreme Court case record argued or decided since the 1955 term to its recordings, downloaded them into the project's R2 bucket with their SHA-256 and length, and wrote each case's argument_audio block.
- kind: page-fetch
  name: Supreme Court of the United States, argument audio pages
  detail: 'One page per term since the October 2010 term (supremecourt.gov/oral_arguments/argument_audio/<term>) and one page per argument naming its MP3 (supremecourt.gov/media/audio/mp3files/<docket>.mp3).'
- kind: page-fetch
  name: National Archives Catalog dataset (AWS Registry of Open Data)
  detail: 'The 400 description files of Record Group 267 (s3://nara-national-archives-catalog/descriptions/record-groups/rg_267/), read with no key; 3,389 sound recording descriptions in the Black, Red and Gold Series and "Sound Recordings of Oral Arguments and Selected Non-Arguments". The files were fetched from the catalog''s media host (catalog.archives.gov/medialz/), since the storage bucket the dataset names (s3.amazonaws.com/NARAprodstorage) answered 403 to every request from the cloud on Nov. 27, 2026.'
- kind: page-fetch
  name: Supreme Court Database
  detail: 'The docket-centered file of the 2026_01 release (SCDB_2026_01_caseCentered_Docket.csv), for each case''s docket numbers and argument and reargument dates.'
purpose: 'Trevor asked on Nov. 27, 2026 to "grab those oral arguments", rank 1 of the audio and video study (research/analyses/2026-11-27-audio-video-and-more-sources.md).'
queries:
- Which of the site's Supreme Court cases argued or decided since the 1955 term have a sound recording of the argument or of the opinion's announcement, at the Court or at the National Archives
sources_added: []
limits: 'Matching is by docket number and date, read from the catalog''s titles; a title the Archives wrote wrongly could hide a recording or, rarely, point to the wrong day (four such date differences are noted on their records). Before 2005 the Archives keeps the whole day in court as one or more reels, so a case is somewhere inside its file; where it begins is not recorded. No transcripts were made.'
---

# Supreme Court argument audio: session notes

**Cases.** Every source record of kind federal-case decided by the Supreme Court with an argument date, or a decision, on or after Oct. 1, 1955: 187 cases. Their docket numbers come from the Supreme Court Database's docket-centered file (joined through research/reviews/2026-11-24-supreme-court-native-cases.csv, or by U.S. Reports citation) and from the record's own links for recent cases the Database does not cite yet. Argument dates are the record's `court_dates.argued` and the Database's argument and reargument dates.

**The Court's own files.** The Court has posted every argument since the October 2010 term. Each term's page lists docket, case name and the day argued; 33 arguments match our cases.

**The National Archives.** The catalog describes the recordings one tape or one day at a time, titled with each case heard and its docket number ("[Case 98-791]"), and gives the day it was made. A case matches when a docket number of the case is in the title and the day is within four days of an argument date. The Black Series (1955 to 1972) gives the docket number without the term ("[Case 78]" for 70-78) and has one file per case, named 267-<tape>-<docket>-<date>.mp3; only the case's own files are kept. A docket number of the form 96-1577 is unique, so a title that names one matches even when the catalog's day differs from the argument; the four such records say so in a note (*Alaska v. Native Village of Venetie*, *Amoco Production Co. v. Southern Ute Indian Tribe*, *Amoco Production Co. v. Village of Gambell*, and *Babbitt v. Youpee*, whose announcement of Jan. 21, 1997 is on a reel dated Feb. 18, 1997). A part of the title headed "OPINIONS" (or "Opinion (date)"), made within four days of the decision, is the Court announcing its opinion: 70 such files, for the Red and Gold Series. Original cases reuse their docket number for decades (*Arizona v. California*, No. 8 Orig.), so for them the day must match.

**Results.** 180 of the 187 cases have at least one argument recording; 486 files in all (455 distinct files, since one day's reel can hold two of our cases), 36.1 GB. The other seven were decided without argument: *Arizona v. California* (1984 and 2006 decrees), *California State Board of Equalization v. Chemehuevi Indian Tribe* (1985), *Fisher v. District Court* (1976), *Madison County v. Oneida Indian Nation* (2011), *National Farmers Union Insurance Cos. v. Crow Tribe* (1984, in chambers) and *United States v. Jim* (1972). The list is research/supreme-court-coverage/argument-audio.csv; the files are in the bucket under supreme-court-audio/ and in the capture index, with their length read by ffprobe.

**Not yet served.** The site serves only PDF, HTML, text and JPEG copies today (site/src/lib/public-copies.ts), so the recordings are stored and recorded but not yet played or offered for download. The player waits for Trevor's choice of mockup (design/argument-audio in the project files).
