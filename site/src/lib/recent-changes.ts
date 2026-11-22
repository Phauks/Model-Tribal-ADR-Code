/**
 * The merged pull requests a waiting update brings (site/DESIGN.md,
 * section 10, "Updates"), so the update card can list them, as Trevor asked
 * on Nov. 22, 2026. Each build reads its recent history from git
 * (vite.config.ts) and serves it in /edition.json; the reader's page lists
 * the ones merged after the build it is running.
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

/** The changes merged after a build was made, newest first. */
export function changesSince(changes: Change[] | undefined, built: Date | undefined): Change[] {
	if (!changes || !built) return [];
	return changes.filter((change) => Date.parse(change.merged) > built.getTime());
}
