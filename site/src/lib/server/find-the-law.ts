/**
 * Each Native nation's file for Find the law (src/lib/find-the-law.ts): what
 * the site already holds about the nation, each item tagged with the subjects
 * it belongs to. Nothing here is new data; the tags come from fields the
 * records already have:
 *
 * - code sections: research/tribal-law/provisions.csv, by its subject_area
 *   column (the rows the second reader kept, each once);
 * - courts and forums: justice_institutions, by the kind of court;
 * - governing documents and document histories, by their kind;
 * - Tribal court opinions: the "gaming" mention tag, and for family the
 *   words of the case name ("Adoption of", "Estate of"); all of them under
 *   Courts and procedure;
 * - court cases naming the nation: the topics of the case's box
 *   (`case_box.topics` in its source record), and the record's own topics;
 * - jurisdiction facts and agreements, by topic and kind;
 * - treaties and how the land was set aside: land, and government;
 * - federal laws: the laws the timeline draws for every nation
 *   (src/lib/law-names.ts), each given its subjects here, and the statutes
 *   and orders whose source record names the nation.
 *
 * Runs at build time only.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { webLink } from '../contact-links.ts';
import { parseCsv } from '../csv.ts';
import type { LawItem, LawSubject, NationLaw } from '../find-the-law.ts';
import { lawNames } from '../law-names.ts';
import { displayName } from '../nation-labels.ts';
import { copyPagePath } from '../public-copies.ts';
import { casePreviewList } from './case-previews.ts';
import {
	nations,
	publicCopyFor,
	publicCopyWithDigest,
	repositoryRoot,
	sources as sourceRecords,
	type NationRecord,
	type SourceRecord
} from './content.ts';
import { documentHeading, documentHistoryView, nationDocumentHistories } from './document-history.ts';
import { SourceUses } from './source-uses.ts';
import { caseCitation, issuedDate, lawCitation } from './timeline.ts';
import { recordPageLink } from './law-records.ts';
import { opinionsOf } from './tribal-court-opinions.ts';

/** provisions.csv subject_area -> subject. "other" has none. */
const provisionSubjects: Record<string, LawSubject[]> = {
	general: ['courts'],
	civil: ['courts'],
	family: ['family'],
	'child-welfare': ['family'],
	juvenile: ['family'],
	probate: ['family'],
	criminal: ['criminal'],
	'land-or-resources': ['land'],
	housing: ['land'],
	gaming: ['gaming'],
	commercial: ['business'],
	employment: ['business'],
	'tribal-government': ['government'],
	elections: ['government']
};

/** A court of a special kind belongs to its subject too; every court is under Courts and procedure. */
const courtSubjects: Record<string, LawSubject[]> = {
	'juvenile-court': ['family'],
	'family-court': ['family'],
	'healing-to-wellness-court': ['criminal'],
	'treatment-court': ['criminal'],
	'criminal-court': ['criminal'],
	'traffic-court': ['criminal'],
	'employment-court': ['business'],
	'council-hearing': ['government']
};

const courtKinds: Record<string, string> = {
	'tribal-court': 'Tribal court',
	'court-of-appeals': 'Appeals court',
	'supreme-court': 'Supreme court',
	'peacemaking-program': 'Peacemaking',
	'judicial-branch': 'Judicial branch',
	'court-of-indian-offenses': 'Court of Indian Offenses',
	'district-court': 'District court',
	'circuit-court': 'Circuit court',
	'juvenile-court': 'Juvenile court',
	'family-court': 'Family court',
	'healing-to-wellness-court': 'Healing to wellness court',
	'treatment-court': 'Treatment court',
	'intertribal-court': 'Intertribal court',
	'intertribal-court-of-appeals': 'Intertribal appeals court',
	'traditional-forum': 'Traditional forum',
	'council-hearing': 'Council hearing',
	'civil-court': 'Civil court',
	'criminal-court': 'Criminal court',
	'traffic-court': 'Traffic court',
	'employment-court': 'Employment court',
	'administrative-adjudication': 'Administrative hearing'
};

/** A case box's topics (content/essays) -> subjects. */
const caseTopicSubjects: Record<string, LawSubject[]> = {
	'Tribal courts': ['courts'],
	'Civil jurisdiction': ['courts'],
	'Exhaustion of Tribal remedies': ['courts'],
	'Recognition of Tribal judgments (comity)': ['courts'],
	'Enforcement of awards, orders and judgments': ['courts'],
	'Dispute resolution and arbitration': ['courts'],
	'Child welfare': ['family'],
	'Criminal jurisdiction': ['criminal'],
	Gaming: ['gaming'],
	'Sovereign immunity': ['government']
};

/** A source record's own topics -> subjects. */
const sourceTopicSubjects: Record<string, LawSubject[]> = {
	gaming: ['gaming'],
	'tribal-state-compact': ['gaming'],
	land: ['land'],
	treaties: ['land'],
	criminal: ['criminal'],
	'criminal-jurisdiction': ['criminal'],
	family: ['family'],
	'sovereign-immunity': ['government'],
	membership: ['government']
};

/** Jurisdiction topics -> subjects. */
const jurisdictionSubjects: Record<string, LawSubject[]> = {
	'public-law-280': ['criminal', 'courts'],
	'state-jurisdiction-statute': ['criminal', 'courts'],
	'violence-against-women-act-special-tribal-criminal-jurisdiction': ['criminal'],
	'tribal-law-and-order-act-enhanced-sentencing': ['criminal'],
	'indian-child-welfare-act': ['family'],
	'hearth-act-leasing-regulations': ['land', 'business'],
	'environmental-treatment-as-a-state': ['land', 'government'],
	'water-rights-settlement': ['land']
};

const jurisdictionNames: Record<string, string> = {
	'public-law-280': 'Public Law 280',
	'state-jurisdiction-statute': 'State jurisdiction under other federal laws',
	'violence-against-women-act-special-tribal-criminal-jurisdiction': 'Violence Against Women Act jurisdiction',
	'tribal-law-and-order-act-enhanced-sentencing': 'Tribal Law and Order Act sentencing',
	'indian-child-welfare-act': 'Indian Child Welfare Act',
	'hearth-act-leasing-regulations': 'Leasing under the HEARTH Act',
	'environmental-treatment-as-a-state': 'Environmental treatment as a state',
	'water-rights-settlement': 'Water rights settlement'
};

const agreementSubjects: Record<string, LawSubject[]> = {
	'cross-deputization': ['criminal'],
	'tax-agreement': ['business', 'government'],
	'child-welfare-agreement': ['family'],
	other: ['government']
};

const agreementKinds: Record<string, string> = {
	'cross-deputization': 'Law enforcement agreement',
	'tax-agreement': 'Tax agreement',
	'child-welfare-agreement': 'Child welfare agreement',
	other: 'Agreement'
};

/**
 * The federal laws drawn on every nation's timeline, with their subjects (a
 * project choice, approved with the mockup on Nov. 24, 2026).
 */
const everyNationLaws: Record<string, LawSubject[]> = {
	'indian-removal-act-1830': ['land'],
	'major-crimes-act-1885': ['criminal'],
	'general-allotment-act-1887': ['land'],
	'indian-reorganization-act-1934': ['land', 'government'],
	'public-law-83-280': ['criminal', 'courts'],
	'indian-civil-rights-act-1968': ['criminal', 'courts', 'government'],
	'indian-self-determination-and-education-assistance-act-1975': ['government'],
	'indian-child-welfare-act-1978': ['family'],
	'indian-gaming-regulatory-act-1988': ['gaming'],
	'indian-tribal-justice-act-1993': ['courts'],
	'tribal-law-and-order-act-2010': ['criminal'],
	'violence-against-women-reauthorization-act-2013-title-ix': ['criminal'],
	'violence-against-women-act-reauthorization-act-2022-title-viii': ['criminal']
};

/** Opinion names that show a family or estate matter: "In re the Adoption of …", "Estate of …". */
const familyOpinionName =
	/\b(marriage|divorce|custody|adoption|guardianship|paternity|minors?|child|children|juvenile|dissolution|estate of)\b/i;

/** Whether an opinion's name shows a family or estate matter, so it is listed under Family and children. */
export function isFamilyOpinionName(name: string): boolean {
	return familyOpinionName.test(name);
}

const documentSubjects: Record<string, LawSubject[]> = {
	constitution: ['government'],
	'articles-of-association': ['government'],
	'corporate-charter': ['business'],
	'court-rules': ['courts'],
	'gaming-compact': ['gaming'],
	'secretarial-procedures': ['gaming']
};

function sentenceCase(text: string): string {
	return text.charAt(0).toLocaleUpperCase('en-US') + text.slice(1);
}

function humanize(slug: string): string {
	return sentenceCase(slug.replaceAll('-', ' '));
}

/** A source record's own address: this site's copy when it keeps one, else where it was published. */
function recordLink(record: SourceRecord | undefined): string | undefined {
	if (!record) return undefined;
	const copy = publicCopyFor(record.original_link) ?? publicCopyFor(record.citation.URL);
	if (copy) return copyPagePath(copy);
	return webLink(record.original_link) ?? webLink(record.citation.URL);
}

interface ProvisionRow {
	id: string;
	nation: string;
	subject: string;
	citation: string;
	summary: string;
	link?: string;
}

let provisionCache: Map<string, ProvisionRow[]> | undefined;

/** The code sections the readers kept, each once, by nation. */
function provisionsByNation(): Map<string, ProvisionRow[]> {
	if (provisionCache) return provisionCache;
	provisionCache = new Map();
	const text = readFileSync(path.join(repositoryRoot, 'research/tribal-law/provisions.csv'), 'utf8').normalize('NFC');
	for (const row of parseCsv(text)) {
		if (row.duplicate_of || row.second_pass_verdict === 'drop') continue;
		const copy = publicCopyWithDigest(row.sha256) ?? publicCopyFor(row.url);
		const list = provisionCache.get(row.nation) ?? [];
		list.push({
			id: row.id,
			nation: row.nation,
			subject: row.subject_area || 'other',
			citation: row.citation || [row.document, row.locator].filter(Boolean).join(', ') || 'Section not identified in the published text',
			summary: row.summary,
			link: copy ? copyPagePath(copy) : webLink(row.url)
		});
		provisionCache.set(row.nation, list);
	}
	return provisionCache;
}

function unique<Value>(values: Value[]): Value[] {
	return [...new Set(values)];
}

/** One nation's file. */
export function nationLaw(record: NationRecord): NationLaw {
	const items: LawItem[] = [];
	const name = displayName(record.names.official);

	// Tribal law and courts ------------------------------------------------
	for (const row of provisionsByNation().get(record.id) ?? []) {
		items.push({
			key: `provision-${row.id}`,
			part: 'tribal',
			kind: 'Code section',
			title: row.citation,
			detail: row.summary,
			link: row.link,
			subjects: provisionSubjects[row.subject] ?? []
		});
	}
	(record.justice_institutions ?? []).forEach((court, index) => {
		items.push({
			key: `court-${index}`,
			part: 'tribal',
			kind: courtKinds[court.kind] ?? humanize(court.kind),
			title: court.name,
			link: webLink(court.link) ?? `/nations/${record.id}#courts-heading`,
			subjects: unique<LawSubject>(['courts', ...(courtSubjects[court.kind] ?? [])])
		});
	});
	const codes: NationLaw['codes'] = [];
	const histories = nationDocumentHistories(record.id);
	// A document with its own history below is listed once, from the history.
	const historyKinds = new Set(histories.map((history) => history.kind));
	const listed = new Set<string>();
	(record.governing_documents ?? []).forEach((document, index) => {
		const link = webLink(document.link);
		if (document.kind === 'law-code') {
			if (link && !codes.some((code) => code.link === link)) codes.push({ title: document.title ?? 'Law code', link });
			return;
		}
		const subjects = documentSubjects[document.kind];
		const title = document.title ?? humanize(document.kind);
		const same = `${title.toLocaleLowerCase('en-US')} ${link ?? ''}`;
		if (!subjects || historyKinds.has(document.kind) || listed.has(same)) return;
		listed.add(same);
		items.push({
			key: `document-${index}`,
			part: 'tribal',
			kind: humanize(document.kind),
			title,
			link: link ?? `/nations/${record.id}#law-heading`,
			date: document.year ? String(document.year) : undefined,
			subjects
		});
	});
	for (const ordinance of record.gaming?.ordinances ?? []) {
		const approved = typeof ordinance.approved === 'string' ? ordinance.approved : undefined;
		items.push({
			key: `ordinance-${approved ?? items.length}`,
			part: 'tribal',
			kind: 'Gaming ordinance',
			title: 'Gaming ordinance',
			detail: 'Approved by the National Indian Gaming Commission',
			link: webLink(typeof ordinance.link === 'string' ? ordinance.link : undefined),
			date: approved,
			subjects: ['gaming']
		});
	}

	// Governing documents and agreements with recorded versions ----------------
	const names = [record.names.official, name];
	for (const history of histories) {
		const view = documentHistoryView(history, new SourceUses(), names);
		const kind = history.kind;
		const dates = view.versions.map((version) => version.date).filter((date): date is string => Boolean(date));
		items.push({
			key: `history-${history.id}`,
			part: kind === 'constitution' || kind === 'corporate-charter' ? 'tribal' : 'agreements',
			kind: humanize(kind),
			title: documentHeading(history.title, names),
			detail: view.inEffect ? `In effect: ${view.inEffect}` : view.ended,
			link: `/nations/${record.id}#document-${history.id}`,
			date: dates.sort().at(-1),
			subjects: documentSubjects[kind] ?? []
		});
	}

	// Court decisions ----------------------------------------------------------
	const opinions = opinionsOf(record.id);
	for (const opinion of opinions) {
		const subjects: LawSubject[] = ['courts'];
		if (isFamilyOpinionName(opinion.name)) subjects.push('family');
		if (opinion.topics.some((topic) => /gaming/i.test(topic))) subjects.push('gaming');
		items.push({
			key: `opinion-${opinion.key}`,
			part: 'decisions',
			kind: 'Tribal court opinion',
			title: opinion.name,
			italic: true,
			detail: [opinion.citation, opinion.court].filter(Boolean).join(', '),
			link: opinion.path,
			date: opinion.decided,
			subjects
		});
	}
	const previews = new Map(casePreviewList().cases.map((preview) => [preview.id, preview.link]));
	const records = sourceRecords();
	for (const source of records.values()) {
		if (!source.kind.endsWith('-case') || !source.tribes?.includes(record.id) || !source.citation.title) continue;
		const subjects = unique<LawSubject>([
			...(source.case_box?.topics ?? []).flatMap((topic) => caseTopicSubjects[topic] ?? []),
			...((source as SourceRecord & { topics?: string[] }).topics ?? []).flatMap((topic) => sourceTopicSubjects[topic] ?? [])
		]);
		items.push({
			key: `case-${source.key}`,
			part: 'decisions',
			kind: source.kind === 'federal-case' ? (/Supreme Court of the United States/.test(source.citation.authority ?? '') ? 'Supreme Court case' : 'Federal case') : 'State case',
			title: source.citation.title,
			italic: true,
			detail: caseCitation(source),
			link: previews.get(source.key) ?? recordLink(source),
			date: issuedDate(source),
			subjects
		});
	}

	// Agreements ---------------------------------------------------------------
	(record.treaties ?? []).forEach((treaty, index) => {
		items.push({
			key: `treaty-${index}`,
			part: 'agreements',
			kind: 'Treaty',
			title: treaty.title,
			detail: treaty.statutes_at_large,
			link: webLink(treaty.kappler?.link) ?? `/nations/${record.id}#ties-heading`,
			date: treaty.signed,
			subjects: ['land', 'government']
		});
	});
	(record.jurisdiction_agreements ?? []).forEach((agreement, index) => {
		items.push({
			key: `agreement-${index}`,
			part: 'agreements',
			kind: agreementKinds[agreement.kind] ?? humanize(agreement.kind),
			title: agreement.agreement ?? agreement.other_party,
			detail: [agreement.agreement ? `With ${agreement.other_party}` : undefined, agreement.status === 'expired' ? 'expired' : undefined].filter(Boolean).join(', ') || undefined,
			link: `/nations/${record.id}#jurisdiction-heading`,
			date: agreement.date,
			subjects: agreementSubjects[agreement.kind] ?? ['government']
		});
	});

	// Federal law and jurisdiction ---------------------------------------------
	(record.jurisdiction ?? []).forEach((fact, index) => {
		const text = fact.detail ?? humanize(fact.value ?? '');
		if (!text) return;
		items.push({
			key: `jurisdiction-${index}`,
			part: 'federal',
			kind: 'Jurisdiction',
			title: jurisdictionNames[fact.topic] ?? humanize(fact.topic),
			detail: text,
			link: `/nations/${record.id}#jurisdiction-heading`,
			subjects: jurisdictionSubjects[fact.topic] ?? []
		});
	});
	(record.nearby_state_courts ?? []).forEach((court, index) => {
		items.push({
			key: `state-court-${index}`,
			part: 'federal',
			kind: 'State court',
			title: court.court,
			detail: `${court.county}, ${court.state}`,
			link: webLink(court.link) ?? `/nations/${record.id}#jurisdiction-heading`,
			subjects: ['courts']
		});
	});
	(record.land_establishment ?? []).forEach((land, index) => {
		items.push({
			key: `land-${index}`,
			part: 'federal',
			kind: 'Land set aside',
			title: land.land_area,
			detail: [humanize(land.method), land.instrument].filter(Boolean).join(': '),
			link: recordPageLink(land.source) ?? `/nations/${record.id}#ties-heading`,
			date: land.date,
			subjects: ['land']
		});
	});
	for (const opinion of record.gaming?.indian_lands_opinions ?? []) {
		items.push({
			key: `lands-opinion-${opinion.date}-${opinion.parcel}`,
			part: 'federal',
			kind: 'Indian lands opinion',
			title: opinion.parcel,
			detail: opinion.legal_theory,
			link: webLink(opinion.link) ?? `/nations/${record.id}#ties-heading`,
			date: opinion.date,
			subjects: ['gaming', 'land']
		});
	}
	for (const action of record.gaming?.enforcement_actions ?? []) {
		items.push({
			key: `enforcement-${action.tracking_number}`,
			part: 'federal',
			kind: 'Gaming enforcement action',
			title: sentenceCase(action.kinds.map(humanize).join(' and ').toLocaleLowerCase('en-US')),
			detail: action.tracking_number,
			link: webLink(action.link) ?? `/nations/${record.id}#enforcement-heading`,
			date: action.date,
			subjects: ['gaming']
		});
	}
	for (const source of records.values()) {
		if (!(source.kind === 'federal-statute' || source.kind === 'executive-order') || !source.tribes?.includes(record.id)) continue;
		const title = lawNames[source.key] ?? source.citation.title ?? source.key;
		items.push({
			key: `law-${source.key}`,
			part: 'federal',
			kind: source.kind === 'executive-order' ? 'Executive order' : 'Federal law naming the nation',
			title,
			detail: lawCitation(source, title) || undefined,
			link: recordLink(source),
			date: issuedDate(source),
			subjects: source.kind === 'executive-order' ? ['land'] : ['government']
		});
	}
	for (const [key, subjects] of Object.entries(everyNationLaws)) {
		const source = records.get(key);
		if (!source || source.tribes?.includes(record.id)) continue;
		const title = lawNames[key];
		items.push({
			key: `law-${key}`,
			part: 'federal',
			kind: 'Federal law',
			title,
			detail: lawCitation(source, title) || undefined,
			link: recordLink(source),
			date: issuedDate(source),
			subjects,
			everyNation: true
		});
	}

	return {
		id: record.id,
		name,
		codes,
		items,
		opinions: opinions.length > 0 ? { count: opinions.length, link: `/nations/${record.id}/opinions` } : undefined
	};
}

/** The nations Find the law has a file for: every published nation that was not withdrawn at its request. */
export function lawNations(): NationRecord[] {
	return nations().filter((record) => record.review?.status !== 'withdrawn-at-request' && !record.example);
}
