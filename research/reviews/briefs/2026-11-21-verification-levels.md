# Brief: assign a verification level to groups of facts

A research dataset of Native nation profiles cites a source for every fact. A new field, `verification`, records how closely each fact was checked against its source. Definitions (from the project's schema, decision record 0014):

- `read-in-full`: the part of the document that states the value was read.
- `title-only`: only a title, link text, heading or table-of-contents line was seen.
- `bulk-import`: copied from a row of a list, directory, database or data table without opening the underlying document.
- `inferred`: derived rather than stated, for example matched to the nation by name, assigned by a rule, a language tag assigned by the researcher, or taken from another nation's document or a secondary description.

Your batch is a list of groups. Each group is one profile section plus one source (or a family of sources such as all National Indian Law Library nation pages). It gives the number of facts, how many profiles cite the source (`profiles_citing_source`; 20 or more means a list or directory), the source kind, and up to three example facts with their `note`, `locator` and values.

For each group choose the ONE level that is true of every fact in the group, using the examples' notes as evidence of how the facts were gathered:
- Choose `read-in-full` only when the notes show the researcher read the passage that states the value: a quotation from the page (text in quotation marks, "Page: ...", "Source: '...'"), a pinpoint into the document's text (section, article, page number within the document itself) together with a value the text states, or a note saying the page or text was read.
- A value copied from a state, federal or organization list of many nations (contacts, recognized-tribes lists, member lists) is `bulk-import`, even if the list was opened.
- A document title, link or a "listed on" entry with no sign the document itself was opened is `title-only`.
- A value that the note says was derived, assigned, matched, estimated or taken from another entity is `inferred`.
- If the examples disagree, or the evidence is thin, choose the WEAKER level in this order: inferred (weakest) < title-only < bulk-import < read-in-full (strongest). Never choose read-in-full by default.

Output: write a JSON array to the output path you are given, one object per group, in input order:
{"group_id": 5, "group": "...", "level": "read-in-full|title-only|bulk-import|inferred", "mixed": true|false, "reason": "one short sentence citing the note wording you relied on"}
`mixed` is true when the examples suggest different levels (you then chose the weaker). Write valid JSON only. When done, reply with the counts of each level and nothing else.
