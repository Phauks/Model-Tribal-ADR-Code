/**
 * The rows of the Find recourse page: the dispute resolution provisions read
 * from Native nations' own law codes, court rules and ordinances
 * (research/tribal-law/provisions.csv). Trevor chose this view on Nov. 23,
 * 2026, as the first of the site's data views.
 *
 * Only provisions about dispute resolution are listed (scope
 * "dispute-resolution", not "borderline"), each once (rows that repeat
 * another are left out), and never one the second reader marked to drop.
 * Each row says whether a second reader has checked it, so the page can mark
 * the rest as read only once.
 *
 * Runs at build time only, like content.ts.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseCsv } from '../csv.ts';
import { displayName, recognitionLabel, stateName } from '../nation-labels.ts';
import { recognitionFacetValues, type RecourseRow } from '../recourse.ts';
import { methods, nations, publicCopyFor, publicCopyWithDigest, repositoryRoot } from './content.ts';
import { copyPagePath } from '../public-copies.ts';

/** The second reader's verdicts that mean a person or second reader confirmed the row, or corrected it. */
const checkedVerdicts = new Set(['confirm', 'change']);

function sentenceCase(text: string): string {
	return text.charAt(0).toLocaleUpperCase('en') + text.slice(1);
}

function spaced(slug: string): string {
	return sentenceCase(slug.replaceAll('-', ' '));
}

let rowCache: RecourseRow[] | undefined;

/** How Find recourse names a method, so a link can tick it there (src/lib/recourse.ts, recourseLink). */
export function recourseMethodLabel(methodId: string): string {
	return sentenceCase(methods().get(methodId)?.name ?? spaced(methodId));
}

export function recourseRows(): RecourseRow[] {
	if (rowCache) return rowCache;
	const text = readFileSync(path.join(repositoryRoot, 'research/tribal-law/provisions.csv'), 'utf8').normalize('NFC');
	const records = new Map(nations().map((record) => [record.id, record]));
	const methodRecords = methods();
	const rows: RecourseRow[] = [];
	for (const provision of parseCsv(text)) {
		if (provision.duplicate_of || provision.scope !== 'dispute-resolution') continue;
		if (provision.second_pass_verdict === 'drop') continue;
		const record = records.get(provision.nation);
		if (!record) continue;
		const states = [...new Set((record.states ?? []).map((fact) => fact.state))];
		const copy = publicCopyWithDigest(provision.sha256) ?? publicCopyFor(provision.url);
		const method = provision.method || 'other';
		rows.push({
			id: provision.id,
			nation: { id: record.id, name: displayName(record.names.official) },
			states: states.map(stateName),
			recognition: recognitionFacetValues((record.recognition ?? []).map((fact) => fact.type)).map((type) =>
				recognitionLabel(type)
			),
			method: sentenceCase(methodRecords.get(method)?.name ?? spaced(method)),
			subject: spaced(provision.subject_area || 'other'),
			setting: provision.setting || 'other',
			entry: provision.entry || 'not-stated',
			outcome: provision.outcome || 'not-stated',
			citation:
				provision.citation ||
				[provision.document, provision.locator].filter(Boolean).join(', ') ||
				'Section not identified in the published text',
			summary: provision.summary,
			link: copy ? copyPagePath(copy) : provision.url || undefined,
			original: provision.url || undefined,
			checked: checkedVerdicts.has(provision.second_pass_verdict)
		});
	}
	rows.sort(
		(first, second) =>
			first.nation.name.localeCompare(second.nation.name, 'en', { sensitivity: 'base' }) ||
			first.citation.localeCompare(second.citation, 'en', { numeric: true })
	);
	rowCache = rows;
	return rows;
}
