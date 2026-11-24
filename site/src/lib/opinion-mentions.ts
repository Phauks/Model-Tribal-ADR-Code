/**
 * Where a "Mentions" badge on a court opinion leads (Trevor, Nov. 24, 2026:
 * the words an opinion mentions should be clickable): the nation's table of
 * opinions, narrowed to those that mention the word. The table keeps its
 * filters in the page address (src/lib/tables/table-definition.ts,
 * writeTableState), so the link is the table's own filter.
 */

/** The identifier of the table at /nations/<id>/opinions. */
export const opinionsTable = 'opinions';

/** The column of that table that lists the words an opinion mentions. */
export const mentionsColumn = 'topics';

/** The nation's opinions that mention the word. */
export function opinionsMentioning(nationId: string, word: string): string {
	const parameters = new URLSearchParams({ [`${opinionsTable}.${mentionsColumn}`]: word });
	return `/nations/${nationId}/opinions?${parameters}`;
}
