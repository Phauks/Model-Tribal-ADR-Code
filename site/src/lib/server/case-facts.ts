/**
 * The lines under a case or law box's heading on the website, the same as
 * caseFacts() and lawFacts() in pdf/pipeline/typst-writer.mjs give the book
 * (docs/style-guide.md, section 5.1): the case's dates in order (argued,
 * reargued, decided, amended and the like, from the record's court_dates
 * block and its decision date), the nations
 * or peoples it concerns, and for the Supreme Court of the United States the
 * Court, the vote and who wrote and joined what, each opinion's writer in
 * bold with the opinion named. Each line is a label and a value in HTML.
 *
 * Runs at build time (vite.config.ts, "virtual:essay-library").
 */
import { displayName } from '../nation-labels.ts';
import { escapeHtml } from '../escape-html.ts';
import { courtPath } from './supreme-courts.ts';
import { opinionLabels, surname } from '../case-opinions.ts';
import { decidedDay, justicePath, personForCase } from './supreme-court-people.ts';

export type FactLine = [label: string, html: string];

interface Justice {
	name: string;
	vote: string;
	opinion?: string;
}

/** A record's court_dates block: each kind of date as days, YYYY-MM-DD (schemas/source.schema.json). */
export type CourtDates = Partial<Record<CourtDateKind, string[]>>;

type CourtDateKind = (typeof courtDateLabels)[number][0];

export interface CaseRecord {
	citation?: { type?: string; issued?: { 'date-parts'?: number[][] } };
	court_dates?: CourtDates;
	tribes?: string[];
	supreme_court?: {
		court: string;
		decision_type?: string;
		vote?: { majority?: number | null; minority?: number | null };
		justices?: Justice[];
	};
}

// Decisions with no signed opinion of the Court, shown as their own line.
const decisionLabels: Record<string, string> = {
	'per curiam': 'Per curiam',
	'equally divided Court': 'Affirmed by an equally divided Court',
	'judgment of the Court': 'No opinion for a majority'
};

// Each kind of date and its label, in the order used when two fall on the same day.
const courtDateLabels = [
	['argued', 'Argued'],
	['argued_and_submitted', 'Argued and submitted'],
	['heard', 'Heard'],
	['submitted', 'Submitted'],
	['reargued', 'Reargued'],
	['decided', 'Decided'],
	['filed', 'Filed'],
	['rehearing_denied', 'Rehearing denied'],
	['rehearing_en_banc_denied', 'Rehearing en banc denied'],
	['amended', 'Amended']
] as const;

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** The Justices' names, each linked to the Justice's page (src/routes/supreme-court/justices), writers in bold with the opinion named. */
function justiceList(justices: Justice[], decided: string | undefined): string {
	return justices
		.map((justice) => {
			const label = justice.opinion ? (opinionLabels[justice.opinion] ?? justice.opinion) : null;
			const path = justicePath(personForCase(justice.name, decided, surname(justice.name)));
			const name = `<a href="${path}">${escapeHtml(surname(justice.name))}</a>`;
			return label ? `<strong>${name}</strong> (${escapeHtml(label)})` : name;
		})
		.join(', ');
}

/**
 * Days as one date: "May 11, 1988", "February 17–19, 1823", "April 15 and
 * 17, 1823", or for days in different months "December 30, 1831, and
 * January 2, 1832".
 */
export function courtDays(days: string[]): string {
	const groups: { year: number; month: number; days: number[] }[] = [];
	for (const day of [...days].sort()) {
		const [year, month, date] = day.split('-').map(Number);
		const last = groups.at(-1);
		if (last && last.year === year && last.month === month) last.days.push(date);
		else groups.push({ year, month, days: [date] });
	}
	const parts = groups.map(({ year, month, days: dates }) => {
		const runs: string[] = [];
		for (let index = 0; index < dates.length; ) {
			let end = index;
			while (end + 1 < dates.length && dates[end + 1] === dates[end] + 1) end++;
			runs.push(end > index ? `${dates[index]}–${dates[end]}` : String(dates[index]));
			index = end + 1;
		}
		const joined = runs.length > 1 ? `${runs.slice(0, -1).join(', ')} and ${runs.at(-1)}` : runs[0];
		return `${months[month - 1]} ${joined}, ${year}`;
	});
	return parts.length > 1 ? `${parts.slice(0, -1).join(', ')}, and ${parts.at(-1)}` : parts[0];
}

/** The case's dates, each its own line, in the order they happened. */
export function dateLines(record: CaseRecord): FactLine[] {
	const parts = record.citation?.issued?.['date-parts']?.[0] ?? [];
	const decided = parts.length >= 3 ? [`${parts[0]}-${String(parts[1]).padStart(2, '0')}-${String(parts[2]).padStart(2, '0')}`] : [];
	const dates: Record<string, string[] | undefined> = { ...record.court_dates, decided };
	return courtDateLabels
		.map(([kind, label], order) => ({ label, order, days: dates[kind] ?? [] }))
		.filter((line) => line.days.length > 0)
		.sort((first, second) => [...first.days].sort()[0].localeCompare([...second.days].sort()[0]) || first.order - second.order)
		.map((line): FactLine => [line.label, escapeHtml(courtDays(line.days))]);
}

/**
 * The nations or peoples a case or law names, each linking its nation page
 * (Trevor, Nov. 23, 2026: "nations in cases should be linkable to the
 * nation"). A nation with no page here is named without a link.
 */
function nationLine(record: CaseRecord, nations: ReadonlyMap<string, { name: string; entityType: string }>): FactLine | null {
	if (!Array.isArray(record.tribes) || record.tribes.length === 0) return null;
	const names = record.tribes.map((id) => {
		const nation = nations.get(id);
		return nation ? `<a href="/nations/${encodeURIComponent(id)}">${escapeHtml(displayName(nation.name))}</a>` : escapeHtml(id);
	});
	const peoples = record.tribes.filter((id) => {
		const kind = nations.get(id)?.entityType;
		return kind !== undefined && kind !== 'native-nation';
	}).length;
	const plural = names.length > 1;
	const label =
		peoples === 0 ? (plural ? 'Nations' : 'Nation') : peoples === names.length ? (plural ? 'Peoples' : 'People') : 'Nations and peoples';
	return [label, names.join('; ')];
}

/** The lines under a case box's heading. */
export function caseFacts(record: CaseRecord, nations: ReadonlyMap<string, { name: string; entityType: string }>): FactLine[] {
	const facts: FactLine[] = dateLines(record);
	const nationFact = nationLine(record, nations);
	if (nationFact) facts.push(nationFact);
	const bench = record.supreme_court;
	if (bench) {
		// The Court's name links to its page (src/routes/supreme-court/[court]) when it has one.
		const path = courtPath(bench.court);
		facts.push(['Court', path ? `<a href="${path}">${escapeHtml(bench.court)}</a>` : escapeHtml(bench.court)]);
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
		const decided = decidedDay(record.citation?.issued);
		if (inMajority.length) facts.push(['Majority', justiceList(writersFirst(inMajority), decided)]);
		if (inMinority.length) facts.push(['Dissent', justiceList(writersFirst(inMinority), decided)]);
		if (unrecorded.length) facts.push(['Vote not recorded', justiceList(unrecorded, decided)]);
		if (absent.length) facts.push(['Did not participate', justiceList(absent, decided)]);
	}
	return facts;
}

/** The lines under a law box's heading: the nations or peoples it names. */
export function lawFacts(record: CaseRecord, nations: ReadonlyMap<string, { name: string; entityType: string }>): FactLine[] {
	const nationFact = nationLine(record, nations);
	return nationFact ? [nationFact] : [];
}
