/**
 * Long lists sent to D1 in groups. D1 takes up to 100 bound values in one statement and a limited number of statements in one batch, so an "IN (…)" list or a batch of statements longer than that is split and sent group by group.
 */

/** The items in groups of at most this many, in order. An empty list has no groups. */
export function inGroupsOf<Item>(items: readonly Item[], size: number): Item[][] {
	const groups: Item[][] = [];
	for (let start = 0; start < items.length; start += size) groups.push(items.slice(start, start + size));
	return groups;
}

/** The "?, ?, ?" placeholders of an "IN (…)" list, one for each value. */
export function placeholdersFor(values: readonly unknown[]): string {
	return values.map(() => '?').join(', ');
}
