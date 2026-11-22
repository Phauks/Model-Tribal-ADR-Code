# Project charter

**Status:** draft, adopted by the lead author, Trevor Goldsmith, on 2026-11-20 for review by the
project's faculty advisors. Changes to this charter are made by pull request
and recorded in git history.

This charter states how the Model Tribal ADR Code project gathers, credits,
publishes and protects knowledge about Native nations' dispute resolution. It
binds everyone who contributes. Where a commitment rests on a published
principle or law, a footnote cites it; where it is the project's own judgment,
it says so.

## Purpose

The project offers model provisions, commentary, and a collection of "methods
and manners" of dispute resolution that Native nations in the United States,
including Alaska, Hawaiʻi and the territories, may consult and adapt. It is an
optional resource. It does not speak for any nation, describe any nation's law
as binding, or offer legal advice.

## Commitments

### 1. Indigenous data governance under the CARE Principles

The project adopts the CARE Principles for Indigenous Data Governance:
Collective benefit, Authority to control, Responsibility, and Ethics.[^care-gida][^care-dsj]
The principles hold that "Indigenous Peoples must be the ones to determine data
governance protocols."[^care-dsj] In this project they mean:

| Principle | Source wording | What the project does |
| --- | --- | --- |
| Collective benefit | Data ecosystems should "enable Indigenous Peoples to derive benefit from the data"[^care-gida] | Model provisions are dedicated to the public domain (CC0) so any nation can enact them freely; the work is published openly |
| Authority to control | "Indigenous Peoples' rights and interests in Indigenous data must be recognised"[^care-gida] | A nation's request to correct, restrict or remove material about it is honored (commitment 6) |
| Responsibility | Those working with Indigenous data must "share how those data are used"[^care-gida] | Every source, research session and permission is recorded in this public repository |
| Ethics | "Indigenous Peoples' rights and wellbeing should be the primary concern at all stages of the data life cycle"[^care-gida] | Restricted knowledge is never published, exported, cached offline or served by any API (commitment 5) |

### 2. Respect for each nation's own institutions

Indigenous peoples have the right "to maintain and strengthen their distinct
political, legal, economic, social and cultural institutions"[^undrip-5] and to
"promote, develop and maintain their institutional structures and their
distinctive customs, spirituality, traditions, procedures, practices and, in
the cases where they exist, juridical systems or customs."[^undrip-34]
Accordingly (project analysis):

- every model provision offers alternatives and drafting notes rather than one
  answer, and is written to be adapted through a nation's own law-making
  process;
- the work describes published practice; it does not rank nations' systems or
  present one nation's practice as a standard for others.

### 3. Peacemaking as its own track

Peacemaking rests on each nation's own traditions, language and institutions,
not on the theory behind mediation or arbitration (project analysis). Nations'
own laws show this: the Navajo Nation directs its Peacemaking Program to
conform its procedures to Navajo concepts such as K'é and clanship, and many
nations choose peacemakers for their standing and knowledge of custom rather
than for training as neutrals.[^peacemaking-research] The Native American
Rights Fund's Indigenous Peacemaking Initiative, which collects nations'
peacemaking laws, describes peacemaking as "traditional ways of resolving
conflict in Indigenous communities."[^narf-ipi]

The project therefore keeps peacemaking as its own track. Its model
peacemaking provisions and commentary are kept apart from the alternative
dispute resolution provisions, under their own heading. They set up or
recognize a nation's peacemaking forum and connect it to the nation's court
and other forums. They do not define how peacemaking is done, which each
nation decides by its own tradition
([decision record 0026](decisions/0026-model-peacemaking-code.md)).

### 4. Consultation before publication

Indigenous peoples have the right "to participate in decision-making in matters
which would affect their rights, through representatives chosen by themselves
in accordance with their own procedures."[^undrip-18] The Declaration directs
states to seek free, prior and informed consent before measures that may affect
Indigenous peoples;[^undrip-19] federal policy likewise calls for "regular and
meaningful consultation and collaboration with tribal officials."[^eo-13175]
Those duties bind governments, not this project, but the project adopts their
spirit (project analysis), following the guidance that researchers "must engage
with key tribal stakeholders and decision-makers at all phases of the research
process."[^ncai]

In practice:

- every record about a nation carries a review status, from "drafted from
  public sources" through "sent to nation", "reviewed by nation" and "approved
  by nation";
- before the 1st Edition is published, each nation profiled or used as an
  illustration is offered the chance to review what is said about it;
- contact goes through the nation's own representatives or offices, such as
  its tribal court or government, not through individuals acting alone.

### 5. Cultural knowledge and restricted material

Indigenous peoples have the right "to maintain, control, protect and develop
their cultural heritage, traditional knowledge and traditional cultural
expressions," including "their intellectual property over such cultural
heritage."[^undrip-31] Therefore:

- the project uses published sources (a nation's own codes, court rules and
  official program materials) and material a nation has approved;
- ceremonial, restricted or community-held knowledge is not added without the
  community's written approval, and is marked restricted if it is held at all;
- the project may attach Local Contexts Notices, which are "applied by
  researchers or institutional/repository staff," to signal Indigenous
  connections, and displays any Labels a community applies itself.[^lc-tk]

### 6. The right to correct, restrict or withdraw

A Native nation may ask that material about it be corrected, restricted or
removed, and may contribute to it. A nation the project has missed may ask
to be added. The nation's request wins. This is the
project's implementation of CARE's "Authority to control" (project analysis).

**Who may ask.** A nation speaks through its own government or an office it
designates, such as its Tribal court, legal department or cultural
preservation office (see commitment 4). Anyone may raise a concern, but a
request to change or withdraw material about a nation is confirmed with that
nation's office before it is final. A person may always ask about their own
name, words or contribution.

**What may be asked.**

| Request | What the project does |
| --- | --- |
| Correct | Fixes a fact, name, spelling or citation, and records the source of the correction. |
| Restrict | Hides the material from the website, exports, offline copies and any API while the request is reviewed, or permanently marks it restricted (commitment 5). |
| Remove | Withdraws the record, sets its review status to "withdrawn at request", and leaves a notice that says only that material was withdrawn at the nation's request. |
| Contribute | Adds the nation's sources, review comments, preferred terms or authored text, credited as the contributor chooses (commitment 7). |
| Add | Adds a nation the project has missed when a federal or state government source names it, after checking that source; explains the reasons in writing if it declines, and accepts new proof at any time or a request for reconsideration ([requests.md](requests.md#adding-a-nation-that-is-missing)). |

**How the project responds.**

- Any request to restrict or remove takes the material out of public view
  first and reviews it second. Erring toward protection follows CARE's
  principle that Indigenous "rights and wellbeing should be the primary
  concern."[^care-gida]
- Requests are received privately, not in public issue threads, and the
  requester's details are never published.
- The change is made in the next release, or sooner as a correction release.
  The public log records the date, the record and the action taken, without
  repeating the withdrawn content and without naming the requester.
- If withdrawn material is restricted or sacred, the project also removes it
  from the repository's history and asks archive services to remove copies,
  where they allow it. Printed copies already sold cannot be recalled; the
  next printing omits the material.
- A nation's preferred names and terms are added to the project dictionary
  ([terminology.md](terminology.md)) and apply from then on.

The website's request page and the steps behind it are specified in
[requests.md](requests.md).

### 7. Credit, authorship and art

- Indigenous authors, reviewers and peacemakers who contribute are credited by
  name, unless they ask not to be.
- Cover and interior art is to be made by Native artists, chosen through a
  contest, credited, and paid where the project can do so; terms are set in a
  written agreement with each artist.
- Contributors keep credit for their work under the licenses in
  [LICENSE.md](../LICENSE.md).

### 8. Evidence and citation

- Every factual claim cites a source. The project's own analysis is labeled as
  analysis.
- Every web source is archived, and its change history is tracked, so readers
  can see what a source said when it was cited.
- Cases and statutes are checked for negative treatment, and the check is dated.
- How sources were found is recorded in dated research session files, including
  when an AI research assistant was used.

See [citation-style.md](citation-style.md) and [data-model.md](data-model.md).

### 9. Copyright and permissions

The project quotes only what the law allows or what owners permit, and records
the basis for every quotation. Fair use depends on four factors: the purpose and
character of the use, the nature of the work, "the amount and substantiality of
the portion used," and "the effect of the use upon the potential market."[^usc-107]
Because tribal law belongs to each nation, the project quotes tribal legal texts only as the permission statuses allow (project analysis, not legal advice). Since 2026-11-22 the website also serves its own copies of the nations' constitutions and laws it cites, each with its original address and a link to ask for its removal or redaction, which the project honors (decision record [0031](decisions/0031-serve-copies-of-documents-from-the-private-bucket.md)).

### 10. Positionality and transparency

The lead author, Trevor Goldsmith, is a law student who is not Native American. A short
positionality statement appears in the book's preface or foreword. The project
does not present itself as an Indigenous voice; it presents published practice,
credits Indigenous sources, and invites correction.

### 11. Future expansion beyond the United States

If later editions cover First Nations in Canada, the project will also follow
the First Nations principles of ownership, control, access and possession,
which "assert that First Nations have control over data collection processes,
and that they own and control how this information can be used."[^ocap] OCAP®
is a registered trademark of the First Nations Information Governance Centre
(FNIGC), [fnigc.ca](https://fnigc.ca/).[^ocap] Expansion to Mexico would follow
the comparable principles of the nations concerned.

## Limits

This charter is a statement of the project's practices. It is not legal advice,
does not create legal rights or obligations, and does not replace any nation's
own research or data rules, which take precedence where they apply.

## References

[^care-gida]: Global Indigenous Data Alliance, *CARE Principles for Indigenous Data Governance* (one-page summary, Sept. 2019), [read via a hosted copy](https://www.causeweb.org/jedi/sites/default/files/2023-06/careprinciples_onepagersfinal_oct_17_2019.pdf); overview at [gida-global.org/care](https://www.gida-global.org/care).
[^care-dsj]: Stephanie Russo Carroll et al., *The CARE Principles for Indigenous Data Governance*, 19 Data Sci. J. 43 (2020), [doi:10.5334/dsj-2020-043](https://datascience.codata.org/articles/10.5334/dsj-2020-043).
[^undrip-5]: United Nations Declaration on the Rights of Indigenous Peoples, G.A. Res. 61/295, art. 5 (Sept. 13, 2007), [text as reproduced by the Government of Canada](https://justice.gc.ca/eng/declaration/decl_doc.html).
[^undrip-18]: *Id.* art. 18.
[^undrip-19]: *Id.* art. 19.
[^undrip-31]: *Id.* art. 31(1).
[^undrip-34]: *Id.* art. 34.
[^eo-13175]: Exec. Order No. 13175, *Consultation and Coordination With Indian Tribal Governments*, 65 Fed. Reg. 67249 (Nov. 9, 2000), [govinfo.gov](https://www.govinfo.gov/content/pkg/FR-2000-11-09/html/00-29003.htm).
[^ncai]: NCAI Policy Research Center & MSU Center for Native Health Partnerships, *"Walk Softly and Listen Carefully": Building Research Relationships with Tribal Communities* 13 (2012), [archive.ncai.org](https://archive.ncai.org/resources/ncai_publications/walk-softly-and-listen-carefully-building-research-relationships-with-tribal-communities).
[^peacemaking-research]: [Comparing model codes and dispute frameworks](../content/essays/i-comparative-model-codes-and-frameworks.md), section 3 (citing Navajo Nation Code tit. 7, §§ 409–411, 413); [Peacemaking programs in the United States: a first survey](../research/analyses/2026-11-21-peacemaking-programs.md), section 2.
[^narf-ipi]: Native American Rights Fund, *Indigenous Peacemaking Initiative* (home page), [peacemaking.narf.org](https://peacemaking.narf.org/) (accessed Nov. 20, 2026).
[^lc-tk]: Local Contexts, *TK Notice*, [localcontexts.org/notice/tk-notice](https://localcontexts.org/notice/tk-notice/) (accessed Nov. 20, 2026).
[^usc-107]: 17 U.S.C. § 107, [law.cornell.edu](https://www.law.cornell.edu/uscode/text/17/107).
[^ocap]: First Nations Information Governance Centre, *The First Nations Principles of OCAP®*, [fnigc.ca/ocap-training](https://fnigc.ca/ocap-training/) (accessed Nov. 20, 2026).
