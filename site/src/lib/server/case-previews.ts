/**
 * The case previews and citation index (src/lib/case-links.ts), built with
 * the site from the source records, which keep each case's box. Every
 * case links to its own page, /cases/<key> (src/lib/server/case-pages.ts),
 * which holds its summary, opinions and the places to read it.
 */
import { citationKey, parseCitation, type CasePreview, type CasePreviewList } from '../case-links.ts';
import { formatCaptureDate } from './markdown.ts';
import { sources, type SourceRecord } from './content.ts';
import { essaysInGit } from './essay-library.ts';

/** A holding as plain text: citations dropped, glossary links and emphasis reduced to their words. */
function plainHolding(holding: string): string {
	return holding
		.replace(/\s*\[@[^\]]*\]/g, '')
		.replace(/\[\[([a-z0-9-]+)\|([^\]]+)\]\]/g, '$2')
		.replace(/\[\[([a-z0-9-]+)\]\]/g, '$1')
		.replace(/[*_]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * The holding of each case, as plain text, by source key: from the case's
 * record (`case_box`, src/lib/essays/record-boxes.ts), or from a box an
 * essay still writes out in full.
 */
export function boxHoldings(texts: Record<string, string>, records: SourceRecord[] = []): Record<string, string> {
	const holdings: Record<string, string> = {};
	for (const record of records) {
		if (record.case_box?.holding?.trim()) holdings[record.key] = plainHolding(record.case_box.holding);
	}
	for (const text of Object.values(texts)) {
		for (const box of text.matchAll(/^:{4,}[ \t]*case[ \t]+([a-z0-9-]+)[ \t]*\n([\s\S]*?)^:{4,}[ \t]*$/gm)) {
			const holding = /^:::[ \t]*holding[ \t]*\n([\s\S]*?)^:::[ \t]*$/m.exec(box[2])?.[1];
			if (!holding || holdings[box[1]]) continue;
			holdings[box[1]] = plainHolding(holding);
		}
	}
	return holdings;
}

/** A holding short enough for a preview: whole sentences up to about 320 characters. */
function shortHolding(holding: string | undefined): string | undefined {
	if (!holding || holding.length <= 320) return holding;
	let kept = '';
	for (const sentence of holding.match(/[^.?!]+[.?!]+(?:\s+|$)/g) ?? [holding]) {
		if (kept && kept.length + sentence.length > 320) break;
		kept += sentence;
	}
	return kept.trim().length > 0 && kept.length <= 420 ? kept.trim() : `${holding.slice(0, 317).trimEnd()}…`;
}

function decidedText(parts: number[] | undefined): string {
	if (!parts?.[0]) return '';
	if (parts.length < 3) return String(parts[0]);
	return formatCaptureDate(`${parts[0]}-${String(parts[1]).padStart(2, '0')}-${String(parts[2]).padStart(2, '0')}`);
}

/** Reporter citations a record gives: its own, and the parallel one CourtListener matched. */
function citationsOf(record: SourceRecord): string[] {
	const keys: string[] = [];
	const { volume, page } = record.citation;
	const reporter = record.citation['container-title'];
	if (volume && reporter && page && /^\d+$/.test(volume) && /^\d+/.test(page)) keys.push(citationKey(volume, reporter, page.replace(/\D.*$/, '')));
	const matched = (record as { courtlistener?: { citation?: string } }).courtlistener?.citation;
	const parsed = matched ? parseCitation(matched) : undefined;
	if (parsed) keys.push(citationKey(parsed.volume, parsed.reporter, parsed.page));
	return keys;
}

let defaultPreviewList: CasePreviewList | undefined;

/**
 * Every case's preview. Called without arguments, as the case, Justice,
 * President, biography and nation pages do for each page they build, the
 * list is made once and shared: it reads every source record and every
 * essay, which took several seconds of each build for each kind of page.
 */
export function casePreviewList(records?: SourceRecord[], texts?: Record<string, string>): CasePreviewList {
	if (records === undefined && texts === undefined) return (defaultPreviewList ??= makeCasePreviewList([...sources().values()], essaysInGit()));
	return makeCasePreviewList(records ?? [...sources().values()], texts ?? essaysInGit());
}

let defaultPreviewsById: Map<string, CasePreview> | undefined;

/** A case's preview from the shared list, by the case's key. */
export function casePreviewOf(key: string): CasePreview | undefined {
	defaultPreviewsById ??= new Map(casePreviewList().cases.map((preview) => [preview.id, preview]));
	return defaultPreviewsById.get(key);
}

function makeCasePreviewList(records: SourceRecord[], texts: Record<string, string>): CasePreviewList {
	const holdings = boxHoldings(texts, records);
	const cases: CasePreview[] = [];
	const citations: Record<string, string> = {};
	for (const record of records) {
		const citation = record.citation as SourceRecord['citation'] & { type?: string };
		if (citation.type !== 'legal_case' || !citation.title) continue;
		const parts = citation.issued?.['date-parts']?.[0];
		const reporter = [citation.volume, citation['container-title'], citation.page].filter(Boolean).join(' ');
		// Every case links its own page (src/routes/cases/[id]), Trevor, Nov. 24, 2026.
		const link = `/cases/${record.key}`;
		cases.push({
			id: record.key,
			name: citation.title,
			citation: [reporter, parts?.[0] ? `(${parts[0]})` : ''].filter(Boolean).join(' '),
			court: citation.authority ?? '',
			decided: decidedText(parts),
			holding: shortHolding(holdings[record.key]),
			link
		});
		for (const key of citationsOf(record)) citations[key] ??= record.key;
	}
	cases.sort((a, b) => a.name.localeCompare(b.name));
	return { cases, citations };
}

/**
 * Where a case's name in an essay links, its own page, by source key, for
 * the essay renderer in the Worker (src/lib/essays/render.ts).
 */
export function caseLinks(list: CasePreviewList = casePreviewList()): Record<string, string> {
	return Object.fromEntries(list.cases.map((preview) => [preview.id, preview.link]));
}
