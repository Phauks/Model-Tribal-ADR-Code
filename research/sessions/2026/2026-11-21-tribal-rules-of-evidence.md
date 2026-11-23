---
id: 2026-11-21-tribal-rules-of-evidence
date: 2026-11-21
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: >-
    Lead session reused the project's captured Tribal law texts and provision
    data, ran web searches, and sent pages to helpers on a smaller model
    (eight page-reading helpers, each with three to eight pages and a fixed
    list of questions; one helper on a mid-sized model for the Morote
    article, which was blocked). Three more smaller-model helpers classified
    317 passages pulled from the captures by script. The lead session then
    downloaded the pages it relies on most and checked the key passages
    against the page text.
- kind: web-search
  name: Web search
- kind: page-fetch
  name: Web page fetch tool
  detail: >-
    Used by the helpers. Long PDFs were read verbatim only in part; the rest
    came from the tool's own summary and is marked so in the helpers'
    reports. Helpers flagged several places where that summary was wrong.
- kind: page-fetch
  name: Direct downloads (curl) with PDF text extraction (pdftotext)
  detail: >-
    Used by the lead session to check Warm Springs, Northern Cheyenne,
    Pascua Yaqui, Wyandotte, Lower Elwha (Arakawa), Stockbridge-Munsee, Lac
    Courte Oreilles, the Umatilla rules, Belone, 25 C.F.R. § 11.504 (eCFR
    API), 25 U.S.C. §§ 1302 and 1304, and Fed. R. Evid. 1101. Karuk's code
    site and the Seattle University repository served a browser challenge.
purpose: >-
  A tentative spike, asked for by Trevor: what rules of evidence Native
  nations' courts use, how evidence works in Tribal ADR and peacemaking, and
  whether the topic is worth pursuing for the model code.
queries:
- tribal court rules of evidence adopt Federal Rules of Evidence tribal code
- Navajo Nation Rules of Evidence peacemaking confidentiality privilege
- tribal court customary law proof expert testimony elders judicial notice
- tribal code mediation confidentiality privilege Uniform Mediation Act tribe
- 25 CFR part 11 Court of Indian Offenses rules of evidence
- Hopi tribal court custom tradition evidence (Richland, Arguing with Tradition)
- Navajo Supreme Court proof of Navajo common law custom judicial notice
- Ho-Chunk Nation Traditional Court custom tradition
- tribal code privilege spiritual advisor medicine man traditional healer
- Newton, Tribal Court Praxis (22 Am. Indian L. Rev. 285)
- Uniform Mediation Act enactment history
limits: >-
  No source records were added; this is a spike, and the analysis cites
  sources directly. The machine pass read short passages around loose
  keyword matches, not whole codes, and nobody has checked its
  classifications. Scanned PDFs without a text layer, ecode360 and Municode
  were not read. The Navajo evidence and declaratory ruling rules were seen
  only as tables of contents. Newton (1998) and Richland (2008) were not
  read. Morote (2026) was read in full later the same evening from a copy
  Trevor uploaded. Whether any nation has adopted the Uniform Mediation Act was
  not checked.
---

# Tribal rules of evidence: spike

Trevor asked (Nov. 21, 2026) for a tentative look at the rules of evidence Native nations' courts use and how evidence works in Tribal ADR, to decide whether the topic is worth pursuing. Result: [2026-11-21-tribal-rules-of-evidence](../../analyses/2026-11-21-tribal-rules-of-evidence.md).

## What was reused

- The 85 provisions with a stated confidentiality rule in `research/tribal-law/provisions.csv` (from the tribal law texts session).
- The 1,616 text layers of captured Tribal law documents, kept privately in the project's working files.

## Machine pass over the captures

1. `python3 scripts/law/evidence_spike_extract.py <capture text dir> snippets.json` pulled 317 passage records (patterns: Federal Rules of Evidence, a state's rules, "not bound by rules of evidence," custom with elders or proof, traditional privileges, compromise offers).
2. Three smaller-model helpers classified the records into court evidence rules (108), proof of custom (136) and privilege or compromise (73), each with a supporting quotation checked by script as an exact substring of the passage.
3. The quotation-free result is [evidence-spike-passages.csv](../../tribal-law/evidence-spike-passages.csv) (210 rows after dropping "irrelevant" and "none"). The passages and the classifications with quotations stay private in `research/tribal-law/evidence-spike/` in the project's working files.

Helpers' own caveats, kept here for whoever reviews the CSV: preliminary question rules (like Fed. R. Evid. 104(a)) are coded "not-bound" with that scope, which is not a general relaxation; four tables of contents that suggest adoption of the federal or a state's rules (Klamath, Cherokee Nation, Salish and Kootenai, Match-e-be-Nash-She-Wish) need the full text; seven "community expert witness" definitions were coded as expert testimony on custom although they do not say how custom is proven.

## Section 2.1 keyword counts

Run from the repository root:

```python
import csv, re
rows = [r for r in csv.DictReader(open("research/tribal-law/provisions.csv"))
        if r["confidentiality"] == "stated" and not r["duplicate_of"]
        and r["second_pass_verdict"] != "drop"]
features = {
    "settlement-negotiation analogy": r"settlement negotiation",
    "privileged": r"privileg",
    "inadmissible or not used later": r"inadmissib|not admissible|cannot be used|may not be used|not be used|cannot be admitted|not usable|bars us|stay out of the record|not .*admitted",
    "neutral cannot testify": r"witness|compelled to disclose|testify",
    "abuse or neglect exception": r"abuse|neglect",
    "waiver in writing": r"in writing",
    "non-disclosure agreement or oath": r"non-disclosure|oath|swear",
    "no record or notes destroyed": r"no record|destroy|recording",
    "juvenile or child setting": r"juvenile|child|youth|minor",
}
for name, pattern in features.items():
    hits = [r for r in rows if re.search(pattern, r["summary"], re.I)]
    print(name, len(hits), len({r["nation"] for r in hits}))
```

## Checked by download

Passages the analysis relies on were checked against downloaded text: Warm Springs §§ 204.100 and 204.120(4); Northern Cheyenne § 6.1.2 and its draft marking; Pascua Yaqui R. 4(A), 20 and 21; Wyandotte §§ 503 and 505 and the Federal Rules gap filler; Arakawa's quotation of the Lower Elwha ordinance; Stockbridge-Munsee § TCT.02.14; Lac Courte Oreilles §§ TCT.4.1.010 and TCT.4.3.080; the Umatilla preamble and Rule 502; Belone's three methods and court-appointed experts; Colville § 1-9-8 (from the project's capture); 25 C.F.R. § 11.504; 25 U.S.C. §§ 1302(a)(6), 1302(c)(4) and 1304(d); Fed. R. Evid. 1101(a). Everything else was read through the fetch tool and is marked so in the analysis.

## Follow-up: Morote (2026)

Trevor uploaded the article on Nov. 21, 2026 (evening, Pacific time). It was read in full from its text layer (pages 79 to 106) and added to the analysis as section 1.6. The private copy is `research/captures/articles/morote-2026-tribal-rules-of-evidence.pdf` in the project's working files. Leads from its footnotes, not followed: Indian Tradition and Custom in Adjudication Under Rules of Evidence (Tribal Court Clearinghouse; the article gives the author as "John Zion," probably James W. Zion, not verified); Max Virupaksha Katner, Native American Oral Evidence: Finding a New Hearsay Exception (Georgetown Tribal Law Journal, 2020; the article cites it two ways); Hope M. Babcock, "[This] I Know From My Grandfather," 37 Am. Indian L. Rev. 19 (2013). The article cites Fletcher's 2006 working paper under a different title from the one on the paper itself; the analysis uses the title on the paper.

## Leads not followed

- Nell Jessup Newton, Tribal Court Praxis: One Year in the Life of Twenty Indian Tribal Courts, 22 Am. Indian L. Rev. (1998) (first page not verified), for how courts handle evidence in practice.
- Justin B. Richland, Arguing with Tradition: The Language of Law in Hopi Tribal Court (2008), on how tradition is argued in court.
- Arbitration: whether Tribal arbitration codes say which evidence rules apply was not searched.
