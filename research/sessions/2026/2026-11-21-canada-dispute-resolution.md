---
id: 2026-11-21-canada-dispute-resolution
date: 2026-11-21
researchers:
- Trevor Goldsmith
- Claude (AI assistant)
tools:
- kind: ai-assistant
  name: Claude (AI assistant)
  detail: >-
    Trevor asked for a look at dispute resolution among Indigenous peoples in
    Canada for a short comparative sidebar, stressing that nations predate the
    border. The lead session split the work into four slices (legal status,
    criminal and restorative justice, disputes with the Crown, cross-border
    nations) and gave each to a research helper on a smaller model. Each
    helper saved every page it cited and checked its own quotations by
    script. The lead session then filled gaps itself (the 2026 Criminal Code
    restorative justice part, the Teslin Tlingit Peacemaker Court, the
    Blackfoot Confederacy, paragraph numbers in Desautel, Haida and Ipeelee,
    Truth and Reconciliation Commission Calls 42 and 50, Indian Act s. 10),
    and re-checked every quotation in the analysis note against the saved
    pages by script (77 of 80 matched; the other three were checked by hand:
    Call 50, whose PDF text is interleaved across columns, a Santa Clara
    Pueblo quotation taken from the project's case digest, and the words of
    the Indian Commerce Clause).
- kind: web-search
  name: Web search
- kind: page-fetch
  name: Direct downloads (curl) with PDF text extraction (pdftotext)
  detail: >-
    Government of Canada sites (Justice Laws, Department of Justice,
    Crown-Indigenous Relations), the Federal Court decisions site, nations'
    own sites and the Avalon Project downloaded normally. CanLII refused
    automated downloads, and the Supreme Court of Canada decisions site served
    a bot check for some requests, so those were not pursued. The Indian
    Residential Schools Adjudication Secretariat final report host showed a
    bot block.
purpose: >-
  Survey dispute resolution, restorative justice, peacemaking and
  Crown-Indigenous dispute processes in Canada, the legal status of First
  Nations, Inuit and Métis compared with the United States trust
  relationship, and nations that span the Canada-United States border, for a
  short comparative sidebar.
queries:
- Jay Treaty Article III; 8 U.S.C. 1359 American Indians born in Canada; Immigration and Refugee Protection Act s. 19
- R. v. Desautel 2021 SCC 17; Mitchell v. M.N.R. 2001 SCC 33 Jay Treaty Mohawk
- Mohawk Council of Akwesasne community, court, community justice program; Jay Treaty students decision 2026
- Blackfoot Confederacy Tribal Council governance member nations
- Teslin Tlingit Council Peacemaker Court administration of justice agreement
- Constitution Act 1982 s. 35; Indian Act definitions, s. 10 membership, s. 14.2 protests, s. 81 by-laws
- Haida Nation 2004 SCC 73 honour of the Crown fiduciary duty; Manitoba Metis Federation 2013 SCC 14; Daniels 2016 SCC 12
- Criminal Code s. 718.2(e); R. v. Ipeelee 2012 SCC 13; Criminal Code alternative measures restorative justice processes 2026
- Indigenous Justice Program evaluation 2021; Spotlight on Gladue Tsuu T'ina court; Kahnawà:ke Justice Services
- Truth and Reconciliation Commission Calls to Action 42 and 50
- Guide for the Management of Dispute Resolution Mechanisms in Modern Treaties; BC Treaty Commission role
- Independent Assessment Process statistics; Federal Court Practice Guidelines for Aboriginal Law Proceedings 2021
- First Nations Elections Act contest; custom election exhaustion of internal remedies Federal Court 2025
- An Act respecting First Nations, Inuit and Métis children, youth and families dispute resolution mechanisms
sources_added:
- bc-treaty-commission-what-we-do
- bia-faq-federal-indian-trust-responsibility
- blackfoot-confederacy-governance
- blackfoot-confederacy-home
- canada-children-youth-families-act-2019
- canada-constitution-act-1867-s91-24
- canada-constitution-act-1982-s35
- canada-criminal-code-part-xxii-2
- canada-criminal-code-s718-2
- canada-first-nations-elections-act-2014
- canada-immigration-and-refugee-protection-act-s19
- canada-indian-act
- canada-undrip-act-2021
- cbc-2025-teslin-tlingit-justice
- cfr-8-289-2
- cirnac-2011-teslin-tlingit-peacemaker-court-fact-sheet
- cirnac-guide-dispute-resolution-modern-treaties
- cirnac-indian-residential-schools-settlement-statistics
- cirnac-indigenous-peoples-and-communities
- daniels-v-canada-2016
- federal-court-canada-2021-aboriginal-law-practice-guidelines
- haida-nation-v-british-columbia-2004
- jay-treaty-1794
- justice-canada-2021-indigenous-justice-program-evaluation
- justice-canada-restorative-justice-indigenous-legal-traditions
- justice-canada-spotlight-on-gladue
- kahnawake-justice-services
- manitoba-metis-federation-v-canada-2013
- mohawk-council-of-akwesasne-2026-jay-treaty-students
- mohawk-council-of-akwesasne-akwesasne-court
- mohawk-council-of-akwesasne-community-justice-program
- mohawk-council-of-akwesasne-our-community
- onondaga-nation-2010-haudenosaunee-passports
- r-v-desautel-2021
- r-v-ipeelee-2012
- rabbitskin-v-big-river-first-nation-2025
- truth-and-reconciliation-commission-2015-calls-to-action
limits: >-
  Written for a sidebar, not a survey of Canadian Indigenous law. Not read:
  Mitchell v. M.N.R., R. v. Gladue, R. v. Powley, Guerin, the Sept. 1, 2026
  Northern District of New York decision in the Jay Treaty students case, the
  Independent Assessment Process final report, the Indian Claims Commission's
  mediation record, the Nunavut, Yukon and Tłı̨chǫ dispute chapters, the Royal
  Commission on Aboriginal Peoples and Manitoba inquiry reports, the federal
  and British Columbia Indigenous justice strategies, and Nunavut, Mi'kmaw and
  Eeyou Istchee justice programs. No official source was found on
  cross-border dispute arrangements for Coast Salish, Tlingit, Gwich'in,
  Inuit, Passamaquoddy and Peskotomuhkati, Mi'kmaq or Dakota and Lakota
  nations. Ceremonial and spiritual content was deliberately not recorded.
  Eight web sources have no Wayback copy yet (28 of 36 already had one).
---

# Dispute resolution among First Nations, Inuit and Métis in Canada

Findings are in
[research/analyses/2026-11-21-canada-dispute-resolution.md](../../analyses/2026-11-21-canada-dispute-resolution.md).

## How the search ran

Four helpers each took one slice and wrote their findings, with the exact
quotation, address and saved file, to a private scratch folder. Every helper
quotation was checked by script against the saved file; quotations that did
not match were dropped.

The lead session corrected three things in the helper results:

- A helper read the repeal of Criminal Code s. 717 as moving alternative
  measures to Part XXII.1. Part XXII.1 is remediation agreements; the new
  provisions are Part XXII.2 (ss. 715.44-715.56), added by S.C. 2026, c. 19.
- Ipeelee quotations were first pinned to headnote pages. The note quotes
  the reasons (paras. 59-60) instead.
- A helper summarized band membership as decided only by the Registrar. The
  Indian Act separates registration (Registrar, s. 14.2) from band membership,
  which a band may control with its own review mechanism (s. 10).

## What was ruled out

- Secondary summaries of Mitchell v. M.N.R. were found but not used; the note
  relies on Desautel's description of it until the decision itself is read.
- No law review article comparing United States and Canadian Indigenous
  legal status was read in this session.
