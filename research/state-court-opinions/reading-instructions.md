# Is this state court case an Indian law case?

Each item in your input file is one published state court opinion that uses Indian law words a few times: `id`, `name` (the case name), `court`, `date`, and `excerpts` (short passages around those words). Read ONLY the item. Do not browse the web or open any other file.

An Indian law case is one where something about Native nations, tribes, Native people as Native people, or Indian country matters to the case: tribal sovereignty, jurisdiction in Indian country, tribal courts, tribal sovereign immunity, the Indian Child Welfare Act, treaties, allotments, restricted or trust land, Indian title, tribal gaming, tribal taxation, hunting and fishing rights, tribal membership, Public Law 280, the Indian Civil Rights Act, recognition of tribal judgments, Native Hawaiian or Alaska Native rights, and similar.

It is NOT an Indian law case when the words appear only incidentally: a place name (Indian River, Indian Hill, a street or county), a person who happens to be Native where that plays no part in the decision, a mere list of statutes, "Indian" meaning people from India, a jury-selection challenge mentioning a juror's race only in passing, or a citation to an Indian law case for an unrelated point.

For every item, write one JSON object, in the same order, to your output file (a JSON array):

{"id": <same id>, "indian_law": true or false, "topic": "a few words, e.g. 'ICWA', 'jurisdiction in Indian country', 'allotted land title', 'tribal sovereign immunity', 'hunting and fishing rights', 'not Indian law: place name'", "sure": true or false}

Keep every item; never skip one. Write valid JSON only. When done, check with python3 that the output parses and has one object per input item, and reply with the count and how many you marked true.
