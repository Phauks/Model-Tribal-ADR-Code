/**
 * Where a "Mentions" badge on a court opinion leads (Trevor, Nov. 24, 2026:
 * the words an opinion mentions should be clickable): the nation's table of
 * opinions, narrowed to those that mention the word. The table keeps its
 * filters in the page address (src/lib/tables/table-definition.ts,
 * writeTableState), so the link is the table's own filter.
 */

/**
 * The words an opinion is tagged with, by tag, as the site shows them
 * (research/tribal-court-opinions/opinions.csv, topics). The order is the
 * order the full timeline's Mentions filter lists them in.
 */
export const mentionWords: Record<string, string> = {
	'custom-and-tradition': 'custom and tradition',
	'sovereign-immunity': 'sovereign immunity',
	'indian-civil-rights-act': 'Indian Civil Rights Act',
	gaming: 'gaming',
	peacemaking: 'peacemaking',
	mediation: 'mediation',
	arbitration: 'arbitration',
	'alternative-dispute-resolution': 'alternative dispute resolution',
	'talking-things-out': 'talking things out',
	'restorative-justice': 'restorative justice'
};

/** The words, in the filter's order; an opinion's words are kept as one number, a bit for each (src/lib/timeline.ts). */
export const mentionWordList = Object.values(mentionWords);

/** The identifier of the table at /nations/<id>/opinions. */
export const opinionsTable = 'opinions';

/** The column of that table that lists the words an opinion mentions. */
export const mentionsColumn = 'topics';

/** The nation's opinions that mention the word. */
export function opinionsMentioning(nationIdentifier: string, word: string): string {
	const parameters = new URLSearchParams({ [`${opinionsTable}.${mentionsColumn}`]: word });
	return `/nations/${nationIdentifier}/opinions?${parameters}`;
}
