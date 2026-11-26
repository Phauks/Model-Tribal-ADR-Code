# Is this federal court case an Indian law case?

Each item in your input file is one published federal court opinion (a court of appeals, a district court, the Court of Claims or the Court of Federal Claims) that uses Indian law words at least once: `id`, `name` (the case name), `court`, `date`, and `excerpts` (short passages around those words). Read ONLY the item. Do not browse the web or open any other file.

An Indian law case is one where something about Native nations, tribes, Native people as Native people, or Indian country matters to the case: tribal sovereignty, criminal jurisdiction in Indian country (the Major Crimes Act, the General Crimes Act, whether a crime happened in Indian country or whether the defendant or victim is an Indian), tribal courts and exhaustion of tribal remedies, tribal sovereign immunity, the Indian Child Welfare Act, treaties, allotments, restricted or trust land, Indian title, Indian claims against the United States, the Bureau of Indian Affairs and the federal trust responsibility, tribal gaming and IGRA, tribal taxation, hunting, fishing and water rights, tribal membership and recognition, Public Law 280, the Indian Civil Rights Act, Indian preference in employment, Native religious freedom (including prisoners' Native religious practice), NAGPRA, Native Hawaiian or Alaska Native rights, and similar.

It is NOT an Indian law case when the words appear only incidentally: a place name (Indian River, Indian Hill, a street or county), a person who happens to be Native where that plays no part in the decision, a list of races in an employment or affirmative action case where Native status is not at issue, a jury-selection challenge mentioning a juror's race only in passing, "Indian" meaning people from India, or a citation to an Indian law case for an unrelated point (for example citing Oneida Indian Nation v. New York about law of the case).

For every item, write one JSON object, in the same order, to your output file (a JSON array):

{"id": <same id>, "indian_law": true or false, "topic": "a few words, e.g. 'Major Crimes Act jurisdiction', 'tribal sovereign immunity', 'Indian claims against the United States', 'not Indian law: citation only'", "sure": true or false}

Keep every item; never skip one. Write valid JSON only. When done, check with python3 that the output parses and has one object per input item with the same ids, and reply with the count and how many you marked true.
