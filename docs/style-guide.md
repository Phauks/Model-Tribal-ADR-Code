# Style guide

This guide sets the tone and writing standards for everything the project
publishes: provisions, commentary, essays, the website and project documents.
Its aim is a professional, clean and consistent voice across many contributors
and editions. Word choice is governed by the project dictionary; see
[terminology.md](terminology.md) and the entries in
[`content/glossary/`](../content/glossary/). Citation form is governed by
[citation-style.md](citation-style.md).

Where a rule rests on a published source, a footnote cites it. Where it is the
project's own choice, it says so.

## 1. Voice and tone

- **Professional and measured.** Write as a careful legal reference: precise,
  calm and specific. Avoid praise, alarm, slogans and rhetorical questions
  (project choice).
- **Descriptive, not ranking.** Describe what a nation's published law or
  practice provides. Do not rank nations' systems or present one nation's
  practice as the standard for others
  ([charter, commitment 2](charter.md#2-respect-for-each-nations-own-institutions)).
- **Not an Indigenous voice.** The project presents published practice and
  credits Indigenous sources; it does not speak for any nation
  ([charter, commitment 10](charter.md#10-positionality-and-transparency)).
  Write "the Navajo Nation's code provides" rather than "Navajo people
  believe."
- **Not legal advice.** Model provisions and commentary are options for a
  nation's own law-making process. Avoid "should" when addressing a nation;
  prefer "a nation may" or "Alternative A suits a nation that" (project
  choice).
- **Source and analysis kept apart.** Say what a source says, then label the
  project's own view, for example "(project analysis)" or "in the project's
  view" ([citation-style.md](citation-style.md#rules-the-project-adds)).

## 2. Plain language

The project follows the federal plain language guidance as a model, though it
does not bind the project.[^plain]

- "The first rule of plain language is: write for your audience."[^plain] The audience is Tribal lawmakers, judges,
  peacemakers, court staff, advocates and students, not only lawyers.
- "Express only one idea in each sentence."[^plain-short]
- Keep paragraphs short. The federal guide reports that "writing experts
  recommend paragraphs of no more than 150 words in three to eight
  sentences."[^plain-short]
- Use the active voice: it "makes it clear who should do what."[^plain-writing]
  Write "The peacemaker must give notice," not "Notice must be given."
- Avoid jargon. "When you have no way to express an idea except to use
  technical language, make sure to define your terms,"[^plain-jargon] which in
  this project means linking the term to its glossary entry.

## 3. Writing about Native nations and people

- **Use the dictionary.** Use the preferred terms in
  [terminology.md](terminology.md), and link the first use of each defined
  term with `[[id]]`.
- **Name the nation.** Use a nation's own name, as it writes it, whenever one
  nation is meant. Use collective terms only for several nations.
- **Present tense for living nations and practices.** "Only using the past
  tense reinforces the myth of the 'Vanishing Indian.'"[^nmai] Use the past
  tense for historical events, with dates.
- **No generalizations.** "Avoid generalization,"[^nmai] such as "all Native
  Americans" or "Native cultures value." Say which nation, which source and
  which time.
- **No possessive framing.** Write "Native nations in Nevada," not "Nevada's
  Native nations."[^ngc-guide]
- **Do not conflate** a nation with its reservation or its businesses: "Don't
  conflate Native nations with reservations or casinos."[^ngc-guide]
- **No stereotypes or borrowed sacred terms.** Avoid stock phrases the
  Smithsonian lists as stereotypes, such as "Indian Princess," "Low man on the
  totem pole" and "sitting Indian style."[^nmai]
- **Restricted knowledge stays out.** Do not describe ceremonial, restricted
  or community-held knowledge without the community's written approval
  ([charter, commitment 5](charter.md#5-cultural-knowledge-and-restricted-material)).
- **Diacritics and spelling.** Reproduce names and words in Native languages
  exactly as the nation writes them, including diacritics such as the ʻokina
  in Hawaiʻi (project choice).

## 4. Model provisions

The rules below are the project's drafting conventions (project choice),
chosen for clarity and consistency in text a nation may enact.

- **Duties and permissions.** Use "must" for a duty, "must not" for a
  prohibition, and "may" for a permission or discretion. Do not use "shall."
- **Who acts.** Name the actor in every operative sentence: the court, the
  peacemaker, a party, or the council written as `{{nation.council}}`.
- **Nation-specific words** are template variables such as `{{nation.name}}`,
  never a real nation's name ([data-model.md](data-model.md#built-for-templates)).
- **Alternatives** are lettered (Alternative A, Alternative B) and each must
  work on its own when the others are deleted.
- **Definitions inside a provision** apply only to that provision's chapter and
  are written "In this chapter, 'party' means ...". Project-wide terms belong
  in the glossary instead.
- **Numbering** follows [repository-layout.md](repository-layout.md#identifiers).
  Never renumber a published section; insert § 2-104A.

## 5. Commentary, illustrations and essays

- **Commentary** follows the Restatement pattern: Comment, Illustrations,
  Source Note.
- **Illustrations** use fictitious parties and a fictitious nation unless a
  nation has approved its use as an example
  ([charter, commitment 4](charter.md#4-consultation-before-publication)).
  Label them "Illustration 1," and so on.
- **Source Notes** cite every Tribal law, case, statute and secondary source
  the comment relies on, by `[@key]`.
- **Essays** may use a more discursive voice, but the same terminology,
  citation and labeling rules apply.

## 6. Mechanics

| Topic | Rule | Basis |
| --- | --- | --- |
| Spelling | American English | Project choice |
| Lists in a sentence | Use the serial comma: "negotiation, mediation, and arbitration" | Project choice, to avoid ambiguity in legal text. Existing project documents will be brought into line in a later pass |
| Headings | Sentence case | Project choice |
| Dashes | Prefer commas, colons, parentheses or a new sentence over dashes | Project choice |
| Section sign | "§ 2-104", "§§ 2-104 to 2-106", with a non-breaking space after the sign | Project choice |
| Dates | "Nov. 20, 2026" in text and citations; YYYY-MM-DD in data files | Citation style; data model |
| Numbers | Words for one to nine, numerals for 10 and above, numerals always for sections, dates, money and percentages | Project choice |
| People | "They" for a person whose pronouns are unknown or for an unspecified person | Project choice |
| Capitalization | As set in each glossary entry (for example Native, Indigenous, Tribal; lowercase sovereignty) | [terminology.md](terminology.md) |
| Links | Descriptive link text, never "click here" | Project choice |
| Acronyms | Allowed for named things (NARF, ISBN); link the first use in each piece to its glossary entry so the build writes it out | [terminology.md](terminology.md) |

## 7. Files, encoding and code

These rules apply to every file in the repository, not only to published text.

- **Encoding.** Every text file is UTF-8 without a byte order mark, in Unicode
  Normalization Form C (NFC), with LF line endings and a final newline. The
  same visible letter, such as an accented or diacritic letter in a Native
  language name, can be stored as different sequences of code points;
  normalizing to one form makes searching, sorting, linking and comparing text
  reliable.[^uax15] The `Text encoding` check
  ([scripts/check_text.py](../scripts/check_text.py)) enforces this on every
  pull request, and [.editorconfig](../.editorconfig) sets it in most editors.
- **Never hard-wrap text.** A paragraph, list item, footnote, quotation, code comment or piece of page text is one line, however long; editors, GitHub and browsers wrap it to fit the reader's screen (Trevor's rule, Nov. 22, 2026). Breaking lines by hand at 80 or 100 characters splits sentences in the source, and every later edit reflows the whole paragraph in the diff. A deliberate line break, such as in an address, ends the line with two spaces or a backslash. The `Text encoding` job runs [scripts/check_wrapping.py](../scripts/check_wrapping.py), which refuses Markdown paragraphs that a pull request wraps; files wrapped before the rule will be unwrapped in one pass.
- **The ʻokina** is written with the letter U+02BB (ʻ), not an apostrophe or
  quotation mark (project choice).
- **Names in code are spelled out.** Variables, functions, files, schema
  fields and other identifiers use whole words: `organizationName`, not
  `orgNm`; `configuration`, not `cfg`; `index`, not `i` (project rule).
- **Acronyms that name things are fine**, in code and in prose, such as URL,
  PDF, HTML, R2 or NARF. In code, write them as ordinary words in the case
  style of the name around them: `sourceUrl`, `pdfPath`.
- **External names stay as defined.** Names that come from a library, a
  standard or a service keep their own spelling, such as the `URL` field in
  Citation Style Language data.
- **Case styles.** File and folder names, record ids and keys: lowercase words
  joined by hyphens. Record fields: lowercase words joined by underscores
  (`found_in`). TypeScript and JavaScript: camelCase for values and functions,
  PascalCase for types and components (project choice).

## 8. Sound and rhythm

Much of the project is drafted with help from AI tools. Readers have learned
the habits of machine-written prose, and text that shows them reads as
unchecked, whoever wrote it (project analysis). The rules below aim at clear,
specific writing, not at beating detection tools, which have "non-trivial error
rates."[^aisigns] Most of them describe weak prose in any case. The research
behind them is in the
[research session](../research/sessions/2026/2026-11-22-ai-and-human-prose.md).

- **Say the specific thing.** Language models tend to "omit specific, unusual,
  nuanced facts" and put in "more generic, positive descriptions."[^aisigns]
  Name the nation, the section, the year and the source. If a sentence brings
  no fact or picture to mind, it needs another pass.[^robbins]
- **Use "is" and "has."** Write "The court is the forum of first resort," not
  "The court serves as the forum of first resort." Machine text swaps "is" and
  "are" for "serves as," "stands as" or "boasts," and human writing uses plain
  verbs ("wrote," "used," "tried") more often than stiff ones ("authored,"
  "utilized," "attempted").[^aisigns]
- **Justify watch-list words.** Language models overuse words such as delve,
  pivotal, crucial, underscore, showcase, foster, tapestry, testament, vibrant,
  landscape and intricate.[^aisigns][^cmu] They are not banned. Use one only
  when it is the most exact word. The list shifts as models change, so this
  guide does not try to be complete.
- **Claim significance only with a source.** Avoid trailing phrases such as
  "highlighting its importance" or "reflecting broader trends" and labels such
  as "a pivotal moment."[^aisigns] If a source says something mattered, cite
  the source.
- **Vary sentence length.** A run of sentences of one length drones; varying
  the length creates "music."[^provost] Read important passages aloud. After a
  long sentence, a short one lands a point.
- **Put the point last.** English stresses the end of a sentence, and long,
  heavy elements read best there.[^haisley] End on the new fact, the duty or
  the exception, not on a qualifier.
- **Save emphasis for what needs it.** When every sentence is pitched as
  important, none stands out (project analysis). Let most sentences state facts
  plainly.
- **Avoid stock shapes.** Use "not X but Y" only to correct a view a reader
  actually holds; used by reflex, the frame "can sound comprehensive without
  committing to anything."[^robbins] List as many items as there are, not three
  by habit, and do not close a section with a formula about "challenges" and
  "future prospects."[^aisigns]
- **Use all the punctuation.** Current models write longer sentences with
  fewer commas and semicolons than human writers, and "hardly any
  parentheses."[^economist] Use the full range, within the dash rule in
  section 6.
- **Commit where the sources allow.** Essays written by ChatGPT use fewer
  hedges, boosters and attitude markers than students' essays, which gives them
  "a more impersonal and expository tone."[^jiang-hyland] In commentary, say
  which alternative suits which situation and label it as project analysis.
  Hedge once, where doubt is real, and say what is uncertain: "the 1998 code is
  the latest version found," not "may potentially apply."
- **Name who holds a view.** Write who said it, not "experts argue" or
  "observers note."[^aisigns]
- **Check AI drafts against the sources.** Verify every fact, quotation and
  citation in AI-assisted text against the source itself before review. Garner
  calls "confident, well-formed fabrication" AI's "signature failure," and
  polished prose can hide it.[^garner]

## 9. Review checklist

Before opening a pull request with written content, check that:

- [ ] each defined term's first use is linked with `[[id]]`, and no "avoid"
      term appears outside a quotation;
- [ ] each factual claim cites a source, and project analysis is labeled;
- [ ] nations are named as they name themselves, in the present tense for
      living practice;
- [ ] provisions use must, must not and may, name the actor, and use template
      variables for nation-specific words;
- [ ] nothing restricted or community-held is included without written
      approval;
- [ ] sentence lengths vary, and sentences end on their point;
- [ ] no watch-list word, unsourced claim of significance, vague attribution or
      reflexive "not X but Y" remains without a reason;
- [ ] every fact, quotation and citation in AI-assisted text was checked
      against the source itself;
- [ ] identifiers in code and data are spelled out, and the automated checks
      pass.

## References

[^plain]: U.S. General Services Administration, Digital.gov, *Plain language guide series: Principles*, [digital.gov/guides/plain-language/principles](https://digital.gov/guides/plain-language/principles) (accessed Nov. 20, 2026). The Plain Writing Act of 2010, Pub. L. No. 111-274, applies to federal executive agencies ([digital.gov/resources/plain-writing-act](https://digital.gov/resources/plain-writing-act)). Source record: `digital-gov-plain-language`.
[^plain-short]: Digital.gov, *Write clear, short sentences and paragraphs*, [digital.gov/guides/plain-language/writing/clear-short](https://digital.gov/guides/plain-language/writing/clear-short) (accessed Nov. 20, 2026).
[^plain-writing]: Digital.gov, *Writing*, [digital.gov/guides/plain-language/writing](https://digital.gov/guides/plain-language/writing) (accessed Nov. 20, 2026).
[^plain-jargon]: Digital.gov, *Avoid jargon*, [digital.gov/guides/plain-language/principles/avoid-jargon](https://digital.gov/guides/plain-language/principles/avoid-jargon) (accessed Nov. 20, 2026).
[^nmai]: Smithsonian National Museum of the American Indian, *The Impact of Words and Tips for Using Appropriate Terminology: Am I Using the Right Word?* (Native Knowledge 360°), read from the [Arizona State Museum copy](https://statemuseum.arizona.edu/sites/default/files/Impact-of-Words-Tips-for-Using-Appropriate-Terminology.pdf) (accessed Nov. 20, 2026). Source record: `nmai-impact-of-words`.
[^uax15]: Unicode Consortium, *Unicode Standard Annex #15: Unicode Normalization Forms*, [unicode.org/reports/tr15](https://unicode.org/reports/tr15/) (defines Normalization Form C).
[^ngc-guide]: Native Governance Center, *How to Talk about Native Nations: A Guide* 3 (2021), [nativegov.org](https://nativegov.org/wp-content/uploads/2021/10/How-to-Talk-about-Native-Nations-A-Guide.pdf) (accessed Nov. 20, 2026). Source record: `ngc-how-to-talk-about-native-nations`.
[^aisigns]: WikiProject AI Cleanup, *Wikipedia:Signs of AI writing*, Wikipedia, [en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing) (accessed Nov. 22, 2026). A volunteer field guide that calls itself "descriptive, not prescriptive." Source record: `wikipedia-signs-of-ai-writing`.
[^cmu]: Alex Reinhart et al., *Do LLMs Write Like Humans? Variation in Grammatical and Rhetorical Styles*, 122 Proc. Nat'l Acad. Sci. e2422455122 (2025), [doi.org/10.1073/pnas.2422455122](https://doi.org/10.1073/pnas.2422455122) (finding that GPT-4o used words such as tapestry and intricate at more than 100 times the human rate); see also Stefanie Johndrow, *Is It Human, or Is It AI?*, Carnegie Mellon Univ. Dietrich Coll. News (Feb. 21, 2025), [cmu.edu](https://www.cmu.edu/dietrich/news/news-stories/2025/large-language-models-writing-text). Source records: `reinhart-2025-do-llms-write-like-humans`, `johndrow-2025-is-it-human-or-ai`.
[^robbins]: Hollis Robbins, *How to Tell if Something Is AI-Written*, Anecdotal Value (Aug. 13, 2025), [hollisrobbinsanecdotal.substack.com](https://hollisrobbinsanecdotal.substack.com/p/how-to-tell-if-something-is-ai-written) (accessed Nov. 22, 2026). Source record: `robbins-2025-how-to-tell-ai-written`.
[^provost]: Gary Provost, *100 Ways to Improve Your Writing* (1985), as quoted at [vanderburg.org/etc/quotes/provost-five](https://vanderburg.org/etc/quotes/provost-five) (accessed Nov. 22, 2026). Source record: `provost-1985-100-ways-to-improve-your-writing`.
[^haisley]: Phillip Haisley, *A Concise Guide to English Grammar* § 19.2, [phil-a-sophist.github.io](https://phil-a-sophist.github.io/concise-guide-english-grammar/ch-19-organization-and-concision-sec-192.html) (accessed Nov. 22, 2026). Source record: `haisley-concise-guide-english-grammar`.
[^economist]: *How to Spot AI Writing*, Economist (July 30, 2026), *quoted in* John Gruber, *The Economist: 'How to Spot AI Writing'*, Daring Fireball (Aug. 11, 2026), [daringfireball.net](https://daringfireball.net/linked/2026/08/11/economist-ai-writing) (accessed Nov. 22, 2026). Source records: `economist-2026-how-to-spot-ai-writing`, `gruber-2026-economist-how-to-spot-ai-writing`.
[^jiang-hyland]: Feng (Kevin) Jiang & Ken Hyland, *Rhetorical Distinctions: Comparing Metadiscourse in Essays by ChatGPT and Students*, 79 English for Specific Purposes 17 (2025) (abstract). Source record: `jiang-hyland-2025-rhetorical-distinctions`.
[^garner]: Bryan A. Garner, *Does Bryan Garner Think AI Will End Bad Legal Writing?*, ABA J. (Sept. 2, 2026), [abajournal.com](https://www.abajournal.com/columns/article/does-bryan-garner-think-ai-will-end-bad-legal-writing) (accessed Nov. 22, 2026). Source record: `garner-2026-ai-bad-legal-writing`.
