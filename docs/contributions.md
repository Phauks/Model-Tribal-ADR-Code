# Contributions from people

Draft. Not legal advice. The forms in [contributor-forms/](contributor-forms/README.md) are not in use until the lead author approves them.

Most of the project's evidence is published: codes, court rules, cases and articles. Each has a source record. Some material will come from people instead: a peacemaker's account, an interview, a family letter, a photograph. Nothing published stands behind it. So the project keeps its own record of what was given, by whom, on what terms and with whose approval. That record is a **filing** ([decision record 0020](decisions/0020-file-every-contribution-from-a-person.md)). Everything on this page is project design unless a source is cited.

## What needs a filing

| Material | Filing? |
| --- | --- |
| A published source, whoever found it | No. It gets a source record ([data-model.md](data-model.md#permission-statuses)) |
| An interview or recorded conversation | Yes |
| A story or account told or written for the project | Yes |
| An unpublished document, photo or recording someone lends | Yes |
| A nation's request to correct, restrict, remove or add | No. It is a [request](requests.md). Material the nation also contributes gets a filing |
| Review comments in the workspace | No. They are reviews ([site/COLLABORATION.md](../site/COLLABORATION.md)) |
| Chapters by a co-author | Not decided. See [forms not yet drafted](#forms-not-yet-drafted) |

Open the filing when the material arrives or the interview is agreed. Use nothing before then.

## What a filing holds

1. The [contributor statement](contributor-forms/contributor-statement.md), always.
2. Every other form that applies, with the version signed.
3. The items, each with a SHA-256 checksum so a copy can be matched later.
4. A dated log of every step. It names roles, not people, and is never deleted.

Each filing has an id such as `filing-2026-0001`. Its shape is set by [contribution-filing.schema.json](../schemas/contribution-filing.schema.json), with a [fictional example](../schemas/examples/contribution-filing.example.yaml). Filings stay private and never go in git.

### What the public sees

Public records carry the filing id and four other fields, defined in [common.schema.json](../schemas/common.schema.json). Story records use the same ones.

| Field | Holds |
| --- | --- |
| `filing` | The filing id |
| `credit` | Name, name and nation, a description, a pseudonym, or none |
| `permitted_uses` | `background-only`, `reference-only`, `quote` or `publish-in-full`, and where |
| `access` | `public`, `nation-review-first`, `embargoed` with a date, or `restricted` |
| `cultural_authority` | Which office approved use of a community's knowledge, and when |

A source record for an interview carries these in its `contribution` block ([source.schema.json](../schemas/source.schema.json)). Names, contact details, recordings and unapproved transcripts never appear in public.

## Which forms apply

| Form | When | Who signs |
| --- | --- | --- |
| [Contributor statement](contributor-forms/contributor-statement.md) | Always | The contributor, or a guardian |
| [Interview consent](contributor-forms/interview-consent-and-release.md) | Any interview. Part A before recording; Part B after the transcript | The narrator |
| [Nation approval](contributor-forms/cultural-authority-permission.md) | The material may hold a community's knowledge | The office the nation names |
| [Owner's permission](contributor-forms/rights-holder-permission.md) | Someone else made or owns the item, including someone who has died | The owner, estate or family |
| [Consent for minors](contributor-forms/young-contributor-consent.md) | The contributor is not yet an adult | A parent or guardian, and the young person |
| [Change or withdrawal](contributor-forms/change-or-withdrawal-request.md) | Any time | The contributor, guardian, owner or nation |
| [Interviewer agreement](contributor-forms/interviewer-agreement.md) | Anyone but the lead author collects material | The interviewer |

## Steps

1. **Offer.** Someone offers material, or we ask for an interview. Reach a nation's community through its offices first ([charter, commitment 4](charter.md#4-consultation-before-publication)). Status `received`.
2. **Explain.** Before recording or copying anything, walk through the forms and choices in plain words. Give the person copies. The Oral History Association asks interviewers to start by "obtaining and documenting the informed consent of the narrator."[^oha-bp-prep] Status `consent-in-progress`.
3. **Consent.** The narrator signs Part A of the interview form, or agrees on the recording. Everyone present must agree to be recorded. Federal law needs only one party's consent, but "about 11 states primarily have all-party consent requirements."[^rcfp]
4. **Collect.** Record, or receive the items. Store each in the private bucket with its checksum. Keep nothing on personal devices or other cloud drives.
5. **Review.** Send the contributor the transcript or our description of the items. The OHA gives narrators "the opportunity to review and approve the interview" and "the right to delete, restrict, and/or redact portions."[^oha-ethics-review] Status `in-review`.
6. **Release.** The contributor signs the statement and Part B after review. The OHA advises getting the release "ideally when the interview is completed."[^oha-bp-release]
7. **Other permissions.** Ask the nation if the material may hold a community's knowledge. Ask the owner if it isn't the contributor's. Use nothing flagged until the answer is yes.
8. **Accept.** The lead author checks that every form is present, that the permissions agree, and that the log is complete. Where they differ, the stricter one wins. Status `accepted`, or `held` during an embargo or nation review.
9. **Use.** Records cite the filing and copy the public fields. The build already refuses quotations the rights don't allow ([data-model.md](data-model.md#permission-statuses)).
10. **After.** The contributor can still change or withdraw it ([below](#changes-and-withdrawal)). We send them any quotation before release, as the OHA suggests: approval "prior to public release."[^oha-bp-prep]

**Statuses:** `received`, `consent-in-progress`, `in-review`, then `accepted` or `held`. At any point a filing can become `withdrawn`, `declined` (with reasons sent to the contributor) or `returned` (originals sent back or destroyed).

## The contributor's choices

- **Credit.** Name; name and nation; a description such as "a peacemaker of the nation"; a pseudonym; or none. The form warns that a detailed story can identify its teller anyway, and offers to cut details.
- **Use.** Background only; describe but don't quote; quote parts; or publish in full. Then where: website, book, ebook, offline copy, public data.
- **Access.** Public; after the nation reviews it; not before a date; or never. The OHA counts the right "to restrict access to the interview" as part of informed consent.[^oha-bp-restrict]
- **Copyright.** The contributor keeps it. By default they give the project a nonexclusive permission. They may add an open license (CC BY 4.0 or CC BY-NC 4.0) so others can reuse it too. The Library of Congress Veterans History Project works the same way: its release grants a "perpetual, nonexclusive, transferable, worldwide right to use," and the veteran "retain[s] any copyright."[^vhp] Some oral history programs ask for the copyright itself.[^oha-participants-copyright] We don't.
- **Originals.** Keep copies, return the originals, or delete copies after publication.

A nonexclusive license isn't a "transfer of copyright ownership"[^usc-101] and so doesn't need the signed writing a transfer does.[^usc-204] We get a signature anyway, as proof (project analysis, not legal advice).

## Signatures

Any form can be signed three ways. The filing records which.

- **Ink**, scanned afterward.
- **Electronic.** The person types their name and ticks a box. Federal law says a signature "may not be denied legal effect, validity, or enforceability solely because it is in electronic form."[^esign]
- **Aloud.** We read the form at the start of a recording, and the person agrees. This suits someone who would rather not sign papers or doesn't read English. The recording is the proof.

The signer always gets a copy.

## A community's knowledge

The charter bars ceremonial, restricted or community-held knowledge without the community's written approval ([commitment 5](charter.md#5-cultural-knowledge-and-restricted-material)). One person can't approve it alone. NCAI's research guidance says "you cannot conduct research with a Tribal Nation without their approval."[^ncai-faq] It adds that "you need approval of the Tribal Nation for any use of that data beyond the original approval."[^ncai-faq] The Society of American Archivists endorsed the *Protocols for Native American Archival Materials* in August 2018.[^saa]

The contributor statement asks about such knowledge, and we ask too. If either answer is yes or unsure, the filing waits for [Nation approval](contributor-forms/cultural-authority-permission.md). Local Contexts Labels are "tools for Indigenous communities and local organizations,"[^lc-labels] and only a community applies them. We show and follow any a community applies ([data-model.md](data-model.md#sensitivity-flags)).

## Other people in the story

Dispute stories name people: relatives, the other side, a judge, a peacemaker. The statement asks who is named. We remove or blur details that identify living private people who haven't agreed, unless the detail is already public and needed.

Some nations make peacemaking or mediation sessions confidential. In the project's reading of tribal codes, 100 of 2,127 passages record a confidentiality rule ([provisions.csv](../research/tribal-law/provisions.csv), column `confidentiality`; our count, not reviewed). If a contributor took part in such a session, we ask whether it is confidential. If so, we use it only as background.

## Minors

Young people see how families settle disputes. We take their contributions only with a parent's or guardian's consent and the young person's own agreement ([Consent for minors](contributor-forms/young-contributor-consent.md)). Either can withdraw. State law sets the age of adulthood, and a nation's law may too, so the form asks instead of assuming 18. The website takes nothing from children under 13, the age that federal rules on children's data use.[^coppa] We credit minors only by description or pseudonym.

## Changes and withdrawal

A contributor can ask at any time to fix, cut, restrict, delay or withdraw their material ([Change or withdrawal](contributor-forms/change-or-withdrawal-request.md)), or just tell us. The OHA tells narrators they "can restrict an interview from the public, make changes before it is shared, or withdraw." It also warns that once shared "it may not be possible to fully remove it."[^oha-participants] We follow the charter's rules for nations ([commitment 6](charter.md#6-the-right-to-correct-restrict-or-withdraw)):

- We hide the material within 7 days, then review.
- Withdrawn material leaves the website, downloads and offline copies in the next release. Restricted material also leaves the repository's history.
- Books already sold can't be recalled. The next printing leaves it out.
- We ask web archives to remove their copies.

The forms say all this before anyone signs.

## Storage

- **Where.** Filings go in the website's private database. Items and signed forms go in the private file bucket under `filings/<filing id>/`. No public page or API serves either ([decision record 0009](decisions/0009-private-requests-from-nations.md)). Contact details sit in a separate table, so a filing can be shared without them.
- **Who.** The lead author and editors. A nation reviewer sees a filing only when it is sent for review, without contact details.
- **How long.** As long as anything citing it is published, since the filing is the proof of permission. Request details, by contrast, go after 12 months ([requests.md](requests.md#how-it-is-built)). Once nothing cites a filing, its contact details go after 12 months, and the items are returned or destroyed as the contributor chose.
- **Forms sent through the website** are in the database and the private bucket (see [On the website](#on-the-website)). Recordings, transcripts and other items still go in the private project folder until the workspace can store them. Never put them in git or a public issue.

## Ethics review

**The lead author's view (Nov. 21, 2026).** UNLV's human subjects rules are aimed at biomedical and scientific study, not cultural or legal work. The project will not seek review by an institutional review board (IRB). Federal rules also exclude "oral history, journalism, biography, literary criticism, legal research, and historical scholarship" that "focus directly on the specific individuals about whom the information is collected."[^cfr-46]

**For the record (project analysis).** UNLV's procedure says research "includes, but is not limited to, surveys and interviews."[^unlv-sop] Its rules say "researchers must contact the ORI-HS for assistance prior to conducting any project activities," and that the office decides whether review is needed.[^unlv-rules] The procedure puts the duty to ask on the investigator.[^unlv-sop] If someone later asks whether the project was reviewed, a short letter from that office would settle it. Getting one is optional.

**Nations' rules still apply.** NCAI says "tribal nations can establish their own IRBs, but they all have the right to tribal approval of research." It adds that "many Tribal Nations do not have an exempt category."[^ncai-faq] The Navajo Nation, for one, has a Human Research Review Board under its Human Research Code, 13 N.N.C. §§ 3251–3271.[^nnhrrb] Before an interview within a nation or about its practices, check for a research code or board and follow it. Note the check in the filing log.

## Forms not yet drafted

- **Co-author agreement:** credit, license (CC BY 4.0 for commentary and essays, [LICENSE.md](../LICENSE.md)), review and withdrawal.
- **Artist agreement:** the charter requires one ([commitment 7](charter.md#7-credit-authorship-and-art)).
- **Research agreement with a nation,** when a nation asks. Its own template wins.
- **Translations** of each form, once contributors ask for a language.

## On the website

Built in 2026 (site/COLLABORATION.md, "Forms"). The website's Forms page (`/forms`) lists every form in [contributor-forms/](contributor-forms/README.md), and later the model forms in `content/forms/`. Each form is one Markdown file, shown three ways from the same text:

- **Online** (`/forms/<form>`). Every ☐ is a tick box and every blank a field. The person types their name in a signature line and ticks "The name I typed in the signature line is my signature" (the electronic signature above). The "Project use" lines are left for us.
- **To print** (`/forms/<form>/print`). A blank copy to sign in ink.
- **Signed paper copy.** The form's page takes a photo or scan of each page (PDF, PNG, JPEG or WebP, up to 10 MB each).

Each form sent opens a request in the workspace (a "Change or withdrawal" opens a request to restrict, so the material is hidden first). The database records which form, its version, the SHA-256 of its file, how it was signed, the typed name and the answers. A form signed online is also kept, filled in, as a Markdown file in the private bucket under `forms/`, so the exact words signed survive later versions. The person sees their filled copy at once and can print it. An editor reads the form in the workspace and gives it a filing number (`filing-YYYY-NNNN`), new or existing. A request that came with a form keeps its contact details after it is resolved, because the form is the proof of permission.

A model form is only filled in and printed. Nothing typed into one is sent.

**Still to build:** a filings list in the workspace with missing forms and statuses, emailing the signer their copy (waits on a domain), and the lint rule that an `interview` source needs a `contribution` block.

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
