/**
 * The lines under a case or law box's heading on the website, the same as
 * caseFacts() and lawFacts() in pdf/pipeline/typst-writer.mjs give the book
 * (docs/style-guide.md, section 5.1): when the case was decided, the nations
 * or peoples it concerns, and for the Supreme Court of the United States the
 * Court, the vote and who wrote and joined what, each opinion's writer in
 * bold with the opinion named. Each line is a label and a value in HTML.
 *
 * Runs at build time (vite.config.ts, "virtual:essay-library").
 */
import { displayName } from '../nation-labels.ts';
import { escapeHtml } from './markdown.ts';

export type FactLine = [label: string, html: string];

interface Justice {
	name: string;
	vote: string;
	opinion?: string;
}

export interface CaseRecord {
	citation?: { type?: string; issued?: { 'date-parts'?: number[][] } };
	tribes?: string[];
	supreme_court?: {
		court: string;
		decision_type?: string;
		vote?: { majority?: number | null; minority?: number | null };
		justices?: Justice[];
	};
}

const opinionLabels: Record<string, string> = {
	majority: 'opinion of the Court',
	plurality: 'plurality opinion',
	concurrence: 'concurring opinion',
	'special concurrence': 'opinion concurring in the judgment',
	'concurrence in the result': 'concurring in the result',
	judgment: 'opinion announcing the judgment',
	dissent: 'dissenting opinion'
};

// Decisions with no signed opinion of the Court, shown as their own line.
const decisionLabels: Record<string, string> = {
	'per curiam': 'Per curiam',
	'equally divided Court': 'Affirmed by an equally divided Court',
	'judgment of the Court': 'No opinion for a majority'
};

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function surname(name: string): string {
	return name.replace(/,?\s+(?:Jr\.|Sr\.|II|III)$/, '').trim().split(/\s+/).pop() ?? name;
}

function justiceList(justices: Justice[]): string {
	return justices
		.map((justice) => {
			const label = justice.opinion ? (opinionLabels[justice.opinion] ?? justice.opinion) : null;
			const name = escapeHtml(surname(justice.name));
			return label ? `<strong>${name}</strong> (${escapeHtml(label)})` : name;
		})
		.join(', ');
}

/** The full decision date of a case record, such as "March 18, 1831", or null. */
export function decisionDate(record: CaseRecord): string | null {
	const parts = record.citation?.issued?.['date-parts']?.[0] ?? [];
	if (parts.length < 3) return null;
	return `${months[parts[1] - 1]} ${parts[2]}, ${parts[0]}`;
}

function nationLine(record: CaseRecord, nations: Map<string, { name: string; entityType: string }>): FactLine | null {
	if (!Array.isArray(record.tribes) || record.tribes.length === 0) return null;
	const names = record.tribes.map((id) => {
		const nation = nations.get(id);
		return nation ? displayName(nation.name) : id;
	});
	const peoples = record.tribes.filter((id) => {
		const kind = nations.get(id)?.entityType;
		return kind !== undefined && kind !== 'native-nation';
	}).length;
	const plural = names.length > 1;
	const label =
		peoples === 0 ? (plural ? 'Nations' : 'Nation') : peoples === names.length ? (plural ? 'Peoples' : 'People') : 'Nations and peoples';
	return [label, escapeHtml(names.join('; '))];
}

/** The lines under a case box's heading. */
export function caseFacts(record: CaseRecord, nations: Map<string, { name: string; entityType: string }>): FactLine[] {
	const facts: FactLine[] = [];
	const decided = decisionDate(record);
	if (decided) facts.push(['Decided', escapeHtml(decided)]);
	const nationFact = nationLine(record, nations);
	if (nationFact) facts.push(nationFact);
	const bench = record.supreme_court;
	if (bench) {
		facts.push(['Court', escapeHtml(bench.court)]);
		const { majority, minority } = bench.vote ?? {};
		if (Number.isInteger(majority) && Number.isInteger(minority)) facts.push(['Vote', `${majority}–${minority}`]);
		const decision = bench.decision_type ? decisionLabels[bench.decision_type] : undefined;
		if (decision) facts.push(['Decision', escapeHtml(decision)]);
		const justices = bench.justices ?? [];
		const inMajority = justices.filter((justice) => justice.vote === 'majority');
		const inMinority = justices.filter((justice) => justice.vote === 'minority');
		const unrecorded = justices.filter((justice) => justice.vote === 'not recorded');
		const absent = justices.filter((justice) => !['majority', 'minority', 'not recorded'].includes(justice.vote));
		// Opinion writers first: the opinion of the Court, then other
		// opinions, then the justices who joined without writing.
		const leads = (justice: Justice) => ['majority', 'plurality', 'judgment'].includes(justice.opinion ?? '');
		const writersFirst = (list: Justice[]) => [
			...list.filter(leads),
			...list.filter((justice) => justice.opinion && !leads(justice)),
			...list.filter((justice) => !justice.opinion)
		];
		if (inMajority.length) facts.push(['Majority', justiceList(writersFirst(inMajority))]);
		if (inMinority.length) facts.push(['Dissent', justiceList(writersFirst(inMinority))]);
		if (unrecorded.length) facts.push(['Vote not recorded', justiceList(unrecorded)]);
		if (absent.length) facts.push(['Did not participate', justiceList(absent)]);
	}
	return facts;
}

/** The lines under a law box's heading: the nations or peoples it names. */
export function lawFacts(record: CaseRecord, nations: Map<string, { name: string; entityType: string }>): FactLine[] {
	const nationFact = nationLine(record, nations);
	return nationFact ? [nationFact] : [];
}
