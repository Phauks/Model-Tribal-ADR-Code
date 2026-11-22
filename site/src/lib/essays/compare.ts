/**
 * Compares two versions of an essay paragraph by paragraph, and within a
 * changed paragraph word by word, for the workspace's compare page. Essays
 * are written one paragraph to a line (no hard wrapping), so a paragraph is
 * the natural unit of change.
 */

export type Piece = { kind: 'same' | 'added' | 'removed'; text: string };
export type BlockChange =
	| { kind: 'same'; text: string }
	| { kind: 'added'; text: string }
	| { kind: 'removed'; text: string }
	| { kind: 'changed'; pieces: Piece[] };

/** The longest common subsequence of two lists, as pairs of indexes. */
function commonPairs<Item>(first: Item[], second: Item[]): [number, number][] {
	const rows = first.length;
	const columns = second.length;
	const lengths = Array.from({ length: rows + 1 }, () => new Uint32Array(columns + 1));
	for (let row = rows - 1; row >= 0; row -= 1) {
		for (let column = columns - 1; column >= 0; column -= 1) {
			lengths[row][column] =
				first[row] === second[column]
					? lengths[row + 1][column + 1] + 1
					: Math.max(lengths[row + 1][column], lengths[row][column + 1]);
		}
	}
	const pairs: [number, number][] = [];
	let row = 0;
	let column = 0;
	while (row < rows && column < columns) {
		if (first[row] === second[column]) {
			pairs.push([row, column]);
			row += 1;
			column += 1;
		} else if (lengths[row + 1][column] >= lengths[row][column + 1]) row += 1;
		else column += 1;
	}
	return pairs;
}

function diff<Item>(first: Item[], second: Item[]): { kind: 'same' | 'added' | 'removed'; item: Item }[] {
	const out: { kind: 'same' | 'added' | 'removed'; item: Item }[] = [];
	let row = 0;
	let column = 0;
	for (const [matchRow, matchColumn] of [...commonPairs(first, second), [first.length, second.length] as [number, number]]) {
		while (row < matchRow) out.push({ kind: 'removed', item: first[row++] });
		while (column < matchColumn) out.push({ kind: 'added', item: second[column++] });
		if (matchRow < first.length) out.push({ kind: 'same', item: first[matchRow] });
		row = matchRow + 1;
		column = matchColumn + 1;
	}
	return out;
}

/** Words and the spaces after them, so joining the pieces gives the text back. */
function words(text: string): string[] {
	return text.match(/\S+\s*|\s+/g) ?? [];
}

function wordPieces(before: string, after: string): Piece[] {
	const pieces: Piece[] = [];
	for (const step of diff(words(before), words(after))) {
		const last = pieces.at(-1);
		if (last && last.kind === step.kind) last.text += step.item;
		else pieces.push({ kind: step.kind, text: step.item });
	}
	return pieces;
}

function blocks(text: string): string[] {
	return text
		.replace(/\r\n?/g, '\n')
		.split(/\n{2,}/)
		.map((block) => block.trim())
		.filter(Boolean);
}

/** The changes from one text to another, block by block. Removed blocks followed by added ones are paired up as changed blocks. */
export function compareTexts(before: string, after: string): BlockChange[] {
	const steps = diff(blocks(before), blocks(after));
	const changes: BlockChange[] = [];
	for (let index = 0; index < steps.length; ) {
		if (steps[index].kind === 'same') {
			changes.push({ kind: 'same', text: steps[index].item });
			index += 1;
			continue;
		}
		const removed: string[] = [];
		const added: string[] = [];
		while (index < steps.length && steps[index].kind === 'removed') removed.push(steps[index++].item);
		while (index < steps.length && steps[index].kind === 'added') added.push(steps[index++].item);
		const paired = Math.min(removed.length, added.length);
		for (let pair = 0; pair < paired; pair += 1) changes.push({ kind: 'changed', pieces: wordPieces(removed[pair], added[pair]) });
		for (const text of removed.slice(paired)) changes.push({ kind: 'removed', text });
		for (const text of added.slice(paired)) changes.push({ kind: 'added', text });
	}
	return changes;
}
