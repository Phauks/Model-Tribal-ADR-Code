# Brief: dispute resolution coverage review (Nov. 22, 2026)

For reviewers reading the batches written by `python3 scripts/review/coverage_search.py batches --work WORK_DIRECTORY`. Each batch file (`WORK_DIRECTORY/batches/batch-NNN.json`) lists up to 12 federally recognized Native nations that have no dispute resolution record in their profile. For each nation it gives:

- `capture_candidates`: leads the project already holds (provisions read from the nation's own law texts, constitution articles, programs listed under the profile's justice institutions, Alaska Court System restorative justice plans, sources from the peacemaking research);
- `passages`: short passages, around dispute resolution words, from pages the script fetched on the nation's website, court pages, code pages and its National Indian Law Library page, each with its address and HTTP status.

## What to decide, for each nation

1. List every **candidate**: a dispute resolution forum, program, code provision, clause, training or published material of **this nation** that the passage or lead supports. For each give:
   - `field`: the profile field it would go in: `forums`, `provisions`, `clauses`, `training_programs` or `published_materials`;
   - `kind`: from the open vocabulary in `schemas/tribe.schema.json` (forums: peacemaking, traditional-forum, mediation-program, arbitration, family-or-talking-circle, elders-council, restorative-justice, settlement-conference, family-group-conference, sentencing-circle, healing-circle, other; provisions: peacemaking, mediation, arbitration, traditional-dispute-resolution, other; clauses: arbitration-clause, mediation-clause, choice-of-forum, waiver-of-sovereign-immunity);
   - `name`: the name the nation gives it, exactly as written;
   - `summary`: one neutral sentence, from the passage only;
   - `evidence_url`: the page that shows it, which must be one the script fetched with status 200 (copy it from the passage);
   - `passage_ref`: the passage's `ref`;
   - `confidence`: high (the page plainly describes it), medium (it is named but not described), low (a passing mention).
2. For each capture lead, say `candidate` or `not-dispute-resolution` with a one-line reason (for example a constitution article on election disputes only, or a "peacemaker" who is a judge).
3. If there is nothing, say **none found** and why, in one sentence (for example "the court page lists civil and criminal matters only" or "the word 'mediation' appears only in a housing lease form").

## Not a candidate

- Mediation or arbitration offered by someone else (a state court, a federal agency, a casino patron dispute process run by a state, a vendor contract template) unless the nation's own law or program provides it.
- Gaming compact dispute terms (they are recorded under `gaming`, not `dispute_resolution`).
- Election disputes decided by an election board or council, and judicial power in general, unless the text names a dispute resolution method.
- Elders' councils, talking circles or healing circles that are services (elder meals, wellness groups) rather than a way to resolve disputes.
- Healing to Wellness courts and drug courts (treatment courts), unless the text describes a circle, peacemaking or mediation step.
- Anything ceremonial or traditional that the nation has not itself made public in that passage (charter, commitment 5). Summaries never add cultural detail beyond the passage.

## Rules

- Never guess. A candidate must be supported by the passage itself. When a passage is cut off, say medium or low confidence.
- Say "citizen", not "member", in your own words. Quote names exactly.
- Do not copy long quotations: summaries only (Tribal legal text is link-only by default).

## Output

One JSON list per batch, `WORK_DIRECTORY/verdicts/batch-NNN.json`, one object per nation:

```json
{
  "nation": "profile-id",
  "candidates": [{"field": "forums", "kind": "peacemaking", "name": "...",
                  "summary": "...", "evidence_url": "https://...",
                  "passage_ref": "...", "confidence": "high",
                  "first_reader": "...", "first_verdict": "candidate"}],
  "capture_verdicts": {"<record of the lead>": {"first_verdict": "candidate", "first_note": "..."}},
  "reasons": {"<place address>": "one sentence for the search log"},
  "none_found_reason": "one sentence, when there are no candidates"
}
```

## Second pass

A second reader re-reads every candidate and a fixed random sample of 10 percent of the nations with no passages (`none-found-sample.json`, seed 20261122), opening the evidence page, and sets `second_reader`, `second_verdict` (`confirm`, `change`, `not-dispute-resolution`) and `second_note`.

## Who read this run

This run's subagent tool was not available to the worker, so both readings were made by Claude (Claude (AI assistant)) in the worker session itself, the first from the passages and the second by re-fetching each evidence page; the readers are named in each row. A later run can repeat the first pass with small-model batches and the second with a larger model from the same batch files.
