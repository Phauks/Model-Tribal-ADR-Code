# Contributions from people

**Status:** draft for review by the lead author and the project's advisors.
Nothing here is legal advice. The forms it names are drafts in
[contributor-forms/](contributor-forms/README.md); none may be used with a
contributor until the lead author approves it and the
[ethics review question](#ethics-review-must-be-settled-first) below is
answered.

Most of the project's evidence is published: codes, court rules, cases,
articles, web pages. Each of those has a source record that cites it. Some
material will instead come from a person: a peacemaker's account of how a
circle works, an interview, a family's written story, a document someone
lends, a photograph. Nothing published stands behind that material, so the
project needs its own record of what was given, by whom, on what terms, and
with whose approval. This page specifies that record, called a **filing**, and
the forms that go into it. Everything here is project design unless a source
is cited ([decision record 0019](decisions/0019-file-every-contribution-from-a-person.md)).

## What needs a filing

| Material | Filing? | Why |
| --- | --- | --- |
| A published source the project found (code, case, article, web page, published story) | No | Cited through its source record and `rights` block ([data-model.md](data-model.md#permission-statuses)) |
| A published source someone points the project to | No | Same; the person may be thanked in the research session |
| An interview or conversation recorded or noted for the project | Yes | Nothing published records the person's consent |
| A story, account or reflection written or told for the project | Yes | Same |
| An unpublished document, photograph or recording someone lends or sends | Yes | The project needs to know who holds rights and what the lender allows |
| A nation's request to correct, restrict, remove or add | No; a request ([requests.md](requests.md)) | Already handled by the request flow. A nation's office that also *contributes* material gets a filing for it |
| Review comments from a nation reviewer, advisor or co-author in the workspace | No | Recorded as reviews in the workspace ([site/COLLABORATION.md](../site/COLLABORATION.md)) |
| Writing by a co-author for the book | Not yet decided | A co-author agreement is a separate document (see [forms not drafted here](#forms-not-drafted-here)) |

A filing is opened the moment such material arrives or an interview is
agreed, before anything is used.

## The filing

A filing is one package, kept privately, never in git:

1. **The contributor statement**, always. It is the cover sheet: what is
   provided, who made it, who holds rights, who and what it is about, what the
   contributor allows, how they want credit, and their signature
   ([form](contributor-forms/contributor-statement.md)).
2. **Every other signed form** that applies (table below), each with the
   version of the wording that was signed.
3. **The items themselves**: recordings, transcripts, documents, images, each
   stored with a SHA-256 checksum so a later copy can be shown to match.
4. **The log**: every step, dated, naming roles not private details, never
   deleted.

The shape of a filing is fixed by
[schemas/contribution-filing.schema.json](../schemas/contribution-filing.schema.json),
with a fictional example in
[schemas/examples/](../schemas/examples/contribution-filing.example.yaml).
Each filing has an id such as `filing-2026-0001`.

### What reaches the public record

Only the filing id and five public-safe fields, defined once in
[common.schema.json](../schemas/common.schema.json) and shared with story
records:

| Field | Holds |
| --- | --- |
| `filing` | The filing id, so anyone on the project can find the signed forms |
| `credit` | How the contributor chose to be credited: by name, by name and nation, by role only, by a pseudonym, or not at all |
| `permitted_uses` | `background-only`, `reference-only`, `quote` or `publish-in-full`, and where: web, print, ebook, offline pack, API |
| `access` | `public`, `nation-review-first`, `embargoed` (with a date) or `restricted` |
| `cultural_authority` | Which office or role approved the use of community-held knowledge, for which nation, and when |

A source record for an interview carries them in its `contribution` block
([source.schema.json](../schemas/source.schema.json)). Names, contact
details, recordings and unapproved transcripts never appear in a public
record.

## Which forms apply

| Form | When | Signed by |
| --- | --- | --- |
| [Contributor statement](contributor-forms/contributor-statement.md) | Every filing | The contributor (or guardian) |
| [Interview consent and release](contributor-forms/interview-consent-and-release.md) | Any interview or recorded conversation: Part A before recording, Part B after the narrator reviews the transcript | The narrator |
| [Cultural authority permission](contributor-forms/cultural-authority-permission.md) | The material may hold ceremonial, restricted or community-held knowledge, or the contributor says it belongs to a community | The nation's designated office or the authority the nation names |
| [Rights holder permission](contributor-forms/rights-holder-permission.md) | Someone other than the contributor made the item or holds rights in it, including a person who has died | The rights holder, estate or family representative |
| [Parent or guardian consent and young person's assent](contributor-forms/young-contributor-consent.md) | The contributor is under the age of majority where they live | A parent or legal guardian, and the young person |
| [Change, restriction or withdrawal request](contributor-forms/change-or-withdrawal-request.md) | Any time after filing | The contributor, guardian, rights holder or the nation's office |
| [Interviewer agreement](contributor-forms/interviewer-agreement.md) | Anyone other than the lead author who interviews or collects for the project | The interviewer |

## The flow

1. **Offer.** Someone offers material, or the project asks a person for an
   interview. Contact with a nation's community goes through the nation's own
   offices first ([charter, commitment 4](charter.md#4-consultation-before-publication)).
   Open a filing with status `received`.
2. **Explain.** Before anything is recorded or copied, explain the project, the
   forms and the choices, in plain language and in the person's preferred
   language where the project can arrange it. Give them a copy of every form
   to keep. Status `consent-in-progress`. The Oral History Association asks
   interviewers to begin by "obtaining and documenting the informed consent of
   the narrator."[^oha-bp-prep]
3. **Consent before recording.** Interview consent, Part A, is signed or
   recorded at the start. Recording also needs the consent of everyone
   recorded, which this form gets in every case: federal law needs one party's
   consent, but "about 11 states primarily have all-party consent
   requirements."[^rcfp]
4. **Collect.** Record the interview, or receive the items. Store each item in
   the private bucket with its checksum. Do not copy items to personal
   devices or cloud drives outside the project's storage (project rule).
5. **Review by the contributor.** Send the transcript or the project's
   description of the items to the contributor. The OHA describes giving the
   narrator "the opportunity to review and approve the interview" and "the
   right to delete, restrict, and/or redact portions."[^oha-ethics-review]
   Status `in-review`.
6. **Release.** The contributor statement and interview release (Part B) are
   signed after review. The OHA recommends securing the legal release
   "ideally when the interview is completed."[^oha-bp-release]
7. **Other permissions.** If the contributor statement flags community-held
   knowledge, ask for cultural authority permission. If someone else holds
   rights, ask them. Nothing flagged is used until the answer is yes.
8. **Accept.** The lead author checks that every required form is present, the
   permissions agree with each other (the narrowest one wins), and the log is
   complete. Status `accepted`, or `held` while an embargo or nation review
   runs.
9. **Use.** Records cite the filing and copy the five public-safe fields. A
   quotation never exceeds `permitted_uses.level`; the build already refuses
   quotations a source's rights do not allow ([data-model.md](data-model.md#permission-statuses)).
10. **Ongoing.** The contributor keeps the right to change, restrict or
    withdraw ([below](#change-restriction-and-withdrawal)). The project sends
    them the published text before release where it quotes them (project
    choice, following the OHA's call for narrator approval "prior to public
    release").[^oha-bp-prep]

### Statuses

`received` → `consent-in-progress` → `in-review` → `accepted` or `held`;
at any point `withdrawn`, `declined` (with reasons given to the contributor) or
`returned` (originals sent back or destroyed at the contributor's request).

## Choices the contributor makes

- **Credit.** By name; by name and nation; by role only ("a peacemaker of the
  nation"); by a pseudonym; or not at all. The form warns that a story with
  enough detail can identify its teller even without a name, and offers to
  remove identifying details (project analysis).
- **Use.** `background-only` (informs the work; never named, described or
  quoted), `reference-only` (described or paraphrased with credit, never
  quoted), `quote` (excerpts), or `publish-in-full`; and in which formats.
- **Access.** Public; held for the nation's review first; embargoed until a
  date the contributor chooses; or restricted (kept privately, never
  published). The OHA treats the narrator's right "to restrict access to the
  interview" as part of informed consent.[^oha-bp-restrict]
- **License.** The contributor keeps their copyright in every case. They
  choose either a nonexclusive permission to the project only, or an open
  license (CC BY 4.0 or CC BY-NC 4.0) so others may reuse it too. The
  default is permission to the project only. This follows the Library of
  Congress Veterans History Project, whose release grants a "perpetual,
  nonexclusive, transferable, worldwide right to use" while the veteran
  "retain[s] any copyright,"[^vhp] rather than the copyright assignment that
  some oral history programs ask for.[^oha-participants-copyright] A
  nonexclusive license is not a "transfer of copyright ownership" under the
  Copyright Act,[^usc-101] so it does not need the signed writing a transfer
  requires;[^usc-204] the project gets a signature anyway, as evidence (project
  analysis, not legal advice).
- **Originals.** Keep, return, or destroy the project's copies once used.
- **Contact.** Whether the project may contact them again, and how.

## Signatures

Any of three methods is valid for every form, and the filing records which
was used:

- **Ink**, on paper, then scanned.
- **Electronic**: typing one's name and ticking a box on the website. Under
  federal law a signature "may not be denied legal effect, validity, or
  enforceability solely because it is in electronic form."[^esign]
- **Recorded verbal**: the form is read aloud at the start of a recording and
  the person says they agree. This suits a person who prefers not to sign
  papers or who does not read English, and the recording is kept as evidence
  (project choice).

The project always gives the signer a copy, in the form they prefer.

## Community-held knowledge

The charter does not let ceremonial, restricted or community-held knowledge in
without the community's written approval
([commitment 5](charter.md#5-cultural-knowledge-and-restricted-material)).
One person's consent is not enough for knowledge that belongs to a community:
under research guidance from the National Congress of American Indians,
"you cannot conduct research with a Tribal Nation without their approval," and
"you need approval of the Tribal Nation for any use of that data beyond the
original approval."[^ncai-faq] The Society of American Archivists endorsed the
*Protocols for Native American Archival Materials* in August 2018 as a guide to
"culturally responsive care of Native American archival materials."[^saa]

So the contributor statement asks whether the material holds such knowledge,
and the project asks too. If either says yes or is unsure, the filing waits for
a [cultural authority permission](contributor-forms/cultural-authority-permission.md)
from the office the nation designates. If a community applies Local Contexts
Labels, which are "tools for Indigenous communities and local organizations"
that "communities can customize and apply,"[^lc-labels] the project displays
them and follows them; it never applies a Label itself
([data-model.md](data-model.md#sensitivity-flags)).

## People named in the material

Stories about disputes name other people: family members, the other party, a
judge, a peacemaker. The contributor statement asks who is named. Before any
use, the project removes or generalizes identifying details of living private
people who have not agreed to be named, unless the detail is already public
and necessary (project rule). Some nations' laws make peacemaking or
mediation sessions confidential: 100 of the 2,127 passages in the project's
reading of tribal codes record a confidentiality term
([research/tribal-law/provisions.csv](../research/tribal-law/provisions.csv),
column `confidentiality`; count by the project, not reviewed). A
contributor who took part in such a session is asked whether its content is
confidential under the nation's law, and if so it is used only as background.

## Contributors under the age of majority

Young people may be important witnesses to how families and communities settle
disputes. The project accepts their contributions only with a parent's or legal
guardian's consent and the young person's own agreement (assent), on the
[combined form](contributor-forms/young-contributor-consent.md); either can
withdraw. The age of majority is set by state and, for its citizens, by the
nation's own law, so the form asks rather than assuming 18 (project
analysis). The website itself will not take a submission from a child under
13, the age below which federal rules on collecting children's information
online apply.[^coppa] Young contributors are credited only by role or
pseudonym, never by name, until they are adults and choose otherwise (project
choice).

## Change, restriction and withdrawal

A contributor may at any time ask the project to correct, redact, restrict,
extend an embargo on, or withdraw their contribution, using the
[request form](contributor-forms/change-or-withdrawal-request.md) or by
telling the project in any way. The OHA tells narrators they "can restrict an
interview from the public, make changes before it is shared, or withdraw," and
also that once shared "it may not be possible to fully remove it."[^oha-participants]
The project's commitments follow the charter's for nations
([commitment 6](charter.md#6-the-right-to-correct-restrict-or-withdraw)):

- restrict first, review second: the material is hidden within 7 days;
- withdrawn material leaves the website, downloads and offline packs in the
  next release, and from the repository's history if it was restricted;
- printed copies already sold cannot be recalled; the next printing omits it;
- archive services are asked to remove copies where they allow it.

The forms say all of this before anyone signs, so nobody is promised more than
the project can do.

## Storage and retention

- **Where.** Filings in the website's private database; items and signed forms
  in the private file bucket, under `filings/<filing id>/`. Neither is served
  by any public route or API ([decision record 0009](decisions/0009-private-requests-from-nations.md)).
  Names and contact details sit in a separate contacts table, linked by an
  opaque id, so a filing can be shown to an advisor without them.
- **Who.** The lead author and editors. Advisors and nation reviewers see a
  filing only when it is sent to them for review, without contact details.
- **How long.** Unlike request details, which are deleted 12 months after
  resolution ([requests.md](requests.md#how-it-is-built)), a filing is kept
  while anything that cites it is published, because it is the proof of
  permission. When the last citing record is withdrawn, contact details are
  deleted after 12 months and items are returned or destroyed as the
  contributor chose (project choice).
- **Until the website stores filings,** keep them in the private project
  folder, never in git or a public issue, and log each step in the filing
  file itself.

## Ethics review must be settled first

The lead author's earlier expectation was that no institutional review board
(IRB) review would be needed. Before any interview, that should be confirmed,
not assumed, for two reasons (project analysis):

1. **The university.** Federal rules exclude from "research" "scholarly and
   journalistic activities (e.g., oral history, journalism, biography,
   literary criticism, legal research, and historical scholarship), that focus
   directly on the specific individuals about whom the information is
   collected."[^cfr-46] Whether interviews about a nation's dispute resolution
   *practices*, rather than about the individuals, fit that exclusion is a
   judgment call. UNLV's rules say "researchers must contact the ORI-HS for
   assistance prior to conducting any project activities" and that "the ORI-HS
   has the authority to determine the need for IRB review";[^unlv-rules] its
   procedure makes it "the responsibility of each PI to seek IRB/ORI-HS review
   and approval/acknowledgment."[^unlv-sop] Whether these rules reach a
   student's personal project that is not for credit is itself a question for
   that office. **Action for the lead author:** ask UNLV's Office of Research
   Integrity, Human Subjects, for a written determination, and record it in a
   research session.
2. **The nations.** Some nations regulate research themselves, whatever a
   university decides. NCAI advises that "tribal nations can establish their
   own IRBs, but they all have the right to tribal approval of research," and
   that "many Tribal Nations do not have an exempt category."[^ncai-faq] The
   Navajo Nation, for example, has a Human Research Review Board under the
   Navajo Nation Human Research Code, 13 N.N.C. §§ 3251–3271.[^nnhrrb]
   **Rule:** before interviewing within a nation, or about a nation's
   practices, check whether the nation has a research code or review board,
   and follow it. Record the check in the filing log.

## Forms not drafted here

These came up while drafting and are left for later (project analysis):

- **Co-author agreement** for people who write chapters or commentary:
  credit, license (CC BY 4.0 for commentary and essays, [LICENSE.md](../LICENSE.md)),
  review and withdrawal.
- **Artist agreement** for cover and interior art; the charter already
  requires one ([commitment 7](charter.md#7-credit-authorship-and-art)).
- **Research agreement with a nation** when a nation asks for one; the nation's
  own template wins.
- **Advisor and reviewer acknowledgment**, if advisors want their role
  described in writing.
- **Translations** of every form, once the project knows which languages
  contributors ask for.

## How it would be built (proposal)

Not built yet. It fits the website's existing request system
([site/COLLABORATION.md](../site/COLLABORATION.md)), and needs Trevor's
go-ahead before work starts:

- **Database migration** adding `filings`, `filing_items`, `filing_forms`
  and `contacts` tables, following the schema above, and extending the
  `events` table's `target_kind` to `filing`.
- **The "Contribute" choice** on the request form opens a contributor
  statement instead of the short credit step, and creates a filing with status
  `received`.
- **Electronic signature:** the form's full text and version are shown,
  the person types their name and ticks "I agree", and the site stores the
  exact rendered text, its version, the date and time, and a checksum of the
  signed copy in the file bucket.
- **Workspace page** `/workspace/filings` for editors: filings by status, the
  forms present and missing, the log, and a button to export a filing in the
  schema's format.
- **Forms as pages:** each form in `docs/contributor-forms/` rendered to a
  printable page and a PDF from the same text, so paper and website say the
  same thing at the same version.
- **Lint rule:** any source record with `kind: interview` must carry a
  `contribution` block; any record with `access.level: restricted` is never
  built into public output.

## References

[^oha-bp-prep]: Oral History Association, *Oral History Best Practices*, in *Principles and Best Practices for Oral History*, Preparation ¶ 3, at 2 (adopted Oct. 2018), [oralhistory.org](https://oralhistory.org/wp-content/uploads/2025/12/2025-OHA-PrinciplesBP_Best-Practices.pdf) (accessed Nov. 21, 2026).
[^oha-bp-release]: *Id.*, Interviewing ¶ 5, at 5.
[^oha-bp-restrict]: *Id.*, Interviewing ¶ 4(a), at 5.
[^oha-ethics-review]: Oral History Association, *OHA Statement on Ethics*, in *Principles and Best Practices for Oral History* 3–4 (adopted Oct. 2018), [oralhistory.org](https://oralhistory.org/wp-content/uploads/2025/12/2025-OHA-PrinciplesBP_Statement-on-Ethics.pdf) (accessed Nov. 21, 2026).
[^oha-participants]: Oral History Association, *For Participants in Oral History Interviews*, in *Principles and Best Practices for Oral History* ¶ 9, at 4–5 (adopted Oct. 2018), [oralhistory.org](https://oralhistory.org/wp-content/uploads/2025/12/2025-OHA-PrinciplesBP_For-Participants-in-OH-Interviews.pdf) (accessed Nov. 21, 2026).
[^oha-participants-copyright]: *Id.* ¶ 11, at 5 ("you might also be asked to assign your copyright of the interview to the oral historian or to an archive").
[^rcfp]: Reporters Committee for Freedom of the Press, *Introduction to the Reporter's Recording Guide*, [rcfp.org](https://www.rcfp.org/introduction-to-reporters-recording-guide/) (accessed Nov. 21, 2026); see 18 U.S.C. § 2511(2)(d).
[^vhp]: Library of Congress, Veterans History Project, *Veteran's Release Form*, [loc.gov](https://www.loc.gov/static/programs/veterans-history-project/documents/vhp-field-kit-veterans-release.pdf) (accessed Nov. 21, 2026).
[^usc-101]: 17 U.S.C. § 101 (definition of "transfer of copyright ownership," excluding "a nonexclusive license"), [law.cornell.edu](https://www.law.cornell.edu/uscode/text/17/101).
[^usc-204]: 17 U.S.C. § 204(a), [law.cornell.edu](https://www.law.cornell.edu/uscode/text/17/204).
[^esign]: 15 U.S.C. § 7001(a)(1), [law.cornell.edu](https://www.law.cornell.edu/uscode/text/15/7001).
[^ncai-faq]: NCAI Policy Research Center, *Frequently Asked Questions: Partnering with Tribal Nations on Research*, Q3, Q5, Q7, Q17 (Nov. 12, 2021), [hosted by the Native Nations Institute](https://nnigovernance.arizona.edu/sites/default/files/2025-07/NCAI-PRC-FAQs-Partnering-with-Tribal-Nations-on-Research-11-12-2021-FINAL.pdf) (accessed Nov. 21, 2026).
[^saa]: Society of American Archivists, *Protocols for Native American Archival Materials* (Council endorsement Aug. 2018), [archivists.org](https://www2.archivists.org/standards/protocols-for-native-american-archival-materials) (accessed Nov. 21, 2026).
[^lc-labels]: Local Contexts, *Labels*, [localcontexts.org](https://localcontexts.org/labels/about-the-labels/) (accessed Nov. 21, 2026).
[^coppa]: 16 C.F.R. § 312.2 ("Child means an individual under the age of 13"), [ecfr.gov](https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-312/section-312.2); see 15 U.S.C. §§ 6501–6506.
[^cfr-46]: 45 C.F.R. § 46.102(l)(1), [ecfr.gov](https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-A/part-46/subpart-A/section-46.102).
[^unlv-rules]: Univ. of Nev., Las Vegas, Office of Research Integrity, *Rules and Procedures for Conducting Human Subjects Research*, [unlv.edu](https://www.unlv.edu/policies/rules-and-procedures-conducting-human-subjects-research) (accessed Nov. 21, 2026). The page shows conflicting issue and revision dates; confirm the current version with the office.
[^unlv-sop]: Univ. of Nev., Las Vegas, Office of Research Integrity – Human Subjects, *SOP 5.02: Determination of Activities that Require IRB Review*, Procedures ¶ 1, at 2 (rev. May 10, 2017), [unlv.edu](https://www.unlv.edu/sites/default/files/media/document/2023-06/508-ActivitiesThatRequireReview-SOP.pdf).
[^nnhrrb]: Navajo Nation Human Research Review Board, *Board Members* (listing "Chapter 25. Navajo Nation Human Research Code (section §3251 – §3271)"), [nnhrrb.navajo-nsn.gov](https://nnhrrb.navajo-nsn.gov/board-members.html) (accessed Nov. 21, 2026). The Code's text was not read for this page.
