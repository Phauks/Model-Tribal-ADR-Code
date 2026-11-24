# Legal help providers

Places a person can get legal help or legal information about tribal law or Indian law, and the states and Native nations each one serves. Started Nov. 24, 2026, when Trevor asked to identify tribal law self-help centers around the country and which states and nations they serve, so the results can be folded into nation pages and the assistance queue.

- `providers/<id>.yaml`: one record per provider, following [`schemas/legal-help-provider.schema.json`](../../schemas/legal-help-provider.schema.json). Each `serves` item says which states and nations, quotes or closely paraphrases its source, and names the source in the record's own `sources` list.
- `nation-matches.csv`: written by [`scripts/legal-help/match_nations.py`](../../scripts/legal-help/match_nations.py). One row per nation and provider, with the basis of the match: `named` (the source names the nation or its reservation), `members` (the nation's own program for its members), or `statewide` (the source says the provider serves Native people in every county of a state, so every nation with a page in that state is matched). Run the script again after adding or changing a record; `--check` only validates.

## Kinds

| Kind | Meaning |
| --- | --- |
| `legal-aid` | A nonprofit that gives free advice or representation, including the Legal Services Corporation's Native American grantees |
| `tribal-legal-aid` | A legal aid office a nation runs for its own members |
| `self-help-center` | A tribal court's, state court's or federal court's center that helps people represent themselves |
| `legal-information-site` | Web pages with information or forms about tribal law, with no staff help |
| `law-school-clinic` | Students supervised by faculty, usually for tribes rather than individuals |

## Rules

- Follow "grab now, classify later": a provider found but not yet read closely gets `status: to-classify` and is not shown to readers until it is read.
- `link` is the provider's own page about the service. Where none was found, the best official page (a directory entry or the home page) is linked and `note` says so, following the rule that every listed service has a link.
- A provider serving Native Hawaiians is matched to the state, not to a nation: Native Hawaiians are not organized as tribes.
- Eligibility (income limits, membership) is the provider's to decide. `who_can_use` repeats what the source says and nothing more.
- Captures of the Legal Services Corporation data used here are in the project's working files under `research/legal-help/captures/lsc/`.

The findings, the gaps and the open questions are in the [Nov. 24, 2026 note](../analyses/2026-11-24-legal-help-providers.md).
