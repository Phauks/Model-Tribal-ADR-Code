/**
 * The opinions of each case whose text the site serves, split one from
 * another, as research/case-opinions/opinions.csv lists them
 * (scripts/caselaw/case_opinion_texts.py): the copy that holds them, each
 * one's kind, writer, pages and length. The case's page shows each opinion
 * in a folding section of its own and reads its text from that copy when a
 * reader opens the page (src/routes/cases/[id]/opinions.json), so the text is
 * never part of the page's built data or the Worker's code.
 *
 * Read when the site is built.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseCsv } from '../csv.ts';
import { publicCopies, repositoryRoot } from './content.ts';

export interface OpinionTextEntry {
	/** The served copy that holds the case's opinions. */
	copy: string;
	/** The opinion's place among the copy's opinions, from 0. */
	position: number;
	/** The kind, as the site names kinds (src/lib/case-opinions.ts): "majority", "dissent", "rehearing". */
	kind: string;
	/** The writer's surname as the report gives it; empty for a per curiam opinion or one that names no writer. */
	author: string;
	firstPage?: number;
	lastPage?: number;
	words: number;
}

const listFile = 'research/case-opinions/opinions.csv';
let byRecord: Map<string, OpinionTextEntry[]> | undefined;

function pageNumber(value: string): number | undefined {
	return /^\d+$/.test(value) ? Number(value) : undefined;
}

/** Every case's opinions with text, by case record; only copies the site serves. */
function opinionTextList(): Map<string, OpinionTextEntry[]> {
	if (byRecord) return byRecord;
	byRecord = new Map();
	const file = path.join(repositoryRoot, listFile);
	if (!existsSync(file)) return byRecord;
	const served = new Set(publicCopies().map((copy) => copy.key));
	for (const row of parseCsv(readFileSync(file, 'utf8'))) {
		if (!served.has(row.copy)) continue;
		const list = byRecord.get(row.record) ?? [];
		list.push({
			copy: row.copy,
			position: Number(row.position),
			kind: row.kind,
			author: row.author,
			firstPage: pageNumber(row.first_page),
			lastPage: pageNumber(row.last_page),
			words: Number(row.words) || 0
		});
		byRecord.set(row.record, list);
	}
	for (const list of byRecord.values()) list.sort((one, other) => one.position - other.position);
	return byRecord;
}

/**
 * A case's opinions with text, in the order the copy gives them, or an
 * empty list. A case is read from one copy: if a record ever has two, the
 * first listed is used.
 */
export function opinionTextsOf(record: string): OpinionTextEntry[] {
	const list = opinionTextList().get(record) ?? [];
	const copy = list[0]?.copy;
	return list.filter((entry) => entry.copy === copy);
}
