/**
 * Three-way merge of essay texts, paragraph by paragraph. Essays are written
 * one paragraph to a line (no hard wrapping), so a line is the unit: a line
 * only one side changed takes that side's change; a line both sides changed
 * the same way is kept once; a line both sides changed differently is a
 * conflict, and the merge gives up rather than guess.
 *
 * Used to bring text merged in git into the website copy of an essay
 * without losing edits made on the website since the last time git's text
 * came in (src/lib/server/essay-git-sync.ts).
 */

export type MergeResult = { merged: true; text: string } | { merged: false; conflicts: number };

/** For each line of `base`, the index of the same line in `other` on a longest common subsequence, or -1. */
function matches(base: string[], other: string[]): Int32Array {
	const found = new Int32Array(base.length).fill(-1);
	// Lines the same at the start and the end need no table.
	let start = 0;
	while (start < base.length && start < other.length && base[start] === other[start]) {
		found[start] = start;
		start += 1;
	}
	let baseEnd = base.length;
	let otherEnd = other.length;
	while (baseEnd > start && otherEnd > start && base[baseEnd - 1] === other[otherEnd - 1]) {
		baseEnd -= 1;
		otherEnd -= 1;
		found[baseEnd] = otherEnd;
	}
	const rows = baseEnd - start;
	const columns = otherEnd - start;
	if (rows === 0 || columns === 0) return found;
	const lengths = Array.from({ length: rows + 1 }, () => new Uint32Array(columns + 1));
	for (let row = rows - 1; row >= 0; row -= 1) {
		for (let column = columns - 1; column >= 0; column -= 1) {
			lengths[row][column] =
				base[start + row] === other[start + column]
					? lengths[row + 1][column + 1] + 1
					: Math.max(lengths[row + 1][column], lengths[row][column + 1]);
		}
	}
	let row = 0;
	let column = 0;
	while (row < rows && column < columns) {
		if (base[start + row] === other[start + column]) {
			found[start + row] = start + column;
			row += 1;
			column += 1;
		} else if (lengths[row + 1][column] >= lengths[row][column + 1]) {
			row += 1;
		} else {
			column += 1;
		}
	}
	return found;
}

const same = (first: string[], second: string[]) => first.length === second.length && first.every((line, index) => line === second[index]);

/** Merges the changes from `base` to `ours` and from `base` to `theirs`. */
export function mergeThreeWay(base: string, ours: string, theirs: string): MergeResult {
	if (ours === theirs) return { merged: true, text: ours };
	if (ours === base) return { merged: true, text: theirs };
	if (theirs === base) return { merged: true, text: ours };
	const baseLines = base.split('\n');
	const ourLines = ours.split('\n');
	const theirLines = theirs.split('\n');
	const inOurs = matches(baseLines, ourLines);
	const inTheirs = matches(baseLines, theirLines);
	const result: string[] = [];
	let conflicts = 0;
	let baseAt = 0;
	let ourAt = 0;
	let theirAt = 0;
	for (let stable = 0; stable <= baseLines.length; stable += 1) {
		// A base line kept by both sides anchors the merge; the end of the text does too.
		const atEnd = stable === baseLines.length;
		if (!atEnd && (inOurs[stable] < ourAt || inTheirs[stable] < theirAt)) continue;
		const ourStop = atEnd ? ourLines.length : inOurs[stable];
		const theirStop = atEnd ? theirLines.length : inTheirs[stable];
		const baseChunk = baseLines.slice(baseAt, stable);
		const ourChunk = ourLines.slice(ourAt, ourStop);
		const theirChunk = theirLines.slice(theirAt, theirStop);
		if (same(ourChunk, baseChunk)) result.push(...theirChunk);
		else if (same(theirChunk, baseChunk) || same(ourChunk, theirChunk)) result.push(...ourChunk);
		else conflicts += 1;
		if (!atEnd) result.push(baseLines[stable]);
		baseAt = stable + 1;
		ourAt = ourStop + 1;
		theirAt = theirStop + 1;
	}
	return conflicts > 0 ? { merged: false, conflicts } : { merged: true, text: result.join('\n') };
}
