---
id: 2026-11-28-state-statutes-new-hampshire-west-virginia
date: '2026-11-28'
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: One session wrote a New Hampshire adapter for the shared state statutes pipeline (scripts/law/state_statutes/), ran it, read every strong hit a reader marked none and 40 random verdicts, and settled the three it read again in settled.json. Smaller Claude models (Haiku) read every keyword hit and the recall samples blind to their pool, in six batches of 131, and gave each section a core, incidental or none verdict.
- kind: page-fetch
  name: New Hampshire General Court's Revised Statutes Online
  detail: 'Every merged chapter page of the online Revised Statutes (gc.nh.gov/rsa/html/<title>/<chapter>/<chapter>-mrg.htm), all 1,800 chapters listed on the contents pages of the 67 titles. The site refuses connections from cloud sessions, so a temporary GitHub Actions workflow on the working branch ran the adapter''s download and committed it; the workflow and the download were removed before the pull request.'
purpose: 'Trevor asked on Nov. 26, 2026 (Pacific time) to "start on tier 3 for states"; the New England and Mid-Atlantic thread left New Hampshire and West Virginia for a separate thread because both sites refuse cloud sessions. Trevor chose Cloudflare on Nov. 27, then, when the Cloudflare token and connector still lacked the needed permissions, a temporary GitHub fetch job (Nov. 28), and for West Virginia a download on his own computer (Nov. 28).'
queries:
- Which sections of the New Hampshire Revised Statutes are Indian law, labeled core or incidental, by the Oklahoma pilot's method
- How well the keyword pass finds them, measured on random samples of the other sections
- Whether any route reaches West Virginia's code sites
sources_added: []
limits: 'Reader verdicts are Unverified until a person checks them (Trevor will review every state''s labels once all are in). Recall rests on samples of 264 non-hits near a strong hit and 300 other non-hits. Each record links to the official site and is not served (state statutes stay link only). Sections in force only. West Virginia is not read: its sites refused every route tried.'
---

# State statutes sweep, New Hampshire and West Virginia: session notes

The method is the one in the first sweep's notes (research/sessions/2026/2026-11-27-state-statutes-sweep.md) and in `scripts/law/state_statutes/README.md`, with the readers' wrapper prompt in `research/state-statutes/reader-prompt.md` (New Hampshire's note is added there) and the spot check `scripts/law/state_statutes/spot_check.py`. New Hampshire's results are in `research/state-statutes/nh/`.

## Getting the pages

Both legislatures' sites refuse cloud sessions. The plan in the handoff brief was a temporary relay Worker on Cloudflare. In this session the environment's Cloudflare token still answered "Invalid API Token", and the Cloudflare connector lacked the Browser Rendering and Workers Scripts permissions, so neither could be used. Trevor then chose a temporary GitHub Actions job on the working branch, as Wisconsin's download had used. GitHub's runners reached gc.nh.gov but not West Virginia: connections to code.wvlegislature.gov (129.71.164.52) and www.wvlegislature.gov (129.71.164.30) timed out before any reply, on both ports 80 and 443. Trevor chose to run West Virginia's download on his own computer; that session found the Legislature's hosts refusing connections from his computer too (other West Virginia government sites loaded), and the computer then went offline. West Virginia is left for a later thread.

## New Hampshire

The General Court prints each chapter in full on one "merged" page, with the section's catchline in bold, its text in a `codesect` element and its source note in a `sourcenote` element; each title's contents page lists its chapters. Section numbers are kept as the code prints them, `<chapter>:<section>` ("12-A:14-a"), and cited "N.H. Rev. Stat. Ann. § 12-A:14-a (2026)". A run of repealed sections prints as one entry ("72:16, 72:17 Repealed by 1970, 5:8"), which the adapter keeps as one repealed section under its first number. Title X's contents page lists two chapters (126-B and 126-BB) 58 times each; the adapter reads each chapter once. The site answered slowly and stopped answering for long stretches, so the download ran in 40-minute rounds over two GitHub runs, with three workers and a 30-second timeout; every listed chapter page was saved.

29,469 sections, 26,176 in force; 32 strong and 190 weak-only hits (mostly "native" plants and wildlife, "reservations" of names and deeds, and "nation"); no chapter is named for Indian law, so pool E is empty. 36 Indian law sections (5 core, 31 incidental). The core sections are the New Hampshire Commission on Native American Affairs (RSA 12-A:14-a), the unmarked burial sections on Native American remains (RSA 227-C:8-a, 8-d and 8-g) and the child custody act's application to Indian tribes (RSA 458-A:3). Most incidental sections are uniform acts' definitions of "State" that include tribes, the unemployment compensation sections on tribal employers, tribal court orders and tribal territory offenses, and the Revolution commission's seat for the Native American affairs commission's chair (RSA 17-S:2).

The readers marked three strong hits none. The session agreed with two, where "IHS" means in-home supports (RSA 171-A:35) and an innovative housing structure (RSA 674:82), and settled the third incidental: Indian Health Service credentialing qualifies an optometrist to treat glaucoma (RSA 327:6-c), as other states' sessions held for Indian Health Service roles. Neither recall sample found a miss, and the 40 verdicts read at random all agreed.

## West Virginia

Not read. A later thread can retry the download on Trevor's computer (the site may have been down, or blocking that address, on Nov. 28) or through a Cloudflare Worker once the token or connector has the Workers Scripts permission.
