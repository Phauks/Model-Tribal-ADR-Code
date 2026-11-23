/**
 * The case previews and citation index (src/lib/case-links.ts), built with
 * the site from the source records and the case boxes in the essays. A case
 * links to its box in an essay when it has one, so the reader lands on the
 * project's summary with its reading links; otherwise to the copy of the
 * opinion on this site, or to where the opinion was published.
 */
import { citationKey, parseCitation, type CasePreview, type CasePreviewList } from '../case-links.ts';
import { formatCaptureDate } from './markdown.ts';
import { publicCopyFor, sources, type SourceRecord } from './content.ts';
import { copyPath } from '../public-copies.ts';
import { boxPages } from './essays.ts';
import { essaysInGit } from './essay-library.ts';

/** The holding part of each case box, as plain text, by source key. */
export function boxHoldings(texts: Record<string, string>): Record<string, string> {
	const holdings: Record<string, string> = {};
	for (const text of Object.values(texts)) {
		for (const box of text.matchAll(/^:{4,}[ \t]*case[ \t]+([a-z0-9-]+)[ \t]*\n([\s\S]*?)^:{4,}[ \t]*$/gm)) {
			const holding = /^:::[ \t]*holding[ \t]*\n([\s\S]*?)^:::[ \t]*$/m.exec(box[2])?.[1];
			if (!holding || holdings[box[1]]) continue;
			holdings[box[1]] = holding
				.replace(/\s*\[@[^\]]*\]/g, '')
				.replace(/\[\[([a-z0-9-]+)\|([^\]]+)\]\]/g, '$2')
				.replace(/\[\[([a-z0-9-]+)\]\]/g, '$1')
				.replace(/[*_]/g, '')
				.replace(/\s+/g, ' ')
				.trim();
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

export function casePreviewList(
	records: SourceRecord[] = [...sources().values()],
	texts: Record<string, string> = essaysInGit()
): CasePreviewList {
	const pages = boxPages(texts);
	const holdings = boxHoldings(texts);
	const cases: CasePreview[] = [];
	const citations: Record<string, string> = {};
	for (const record of records) {
		const citation = record.citation as SourceRecord['citation'] & { type?: string };
		if (citation.type !== 'legal_case' || !citation.title) continue;
		const parts = citation.issued?.['date-parts']?.[0];
		const reporter = [citation.volume, citation['container-title'], citation.page].filter(Boolean).join(' ');
		const box = pages[`case-${record.key}`];
		const copy = publicCopyFor(record.original_link) ?? publicCopyFor(citation.URL);
		const original = record.original_link ?? citation.URL;
		const link = box ? `${box}#case-${record.key}` : copy ? copyPath(copy) : original;
		if (!link) continue;
		cases.push({
			id: record.key,
			name: citation.title,
			citation: [reporter, parts?.[0] ? `(${parts[0]})` : ''].filter(Boolean).join(' '),
			court: citation.authority ?? '',
			decided: decidedText(parts),
			holding: shortHolding(holdings[record.key]),
			link,
			opens: box ? 'box' : copy ? 'copy' : 'original'
		});
		for (const key of citationsOf(record)) citations[key] ??= record.key;
	}
	cases.sort((a, b) => a.name.localeCompare(b.name));
	return { cases, citations };
}
