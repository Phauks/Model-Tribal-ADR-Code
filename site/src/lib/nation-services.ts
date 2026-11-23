/**
 * Groups a nation's courts and dispute resolution services under one heading
 * per kind of service (Courts, Peacemaking, Mediation and so on), and lays out
 * how appeals move between the nation's courts.
 *
 * Trevor asked (Nov. 22, 2026) that a service's kind be shown once, as the
 * heading it sits under, instead of in parentheses after its name, where a
 * name like "Navajo Nation Peacemaking Program (Peacemaking)" said it twice.
 * He also asked that a nation with several courts show their order, from the
 * court that hears a case first to the court that hears the last appeal.
 * Where one court's appeals go comes only from a cited `appeals_to` fact on
 * the court (schemas/tribe.schema.json); it is never worked out from a
 * court's name or kind.
 *
 * Trevor also asked (Nov. 22, 2026) that every court of a nation be listed,
 * such as each of the Navajo Nation's district courts. A court that belongs
 * to a group the records also list, such as "Navajo Nation Judicial District
 * Courts", names the group in a cited `part_of` and is listed under it, with
 * where it sits; it shares the group's place on the path of appeal.
 */
import type { CitationMark } from './citation-marks.ts';
import type { CitedFact } from './server/content.ts';
import { webLink } from './contact-links.ts';
import { humanize, stateName } from './nation-labels.ts';

/** Where a court's appeals go, as a cited fact naming another court in the same record. */
export type AppealFact = CitedFact & { court: string };

/** A court or service as the record stores it, in `justice_institutions` or `dispute_resolution.forums`. */
export type ServiceFact = CitedFact & {
	kind: string;
	name?: string;
	link?: string;
	appeals_to?: AppealFact;
	/** The exact name of the group this court belongs to, another entry in the same record. */
	part_of?: string;
	/** Where the court sits, as its source gives it. */
	location?: { place?: string; state?: string; address?: string };
};

/** One service as the page shows it: its name, a link and, rarely, a detail the heading does not already say. */
export interface ServiceEntry {
	text: string;
	link?: string;
	detail?: string;
	/** Where the court sits, such as "Chinle, Arizona". */
	location?: string;
	/** The courts of a group, such as each district court, listed under it. */
	members?: ServiceEntry[];
	/** The markers of the sources that list the service (src/lib/citation-marks.ts). */
	citations: CitationMark[];
}

/** One step up a path of appeal: the court appeals go to, and the markers of the sources that say so. */
export interface AppealStep {
	court: ServiceEntry;
	citations: CitationMark[];
}

/** One path of appeal, from the court that hears a case first to the highest court it can reach. */
export interface AppealPath {
	/** The courts where cases on this path start; several when they share the rest of the path. */
	first: ServiceEntry[];
	/** Each court appeals go to, in order. */
	then: AppealStep[];
}

/** The services of one kind, under one heading. */
export interface ServiceCategory {
	id: string;
	heading: string;
	/** Courts only: how appeals move, when sources record it. */
	appealPaths: AppealPath[];
	/** The services not on an appeal path. */
	entries: ServiceEntry[];
}

/**
 * Records that a fact supports a line on the page, for the Sources section,
 * and adds its source's marker to `marks`, the markers shown beside that line.
 */
export type Cite = (fact: CitedFact, section: string, text: string, marks: CitationMark[]) => void;

/**
 * The heading for each kind in the records' open vocabularies (decision
 * record 0012). A kind not listed here gets its own heading from its name,
 * or joins Courts when its name says it is a court.
 */
const categories: Record<string, { id: string; heading: string }> = {
	// A nation's judicial branch, or judiciary, is the whole court system, not
	// one court, so it has its own heading rather than a place among the courts.
	'judicial-branch': { id: 'judicial-branch', heading: 'Judicial branch' },
	courts: { id: 'courts', heading: 'Courts' },
	peacemaking: { id: 'peacemaking', heading: 'Peacemaking' },
	'healing-to-wellness-court': { id: 'healing-to-wellness-courts', heading: 'Healing to wellness courts' },
	// Problem-solving courts other than healing to wellness courts, such as a veterans', mental health or DWI court.
	'treatment-court': { id: 'treatment-courts', heading: 'Treatment courts' },
	'traditional-forum': { id: 'traditional-forums', heading: 'Traditional forums' },
	'customary-dispute-resolution': {
		id: 'customary-dispute-resolution',
		heading: 'Customary dispute resolution'
	},
	'elders-council': { id: 'elders-councils', heading: 'Elders councils' },
	'council-hearing': { id: 'council-hearings', heading: 'Council hearings' },
	mediation: { id: 'mediation', heading: 'Mediation' },
	arbitration: { id: 'arbitration', heading: 'Arbitration' },
	'settlement-conference': { id: 'settlement-conferences', heading: 'Settlement conferences' },
	'restorative-justice': { id: 'restorative-justice', heading: 'Restorative justice' },
	'family-group-conference': { id: 'family-group-conferences', heading: 'Family group conferences' },
	'circle-process': { id: 'circle-processes', heading: 'Circle processes' },
	'administrative-adjudication': {
		id: 'administrative-hearings',
		heading: 'Administrative hearings'
	},
	other: { id: 'other', heading: 'Other' }
};

const courtKinds = new Set([
	'tribal-court',
	'court-of-appeals',
	'supreme-court',
	'intertribal-court',
	'intertribal-court-of-appeals',
	'court-of-indian-offenses'
]);

/**
 * For a few court kinds the kind says something the heading "Courts" and the
 * appeal path do not, such as that the court is shared by several nations.
 * The words in `unlessNamed` are how a name already says it.
 */
const courtDetails: Record<string, { detail: string; unlessNamed: RegExp }> = {
	'court-of-indian-offenses': {
		detail: 'Court of Indian Offenses',
		unlessNamed: /indian offenses|\bcfr\b/i
	},
	'intertribal-court': { detail: 'Intertribal court', unlessNamed: /inter-?tribal/i },
	'intertribal-court-of-appeals': { detail: 'Intertribal court', unlessNamed: /inter-?tribal/i }
};

const order = [
	'judicial-branch',
	'courts',
	'peacemaking',
	'healing-to-wellness-courts',
	'treatment-courts',
	'traditional-forums',
	'customary-dispute-resolution',
	'elders-councils',
	'council-hearings',
	'circle-processes',
	'mediation',
	'arbitration',
	'settlement-conferences',
	'family-group-conferences',
	'restorative-justice',
	'administrative-hearings'
];

/** The heading a kind of court or service is listed under on nation pages. */
export function categoryOf(kind: string): { id: string; heading: string } {
	if (courtKinds.has(kind)) return categories.courts;
	if (kind.includes('peacemaking')) return categories.peacemaking;
	const known = categories[kind];
	if (known) return known;
	if (/(^|-)court(s)?($|-)/.test(kind)) return categories.courts;
	return { id: kind, heading: humanize(kind) };
}

/** A name compared without case, accents, punctuation or words in parentheses. */
export function comparableName(name: string): string {
	return name
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLocaleLowerCase('en-US')
		.replace(/\([^)]*\)/g, ' ')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

/** A link compared without its scheme, a leading "www." or a trailing slash. */
function comparableLink(link: string | undefined): string | undefined {
	if (!link) return undefined;
	return link
		.trim()
		.toLocaleLowerCase('en-US')
		.replace(/^https?:\/\//, '')
		.replace(/^www\./, '')
		.replace(/\/+$/, '');
}

/**
 * Names that say only what kind of body it is, such as "Tribal Court", or
 * that are a piece of a web address, such as "judicial-council.aspx". A
 * directory lists these when its page gives no fuller name.
 */
const genericNames = new Set([
	'court',
	'courts',
	'tribal court',
	'tribal courts',
	'judicial branch',
	'judiciary'
]);

function isGeneric(name: string): boolean {
	return genericNames.has(comparableName(name)) || !/\s/.test(name.trim());
}

/**
 * Whether one name is the other with the nation's name in front, such as
 * "Supreme Court" and "Muscogee Creek Supreme Court": a name of two words or
 * more that ends the other name.
 */
function namesOneLevel(first: string, second: string): boolean {
	const [shorter, longer] = [comparableName(first), comparableName(second)].sort(
		(one, two) => one.length - two.length
	);
	if (genericNames.has(shorter) || !shorter.includes(' ')) return false;
	return shorter !== longer && longer.endsWith(` ${shorter}`);
}

interface Merged {
	category: { id: string; heading: string };
	facts: ServiceFact[];
	names: string[];
	kinds: Set<string>;
	links: Set<string>;
	/** The courts that name this entry in `part_of`, merged the same way. */
	members: Merged[];
}

/**
 * Two facts describe the same service when their names match, or when one
 * name only says what kind of body it is and both facts have the same kind
 * and link (two directories listing one court, one of them without its full
 * name). Facts from different sources are kept as separate facts in the
 * record, each with its citation; only the page shows them once.
 */
function sameService(entry: Merged, fact: ServiceFact, name: string): boolean {
	const comparable = comparableName(name);
	if (entry.names.some((other) => comparableName(other) === comparable)) return true;
	if (entry.kinds.has(fact.kind) && entry.names.some((other) => namesOneLevel(other, name))) return true;
	const link = comparableLink(fact.link);
	if (!link || !entry.links.has(link) || !entry.kinds.has(fact.kind)) return false;
	return isGeneric(name) || entry.names.every(isGeneric);
}

/** The name the page shows for merged facts: the fullest name that is not generic. */
function shownName(entry: Merged): string {
	const specific = entry.names.filter((name) => !isGeneric(name));
	const candidates = specific.length > 0 ? specific : entry.names;
	return candidates.reduce((best, name) => (name.length > best.length ? name : best));
}

/** "Chinle, Arizona": the place and state of the first fact that gives them. */
function locationOf(entry: Merged): string | undefined {
	const location = entry.facts.map((fact) => fact.location).find((found) => found?.place || found?.state);
	if (!location) return undefined;
	const parts = [location.place, location.state ? stateName(location.state) : undefined].filter(Boolean);
	return parts.join(', ');
}

function entryFor(entry: Merged): ServiceEntry {
	const text = shownName(entry);
	const link = entry.facts.map((fact) => webLink(fact.link)).find(Boolean);
	let detail: string | undefined;
	if (entry.category.id === 'courts') {
		for (const kind of entry.kinds) {
			const special = courtDetails[kind];
			if (special && !special.unlessNamed.test(text)) detail = special.detail;
		}
	}
	const location = locationOf(entry);
	return { text, link, detail, ...(location ? { location } : {}), citations: [] };
}

/** Adds a fact to the first entry it describes, or to a new entry at the end of `list`. */
function mergeInto(
	list: Merged[],
	fact: ServiceFact,
	name: string,
	category: { id: string; heading: string },
	matches: (entry: Merged) => boolean
): Merged {
	const link = comparableLink(fact.link);
	const existing = list.find(matches);
	if (existing) {
		existing.facts.push(fact);
		if (!existing.names.includes(name)) existing.names.push(name);
		existing.kinds.add(fact.kind);
		if (link) existing.links.add(link);
		return existing;
	}
	const created: Merged = {
		category,
		facts: [fact],
		names: [name],
		kinds: new Set([fact.kind]),
		links: new Set(link ? [link] : []),
		members: []
	};
	list.push(created);
	return created;
}

/**
 * Groups the courts and services of one record by kind and works out the
 * appeal paths between its courts. `cite` records each fact's source under
 * the heading the fact is shown under.
 */
export function nationServices(facts: ServiceFact[], cite: Cite): ServiceCategory[] {
	// A body that hears appeals, or whose decisions are appealed to a court,
	// is shown with the courts even when its kind says otherwise, such as the
	// Seneca Nation's Peacemakers Courts, which are trial courts.
	const appealNames = new Set(
		facts.flatMap((fact) => (fact.appeals_to ? [comparableName(fact.appeals_to.court)] : []))
	);
	// A directory that lists only "Tribal Court" with the address of the
	// judicial branch's own site is describing the judicial branch.
	const judicialLinks = new Set(
		facts.flatMap((fact) => {
			const link = comparableLink(fact.link);
			return fact.kind === 'judicial-branch' && link ? [link] : [];
		})
	);
	// A court is listed under its group only when the group is in the record;
	// otherwise it is listed on its own.
	const allNames = new Set(facts.map((fact) => comparableName(fact.name ?? humanize(fact.kind))));
	// Another listing of the same court, from a source that does not name the
	// group, is listed with it under the group.
	const groupsByName = new Map(
		facts.flatMap((fact) => (fact.part_of && fact.name ? [[comparableName(fact.name), fact.part_of] as const] : []))
	);
	// A court on a path of appeal is shown on the path, not under its group.
	const onAppealPath = new Set(
		facts.flatMap((fact) => [
			...(fact.appeals_to ? [comparableName(fact.appeals_to.court), comparableName(fact.name ?? '')] : [])
		])
	);
	const groupOf = (fact: ServiceFact): string | undefined => {
		const own = comparableName(fact.name ?? '');
		if (onAppealPath.has(own)) return undefined;
		const partOf = fact.part_of ?? groupsByName.get(own);
		if (!partOf) return undefined;
		const group = comparableName(partOf);
		return group !== own && allNames.has(group) ? group : undefined;
	};
	const merged: Merged[] = [];
	for (const fact of facts) {
		if (groupOf(fact)) continue;
		const name = fact.name ?? humanize(fact.kind);
		const onAppealPath = Boolean(fact.appeals_to) || appealNames.has(comparableName(name));
		const link = comparableLink(fact.link);
		const judicialBranchSite = !onAppealPath && isGeneric(name) && link !== undefined && judicialLinks.has(link);
		const category = onAppealPath
			? categories.courts
			: judicialBranchSite
				? categories['judicial-branch']
				: categoryOf(fact.kind);
		mergeInto(
			merged,
			fact,
			name,
			category,
			(entry) =>
				entry.category.id === category.id &&
				(sameService(entry, fact, name) ||
					(category.id === 'judicial-branch' && link !== undefined && entry.links.has(link)))
		);
	}
	// Each court of a group joins the group's entry, merged with another
	// listing of the same court, in the order the record gives them. A group
	// can itself belong to a group (a district with two courthouses), so
	// courts whose group is not placed yet wait for a later round.
	const placed = (entries: Merged[]): Merged[] => entries.flatMap((entry) => [entry, ...placed(entry.members)]);
	let waiting = facts.filter((fact) => groupOf(fact));
	while (waiting.length > 0) {
		const next: ServiceFact[] = [];
		for (const fact of waiting) {
			const group = groupOf(fact)!;
			const parent = placed(merged).find((entry) => entry.names.some((name) => comparableName(name) === group));
			if (!parent) {
				next.push(fact);
				continue;
			}
			const name = fact.name ?? humanize(fact.kind);
			mergeInto(parent.members, fact, name, parent.category, (entry) => sameService(entry, fact, name));
		}
		// Groups that name each other in a loop are never placed; list those courts on their own.
		if (next.length === waiting.length) {
			for (const fact of next) {
				const name = fact.name ?? humanize(fact.kind);
				const category = categoryOf(fact.kind);
				mergeInto(merged, fact, name, category, (entry) => entry.category.id === category.id && sameService(entry, fact, name));
			}
			break;
		}
		waiting = next;
	}

	// The courts of a group, each cited under the group's heading, with their own courts under them.
	const membersOf = (group: Merged, heading: string): ServiceEntry[] =>
		group.members.map((member) => {
			const memberEntry = entryFor(member);
			for (const fact of member.facts) cite(fact, heading, memberEntry.text, memberEntry.citations);
			if (member.members.length > 0) memberEntry.members = membersOf(member, heading);
			return memberEntry;
		});

	const shown = new Map(merged.map((entry) => [entry, entryFor(entry)]));
	for (const entry of merged) {
		const text = shown.get(entry)!.text;
		for (const fact of entry.facts) cite(fact, entry.category.heading, text, shown.get(entry)!.citations);
		if (entry.members.length > 0) shown.get(entry)!.members = membersOf(entry, entry.category.heading);
	}
	const courts = merged.filter((entry) => entry.category.id === 'courts');
	const appealsTo = new Map<Merged, Merged>();
	// The markers for "Appeals go to" above each court, from every appeals_to fact that names it.
	const appealMarks = new Map<Merged, CitationMark[]>();
	for (const entry of courts) {
		for (const fact of entry.facts) {
			const appeal = fact.appeals_to;
			if (!appeal) continue;
			const wanted = comparableName(appeal.court);
			const target = courts.find(
				(other) => other !== entry && other.names.some((name) => comparableName(name) === wanted)
			);
			if (!target) continue;
			appealsTo.set(entry, target);
			const marks = appealMarks.get(target) ?? [];
			appealMarks.set(target, marks);
			cite(
				appeal,
				categories.courts.heading,
				`Appeals from ${shown.get(entry)!.text} go to ${shown.get(target)!.text}`,
				marks
			);
		}
	}

	const hasIncoming = new Set(appealsTo.values());
	const onPath = new Set<Merged>();
	const pathsByRoute = new Map<string, { first: Merged[]; then: Merged[] }>();
	for (const entry of courts) {
		if (hasIncoming.has(entry) || !appealsTo.has(entry)) continue;
		const then: Merged[] = [];
		let next = appealsTo.get(entry);
		// A loop in the records would never end; stop at the first court seen twice.
		while (next && next !== entry && !then.includes(next)) {
			then.push(next);
			next = appealsTo.get(next);
		}
		const route = then.map((court) => courts.indexOf(court)).join('>');
		const path = pathsByRoute.get(route) ?? { first: [], then };
		path.first.push(entry);
		pathsByRoute.set(route, path);
		onPath.add(entry);
		for (const court of then) onPath.add(court);
	}

	const byCategory = new Map<string, ServiceCategory>();
	for (const entry of merged) {
		let category = byCategory.get(entry.category.id);
		if (!category) {
			category = { ...entry.category, appealPaths: [], entries: [] };
			byCategory.set(entry.category.id, category);
		}
		if (!onPath.has(entry)) category.entries.push(shown.get(entry)!);
	}
	const courtCategory = byCategory.get('courts');
	if (courtCategory) {
		courtCategory.appealPaths = [...pathsByRoute.values()].map((path) => ({
			first: path.first.map((court) => shown.get(court)!),
			then: path.then.map((court) => ({
				court: shown.get(court)!,
				citations: appealMarks.get(court) ?? []
			}))
		}));
	}

	const rank = (id: string) => {
		if (id === 'other') return order.length + 1;
		const index = order.indexOf(id);
		return index === -1 ? order.length : index;
	};
	return [...byCategory.values()].sort(
		(first, second) =>
			rank(first.id) - rank(second.id) || first.heading.localeCompare(second.heading, 'en')
	);
}
