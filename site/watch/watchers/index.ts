/**
 * Every watcher, and every collection or nation page part no watcher feeds,
 * with the reason (docs/source-watch.md, "Every collection and data type, and
 * its watcher"). A new collection in src/lib/server/collections.ts, or a new
 * top-level field in schemas/tribe.schema.json, fails
 * tests/source-watch-guard.test.ts until it is fed by a watcher here or
 * listed in notWatched.
 *
 * To add a source: write its watcher in this folder with defineWatcher, add
 * it to `watchers`, and take its collections out of notWatched.
 */
import type { NotWatched, WatcherDefinition } from '../../src/lib/server/watch/watcher.ts';
import citedLinks from './cited-links.ts';
import ecfr from './ecfr.ts';
import federalRegister from './federal-register.ts';
import federalRegisterSearch from './federal-register-search.ts';

export const watchers: WatcherDefinition[] = [federalRegister, federalRegisterSearch, ecfr, citedLinks];

export const notWatched: NotWatched[] = [
	// Collections (src/lib/server/collections.ts).
	{ feed: 'stories', kind: 'never', reason: 'Stories come from people, with their consent and their nations’ protocols (decision records 0019 and 0036).' },
	{ feed: 'united-states-code-sections', kind: 'planned', reason: 'us-code-release-points (the Office of the Law Revision Counsel’s release points for Title 25), phase 1, next after these.' },
	{ feed: 'supreme-court-cases', kind: 'planned', reason: 'supreme-court (the Court’s slip opinions page) and govinfo (U.S. Reports pagination), phase 1; govinfo needs the api.data.gov key.' },
	{ feed: 'other-court-cases', kind: 'planned', reason: 'courtlistener once Free Law Project has answered, and govinfo (USCOURTS) once the api.data.gov key is set; phase 2.' },
	{ feed: 'federal-court-opinions', kind: 'planned', reason: 'courtlistener (the federal courts of appeals, district courts and Court of Federal Claims, by the same Indian law terms) once Free Law Project has answered, phase 2; until then scripts/caselaw/courtlistener_federal_opinions.py reads the quarterly bulk files.' },
	{ feed: 'state-court-opinions', kind: 'planned', reason: 'courtlistener (state appellate courts, by the same Indian law terms) once Free Law Project has answered, phase 2; the Caselaw Access Project set ends about 2019 and does not change.' },
	{ feed: 'interior-board-of-indian-appeals', kind: 'planned', reason: 'ibia (the Board’s chronological index of decisions, weekly), phase 2; scripts/law/ibia_decisions.py rebuilds the collection meanwhile.' },
	{ feed: 'national-indian-gaming-commission', kind: 'planned', reason: 'nigc (the Commission’s document sitemaps, daily), phase 2; scripts/law/nigc_documents.py rebuilds the collection meanwhile.' },
	{ feed: 'tribal-court-opinions', kind: 'planned', reason: 'consented-courts, phase 3: only nations that publish their opinions and agree, with initials and privacy holds first (decision record 0057). Its list of courts starts empty.' },
	{ feed: 'oklahoma-state-tribal-agreements', kind: 'planned', reason: 'oklahoma-register (the Oklahoma Secretary of State’s register data file, json/dataTribal.json, compared by file number; scripts/agreements/oklahoma_register.py reads it today), phase 2.' },
	{ feed: 'supreme-courts', kind: 'derived', reason: 'Built from the Justices.' },
	{ feed: 'courts', kind: 'planned', reason: 'nation-sites (court pages) in phase 3, and courtlistener (new court names) in phase 2.' },
	{ feed: 'biographies', kind: 'planned', reason: 'wikidata, phase 2, and new parties and leaders in accepted cases and treaties. No automatic people pages.' },
	{ feed: 'justices', kind: 'planned', reason: 'supreme-court (the Court’s members page) and wikidata, phase 2.' },
	{ feed: 'presidents', kind: 'planned', reason: 'wikidata, phase 2.' },
	{ feed: 'charts', kind: 'derived', reason: 'Rebuilt from records; the census watcher will feed their inputs.' },
	{ feed: 'glossary-terms', kind: 'never', reason: 'Definitions come only from Black’s Law Dictionary, 12th ed. (project rule).' },
	{ feed: 'forms', kind: 'never', reason: 'The project’s own forms.' },

	// Nation page parts (top-level fields of schemas/tribe.schema.json).
	{ feed: 'nation:id', kind: 'never', reason: 'The project’s own identifier.' },
	{ feed: 'nation:former_ids', kind: 'never', reason: 'The project’s own record of merged profiles.' },
	{ feed: 'nation:entity_type', kind: 'derived', reason: 'Follows recognition, which federal-register watches.' },
	{ feed: 'nation:part_of', kind: 'derived', reason: 'Follows the list of recognized entities, which federal-register watches.' },
	{ feed: 'nation:names', kind: 'derived', reason: 'A rename appears in the list of recognized entities, which federal-register watches.' },
	{ feed: 'nation:states', kind: 'derived', reason: 'Follows recognition and land, which federal-register watches.' },
	{ feed: 'nation:census_areas', kind: 'planned', reason: 'census, phase 2 (the Census data API needs a key).' },
	{ feed: 'nation:population', kind: 'planned', reason: 'census, phase 2.' },
	{ feed: 'nation:contacts', kind: 'planned', reason: 'leaders-directory (by hand: it answers scripts with 403) and nation-sites, phase 3. Office details only (decision record 0051).' },
	{ feed: 'nation:tribal_insignia_database_entries', kind: 'never', reason: 'The USPTO insignia database changes rarely; entries are checked by hand when a page is reviewed.' },
	{ feed: 'nation:languages', kind: 'never', reason: 'Changes are rare and come from nations.' },
	{ feed: 'nation:federal_administration', kind: 'planned', reason: 'interior-pages (Bureau of Indian Affairs regions and agencies), phase 2.' },
	{ feed: 'nation:indian_health_service', kind: 'planned', reason: 'indian-health-service, by hand: ihs.gov did not answer the cloud on Nov. 24 and 26, 2026.' },
	{ feed: 'nation:government_structure', kind: 'planned', reason: 'nation-sites and document history changes, phase 3.' },
	{ feed: 'nation:governance', kind: 'planned', reason: 'nation-sites and document history changes, phase 3 (decision record 0042).' },
	{ feed: 'nation:justice_institutions', kind: 'planned', reason: 'nation-sites (court pages), phase 3; judges’ names are not collected.' },
	{ feed: 'nation:court_practice', kind: 'planned', reason: 'nation-sites (court rules, fees, forms), phase 3.' },
	{ feed: 'nation:dispute_resolution_law', kind: 'derived', reason: 'From the nation’s codes and court rules, through the provision review.' },
	{ feed: 'nation:dispute_resolution', kind: 'derived', reason: 'From the nation’s codes and court rules, through the provision review.' },
	{ feed: 'nation:memberships', kind: 'never', reason: 'Changes are rare and come from the organizations.' },
	{ feed: 'nation:related_entities', kind: 'never', reason: 'Changes are rare and come from nations and organizations.' },
	{ feed: 'nation:consultation', kind: 'never', reason: 'The project’s own record of its contact with the nation.' },
	{ feed: 'nation:review', kind: 'never', reason: 'The project’s own review status.' },
	{ feed: 'nation:sensitivity', kind: 'never', reason: 'The project’s own handling choices.' }
];

export function watcherNamed(identifier: string): WatcherDefinition | undefined {
	return watchers.find((watcher) => watcher.identifier === identifier);
}
