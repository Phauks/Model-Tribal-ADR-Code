/**
 * The removals of Native nations for the Removals page (/nations/removals) and each journey's page (/nations/removals/<journey>), as Trevor approved them in the v2 mockups (Nov. 28, 2026, design/removals-page).
 *
 * Read while the site is built, from three files:
 *
 * - research/historic-maps/removals/removals.json: each stage of each journey, with the land left and the land sent to, the years, the legal basis and the nations today;
 * - site/geography/removals.json: the same stages placed on the map, one point for each end (tools/removal-places.mjs);
 * - research/historic-maps/removals/evidence.json: for each journey, the record of the order, the move and the force, each item with its date, a plain sentence, its verbatim quotation and citation, and links to the nation's own account; and the project's finding on each journey (the kind of move, the strength of the record, and how its arrow is drawn).
 *
 * Items read only in a catalog, or recalled without being read, are left out until they are read (research/analyses/2026-11-27-removal-evidence-all-journeys.md).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { CitationMark } from '../citation-marks.ts';
import { escapeHtml } from '../escape-html.ts';
import { displayName, stateName } from '../nation-labels.ts';
import { namesInWords, type RemovalArrow, type RemovalArrowStyle, type RemovalJourneyLine, type RemovalMove } from '../removal-journeys.ts';
import { nations, repositoryRoot, sources } from './content.ts';
import { isLawRecord, recordName } from './law-records.ts';
import { SourceUses, type SourceEntry } from './source-uses.ts';

interface StageRecord {
	id: string;
	journey: string;
	people: string;
	nations: string[];
	years: number[];
	kind: string;
	from: { description: string; states?: string[] };
	to: { description: string };
	legal_basis: { treaty_key?: string; citation?: string; article?: string }[];
	sources?: { url: string; what: string }[];
}

interface PlacedStage {
	id: string;
	from: { point?: [number, number] };
	to: { point?: [number, number] };
}

interface EvidenceItem {
	category: 'A' | 'B' | 'C' | 'nation-account';
	description: string;
	citation: string;
	url?: string;
	quote?: string;
	verified: string;
	date?: string;
	sentence?: string;
	source?: string;
	title?: string;
	/** A nation's link whose pages were not found to give an account of the removal: kept in the file, left off the page. */
	no_account?: boolean;
}

interface EvidenceFile {
	findings: Record<string, { move: RemovalMove; record: 'strong' | 'moderate' | 'thin'; arrow: RemovalArrowStyle; summary: string }>;
	journeys: Record<string, EvidenceItem[]>;
}

/** A law that ordered or agreed to a move: its citation, and its page on this site where it has one. */
export interface RemovalOrder {
	citation: string;
	/** The law's name on this site, such as "Treaty with the Cherokee (1835)", or the act's own words, such as "Act of May 8, 1872, ch. 141". */
	name?: string;
	link?: string;
}

/** One journey, as the Removals page's map, details and table show it. */
export interface RemovalJourney extends RemovalJourneyLine {
	peopleFull: string;
	years: [number, number];
	move: RemovalMove;
	record: 'strong' | 'moderate' | 'thin';
	summary: string;
	/** The states the nation was moved from, by name. */
	from: string[];
	fromDescription: string;
	to: string;
	toDescription: string;
	orderedBy: RemovalOrder[];
	/** What ordered the move where no treaty or statute is cited, such as "Army orders". */
	orderedOtherwise: string;
	nations: { id: string; name: string }[];
	/** The land left, where no arrow can be drawn because the land sent to has no place on the map, such as "Texas (then outside the United States)". */
	origin?: [number, number];
	counts: { order: number; move: number; force: number };
}

/** One record of the order, the move or the force. */
export interface RemovalEvidence {
	/** "Dec. 29, 1835", "May 1838" or "1838". */
	date: string;
	sentence: string;
	/** The verbatim quotation, its ending made a spaced ellipsis where it stops mid-sentence. */
	quote: string;
	citation: string;
	marks: CitationMark[];
}

/** A link to the nation's own account, never quoted. */
export interface RemovalAccount {
	title: string;
	url: string;
	detail: string;
}

export interface RemovalJourneyPage {
	journey: RemovalJourney;
	order: RemovalEvidence[];
	move: RemovalEvidence[];
	force: RemovalEvidence[];
	accounts: RemovalAccount[];
	sources: SourceEntry[];
	/** How many journeys there are, for the side column. */
	total: number;
}

const readJson = <Shape>(relativePath: string): Shape => JSON.parse(readFileSync(path.join(repositoryRoot, relativePath), 'utf8')) as Shape;

const shown = (item: EvidenceItem) => item.verified !== 'memory' && item.verified !== 'catalog-only';

const months = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];

/** "1835-12-29" as "Dec. 29, 1835", "1838-05" as "May 1838", "1838" as itself. */
export function evidenceDate(iso: string | undefined): string {
	if (!iso) return '';
	const [year, month, day] = iso.split('-').map(Number);
	if (!month) return String(year);
	if (!day) return `${months[month - 1]} ${year}`;
	return `${months[month - 1]} ${day}, ${year}`;
}

/** A quotation that stops at a comma, semicolon or colon ends in a spaced ellipsis, as the project's quotations do (Indigo Book; project style, Nov. 26, 2026). */
export function quotationText(quote: string): string {
	const text = quote.trim();
	return /[,;:]$/.test(text) ? `${text.slice(0, -1)} . . . .` : text;
}

/** The research's notes to itself inside a citation, such as "pin page approximate" or what a scan's OCR reads: kept in the file, left off the page. */
const researchNote = /OCR|\bscan\b|approx|unconfirmed|not confirmed|uncertain|not printed/i;

/** Clauses split at semicolons outside any parentheses or brackets. */
function clauses(text: string): string[] {
	const parts: string[] = [];
	let depth = 0;
	let start = 0;
	for (let index = 0; index < text.length; index += 1) {
		const character = text[index];
		if (character === '(' || character === '[') depth += 1;
		else if (character === ')' || character === ']') depth -= 1;
		else if (character === ';' && depth === 0) {
			parts.push(text.slice(start, index));
			start = index + 1;
		}
	}
	parts.push(text.slice(start));
	return parts.map((part) => part.trim()).filter(Boolean);
}

/** A citation as the page shows it: without the research's notes to itself, in a trailing clause, a parenthetical or a closing "Note:". */
export function shownCitation(citation: string): string {
	let text = citation.replace(/\.?\s+Note: .*$/, '');
	// Each parenthetical, innermost first, keeps only its clauses that are not notes; an empty one goes.
	let previous = '';
	while (previous !== text) {
		previous = text;
		text = text.replace(/\s*\(([^()]*)\)/g, (whole, inside: string) => {
			if (!researchNote.test(inside)) return whole.replace('(', '\u0000').replace(')', '\u0001');
			const kept = clauses(inside).filter((clause) => !researchNote.test(clause));
			return kept.length > 0 ? ` \u0000${kept.join('; ')}\u0001` : '';
		});
	}
	text = text.replaceAll('\u0000', '(').replaceAll('\u0001', ')');
	return clauses(text)
		.filter((clause, index) => index === 0 || !researchNote.test(clause))
		.join('; ')
		.replace(/\s+,/g, ',')
		.trim();
}

/** The first part of a description, before any semicolon or parenthesis: "Cherokee Nation west of Arkansas and Missouri". */
function shortPlace(description: string): string {
	return description.split(/[;(]/)[0].trim().replace(/,$/, '');
}

/** Where no treaty or statute is cited, what the first stage says ordered the move. */
const otherwise: Record<string, string> = { military: 'Army orders', executive: 'Executive order', statute: 'Act of Congress' };

/** The laws with a page on this site, by Statutes at Large citation ("7 Stat. 478"). */
let lawsByCitation: Map<string, string[]> | undefined;
function lawsAt(citation: string): string[] {
	if (!lawsByCitation) {
		lawsByCitation = new Map();
		for (const record of sources().values()) {
			if (!isLawRecord(record)) continue;
			const notes = (record as { notes?: string }).notes ?? '';
			const citation = record.citation as { title?: string; 'container-title'?: string; volume?: string; page?: string };
			// The Statutes at Large's own volume and page, else the citation in the record's title or notes.
			const atLarge = citation['container-title'] === 'United States Statutes at Large' && citation.volume && citation.page ? [citation.volume, String(citation.page).split(/[-–]/)[0]] : undefined;
			const found = atLarge ?? /(\d+) Stat\. (\d+)\b/.exec(citation.title ?? '')?.slice(1) ?? /Indigo Book citation:[^.]*?(\d+) Stat\. (\d+)\b/.exec(notes)?.slice(1);
			if (!found) continue;
			const key = `${found[0]} Stat. ${found[1]}`;
			lawsByCitation.set(key, [...(lawsByCitation.get(key) ?? []), record.key]);
		}
	}
	return lawsByCitation.get(citation) ?? [];
}

/** The law behind a stage's legal basis, with its page here: the treaty the research names (without the Oklahoma State University database's number), else the one law at that citation. */
function orderOf(basis: StageRecord['legal_basis'][number]): RemovalOrder | undefined {
	const citation = basis.citation ?? '';
	if (!/^\d+ Stat\. \d+$/.test(citation)) return undefined;
	const keys = lawsAt(citation);
	const named = basis.treaty_key?.replace(/-\d{4}$/, '');
	const key = named && keys.includes(named) ? named : keys.length === 1 ? keys[0] : undefined;
	if (key) return { citation, name: recordName(key).name, link: `/laws/${key}` };
	const act = /^(Act of [A-Z][a-z]+\.? \d{1,2}, \d{4}, ch\. \d+)/.exec(basis.article ?? '')?.[1];
	return { citation, name: act };
}

let built: { journeys: RemovalJourney[]; evidence: EvidenceFile; stages: Map<string, StageRecord[]> } | undefined;

function build() {
	if (built) return built;
	const research = readJson<{ removals: StageRecord[] }>('research/historic-maps/removals/removals.json').removals;
	const placed = new Map(readJson<{ removals: PlacedStage[] }>('site/geography/removals.json').removals.map((stage) => [stage.id, stage]));
	const evidence = readJson<EvidenceFile>('research/historic-maps/removals/evidence.json');
	const names = new Map(nations().map((nation) => [nation.id, displayName(nation.names.official)]));
	const stages = new Map<string, StageRecord[]>();
	for (const stage of research) stages.set(stage.journey, [...(stages.get(stage.journey) ?? []), stage]);
	const journeys: RemovalJourney[] = [];
	for (const [id, list] of stages) {
		const first = list[0];
		const last = list[list.length - 1];
		const finding = evidence.findings[id];
		if (!finding) throw new Error(`The removal journey ${id} has no finding in evidence.json`);
		const years = list.flatMap((stage) => stage.years);
		const people = /^(.*?)\s*\((.*)\)\s*$/.exec(first.people)?.[1] ?? first.people;
		const orderedBy: RemovalOrder[] = [];
		for (const stage of list) {
			for (const basis of stage.legal_basis) {
				const order = orderOf(basis);
				if (order && !orderedBy.some((known) => known.citation === order.citation)) orderedBy.push(order);
			}
		}
		const arrows: RemovalArrow[] = list.flatMap((stage) => {
			const points = placed.get(stage.id);
			return points?.from.point && points.to.point ? [{ from: points.from.point, to: points.to.point, years: [Math.min(...stage.years), Math.max(...stage.years)] as [number, number] }] : [];
		});
		const origin = arrows.length === 0 ? (placed.get(first.id)?.from.point ?? undefined) : undefined;
		const items = (evidence.journeys[id] ?? []).filter(shown);
		const nationIds = [...new Set(list.flatMap((stage) => stage.nations))];
		const states = (first.from.states ?? []).map(stateName);
		journeys.push({
			id,
			people,
			peopleFull: first.people,
			years: [Math.min(...years), Math.max(...years)],
			move: finding.move,
			record: finding.record,
			arrow: finding.arrow,
			summary: finding.summary,
			arrows,
			from: states.length > 0 ? states : [shortPlace(first.from.description)],
			fromDescription: shortPlace(first.from.description),
			to: shortPlace(last.to.description),
			toDescription: last.to.description,
			orderedBy,
			orderedOtherwise: otherwise[first.kind] ?? 'None Identified',
			nations: nationIds.map((nation) => ({ id: nation, name: names.get(nation) ?? nation })),
			origin,
			counts: { order: items.filter((item) => item.category === 'A').length, move: items.filter((item) => item.category === 'B').length, force: items.filter((item) => item.category === 'C').length }
		});
	}
	journeys.sort((first, second) => first.years[0] - second.years[0] || first.people.localeCompare(second.people, 'en'));
	built = { journeys, evidence, stages };
	return built;
}

/** Every journey, in the order they began. */
export function removalJourneys(): RemovalJourney[] {
	return build().journeys;
}

/** The Removals page's References: each document the journeys' stages were compiled from, once, by the journey that first cites it. */
export function removalSources(): SourceEntry[] {
	const { journeys, stages } = build();
	const uses = new SourceUses((key) => key);
	for (const journey of journeys) {
		uses.part(journey.peopleFull);
		for (const stage of stages.get(journey.id) ?? []) {
			for (const source of stage.sources ?? []) {
				uses.add(`<a href="${escapeHtml(source.url)}">${escapeHtml(source.what)}</a>`, { section: 'Journeys', text: journey.peopleFull });
			}
		}
	}
	return uses.list;
}

/** One journey's page: its record in three parts, the nation's own accounts, and its References. */
export function removalJourneyPage(id: string): RemovalJourneyPage | undefined {
	const { journeys, evidence } = build();
	const journey = journeys.find((entry) => entry.id === id);
	if (!journey) return undefined;
	const items = (evidence.journeys[id] ?? []).filter(shown);
	const links = new Map<string, string>();
	for (const item of items) if (item.source && item.url && !links.has(item.source)) links.set(item.source, item.url);
	const uses = new SourceUses((key) => (links.has(key) ? `<a href="${escapeHtml(links.get(key)!)}">${escapeHtml(key)}</a>` : escapeHtml(key)));
	const part = (category: EvidenceItem['category'], heading: string): RemovalEvidence[] => {
		uses.part(heading);
		return items
			.filter((item) => item.category === category)
			.map((item, index) => ({ item, index }))
			.sort((first, second) => (first.item.date ?? '').localeCompare(second.item.date ?? '') || first.index - second.index)
			.map(({ item }) => {
				if (!item.date || !item.sentence || !item.source) throw new Error(`An evidence item of ${id} has no date, sentence or source: ${item.citation}`);
				const marks: CitationMark[] = [];
				uses.cite(item.source, { section: heading, text: item.sentence, where: shownCitation(item.citation) }, marks);
				return { date: evidenceDate(item.date), sentence: item.sentence, quote: quotationText(item.quote ?? ''), citation: shownCitation(item.citation), marks };
			});
	};
	const order = part('A', 'The order');
	const move = part('B', 'The move');
	const force = part('C', 'The force');
	const accounts = items
		.filter((item) => item.category === 'nation-account' && item.url && !item.no_account)
		.map((item) => ({ title: item.title ?? item.citation, url: item.url!, detail: item.sentence ?? '' }));
	return { journey, order, move, force, accounts, sources: uses.list, total: journeys.length };
}
