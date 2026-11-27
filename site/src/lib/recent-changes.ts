/**
 * The merged pull requests a waiting update brings (site/DESIGN.md,
 * section 10, "Updates"), so the update card can list them, as Trevor asked
 * on Nov. 22, 2026. Each build reads its recent history from git
 * (vite.config.ts) and serves it in /edition.json; the reader's page lists
 * the ones merged after the build it is running.
 *
 * Cloudflare's build clones only the latest commit, so git alone gave one
 * change. Each build on Cloudflare therefore also reads the live site's
 * /edition.json and carries its changes forward
 * (src/lib/server/recent-changes-build.ts), so the list grows with every
 * deploy and the card can list every change since the reader's build, as
 * Trevor asked on Nov. 27, 2026.
 *
 * This module must work in the browser and in Node (for tests and for
 * vite.config.ts).
 */

export interface Change {
	/** The pull request number. */
	number: number;
	/** The pull request title without its conventional-commit type, for example "Rework Settings controls". */
	title: string;
	/** When it was merged into main, as an ISO 8601 date and time. */
	merged: string;
}

/**
 * How many changes a build keeps. At about 110 bytes each, /edition.json
 * stays near 110 KB (about 30 KB compressed), and it is fetched only when
 * an update is waiting. It is a prerendered file, not part of the Worker.
 */
export const keptChanges = 1000;

/**
 * Reads `git log --first-parent --format=%cI%x09%s` output. Only squash
 * merges of pull requests count: their subjects end with "(#number)".
 */
export function parseGitLog(text: string): Change[] {
	const changes: Change[] = [];
	for (const line of text.split('\n')) {
		const [merged, subject] = line.split('\t');
		const match = subject?.match(/^(?:[a-z]+(?:\([^)]*\))?!?:\s*)?(.+?)\s*\(#(\d+)\)$/);
		if (!match || Number.isNaN(Date.parse(merged))) continue;
		const title = match[1].charAt(0).toUpperCase() + match[1].slice(1);
		changes.push({ number: Number(match[2]), title, merged });
	}
	return changes;
}

/** Keeps the well-formed entries of a list read from elsewhere, such as the live site's /edition.json. */
export function readChanges(value: unknown): Change[] {
	if (!Array.isArray(value)) return [];
	return value.filter(
		(entry): entry is Change =>
			typeof entry === 'object' &&
			entry !== null &&
			Number.isInteger(entry.number) &&
			entry.number > 0 &&
			typeof entry.title === 'string' &&
			entry.title.length > 0 &&
			typeof entry.merged === 'string' &&
			!Number.isNaN(Date.parse(entry.merged))
	);
}

/**
 * Joins lists of changes, newest first, each pull request once (the first
 * list that names it wins, so give git's list first), keeping at most
 * `limit`.
 */
export function mergeChanges(lists: Change[][], limit = keptChanges): Change[] {
	const byNumber = new Map<number, Change>();
	for (const list of lists) {
		for (const change of list) if (!byNumber.has(change.number)) byNumber.set(change.number, change);
	}
	return [...byNumber.values()]
		.sort((a, b) => Date.parse(b.merged) - Date.parse(a.merged) || b.number - a.number)
		.slice(0, limit);
}

/** The changes merged after a build was made, newest first. */
export function changesSince(changes: Change[] | undefined, built: Date | undefined): Change[] {
	if (!changes || !built) return [];
	return changes.filter((change) => Date.parse(change.merged) > built.getTime());
}

/**
 * Whether the list reaches back to the reader's build, so the changes since
 * it are all there. When every listed change is newer than the build, older
 * ones may have fallen off the end of the list.
 */
export function reachesBack(changes: Change[] | undefined, built: Date | undefined): boolean {
	if (!changes || !built) return false;
	return changes.some((change) => Date.parse(change.merged) <= built.getTime());
}

export interface ChangeDay {
	/** The day in the reader's time zone, as YYYY-MM-DD. */
	day: string;
	/** The day as the card shows it, for example "Nov. 26". */
	label: string;
	changes: Change[];
}

const months = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];

/** Groups changes (newest first) by the day they were merged, in the given time zone or the reader's own. */
export function changesByDay(changes: Change[], timeZone?: string): ChangeDay[] {
	const format = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric' });
	const days: ChangeDay[] = [];
	for (const change of changes) {
		const parts = Object.fromEntries(format.formatToParts(new Date(change.merged)).map((part) => [part.type, part.value]));
		const day = `${parts.year}-${parts.month.padStart(2, '0')}-${parts.day.padStart(2, '0')}`;
		const last = days.at(-1);
		if (last?.day === day) last.changes.push(change);
		else days.push({ day, label: `${months[Number(parts.month) - 1]} ${Number(parts.day)}`, changes: [change] });
	}
	return days;
}
