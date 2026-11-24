import { error } from '@sveltejs/kit';
import type { OutlineItem, PageOutline } from '#lib/site-sections.ts';
import geometry from 'virtual:map-geometry';
import { webLink } from '#lib/contact-links.ts';
import { contactCards, contactsHeading, type ContactCards } from '#lib/contact-card.ts';
import { imageMayBeShown, imagePath } from '#lib/official-images.ts';
import {
	nations,
	searchSummary,
	sources as sourceRecords,
	type CitedFact,
	type NationRecord,
	type SourceRecord
} from '#lib/server/content.ts';
import { emptySectionNote, type EmptyNote } from '#lib/search-status.ts';
import { layoutPresenceMap, pointInBox, shapeInBox, shareStateShapes, type BoxLayers, type NationMapData, type PresenceMapLayout } from '#lib/presence-map.ts';
import { landAreaKindLabels } from '#lib/nations-map-drawing.ts';
import { readableDate } from '#lib/readable-date.ts';
import { documentHeading, documentHistoryView, labelOf, nationDocumentHistories } from '#lib/server/document-history.ts';
import { nationServices, type ServiceCategory } from '#lib/nation-services.ts';
import { SourceUses, whereInSource, type CitationMark } from '#lib/server/source-uses.ts';
import { sourceAnchor } from '#lib/citation-marks.ts';
import { recognitionBadges } from '#lib/recognition-badges.ts';
import { recognitionExplanations, recognitionView } from '#lib/server/recognition.ts';
import type { CitationPart } from '#lib/legal-citations.ts';
import { nationIndexRows } from '#lib/server/nation-index.ts';
import { nationTileMapData } from '#lib/server/nations-map.ts';
import { offlineSets } from '#lib/server/copy-lists.ts';
import { nationStorySummaries } from '#lib/server/stories.ts';
import { opinionsOf, opinionsSourceKey, type TribalCourtOpinion } from '#lib/server/tribal-court-opinions.ts';
import { nationTimeline, timelineHeading } from '#lib/server/timeline.ts';
import { bureauRegionPage, healthAreaPage } from '#lib/federal-offices.ts';
import { displayName, humanize, regionAnchor, reviewStatusLabels, stateName } from '#lib/nation-labels.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = () => nations().map((record) => ({ id: record.id }));

/**
 * One fact as the page shows it: an optional label, the words, an optional
 * link, a detail in parentheses and the markers of its sources, which link to
 * the page's Sources section.
 */
interface FactItem {
	label?: string;
	text: string;
	link?: string;
	detail?: string;
	/** A detail with linked citations, such as a status's legal basis; shown in place of detail. */
	detailParts?: CitationPart[];
	/** A short line under the value, such as what sources record in each state. */
	note?: string;
	/** The markers of the fact's sources (src/lib/citation-marks.ts). */
	citations?: CitationMark[];
}

const opinionsHeading = 'Court opinions';

/** The opinions the section names before linking to the full list. */
const opinionsShown = 5;

interface CourtOpinions {
	count: number;
	/** How many mention peacemaking, mediation, arbitration or another way of settling a dispute outside a trial. */
	disputeResolutionCount: number;
	shown: TribalCourtOpinion[];
	/** The years of the oldest and newest opinion. */
	from: string;
	to: string;
	citations: CitationMark[];
	link: string;
}

/**
 * The nation's court opinions in the Caselaw Access Project's tribal
 * reporters (decision record 0047): how many there are, and the newest few,
 * those that mention a way of settling a dispute outside a trial first.
 */
function courtOpinions(nationId: string, sources: SourceUses): CourtOpinions | undefined {
	const all = opinionsOf(nationId);
	if (all.length === 0) return undefined;
	const citations: CitationMark[] = [];
	sources.cite(opinionsSourceKey, { section: opinionsHeading, text: `${all.length} published opinions` }, citations);
	const mentioning = all.filter((opinion) => opinion.mentionsDisputeResolution);
	const shown = [...mentioning, ...all.filter((opinion) => !opinion.mentionsDisputeResolution)].slice(0, opinionsShown);
	return {
		count: all.length,
		disputeResolutionCount: mentioning.length,
		shown,
		from: all.at(-1)!.year,
		to: all[0].year,
		citations,
		link: `/nations/${nationId}/opinions`
	};
}

/** What the courts and jurisdiction sections say when they have nothing to show. */
/** The nation's seal or logo at the top of At a glance, and what the image viewer shows with it. */
interface NationImage {
	src: string;
	kind: string;
	/** Where the image is published, such as the nation's website. */
	original: string;
	/** The image's entry in the References list, as a link within the page. */
	source?: string;
}

interface EmptySections {
	government?: EmptyNote;
	courts?: EmptyNote;
	jurisdiction?: EmptyNote;
}

/** A labeled group of facts. `field` is the record field the group shows. */
interface FactGroup {
	field: string;
	label: string;
	items: FactItem[];
}

function group(field: string, label: string, items: FactItem[]): FactGroup[] {
	return items.length > 0 ? [{ field, label, items }] : [];
}

/** Shows a fact with the marker of its source, and records the source under the group's label. */
function cited(sources: SourceUses, section: string, fact: CitedFact, item: FactItem): FactItem {
	const citations = item.citations ?? [];
	sources.citeFact(fact, section, [item.label, item.text].filter(Boolean).join(': '), citations);
	return citations.length > 0 ? { ...item, citations } : item;
}

/**
 * The contact card: the record's contacts grouped by office, each office
 * named once. Each contact shown ends with the marker of its source, and every
 * contact's source is listed under "Government contacts".
 */
function contactCard(record: NationRecord, sources: SourceUses): ContactCards {
	const facts = record.contacts ?? [];
	const describe = (fact: (typeof facts)[number]) => `${humanize(fact.kind)}: ${fact.value}`;
	for (const fact of facts) sources.use(fact, contactsHeading, describe(fact));
	return contactCards(facts, (fact) => {
		const citations: CitationMark[] = [];
		sources.citeFact(fact, contactsHeading, describe(fact), citations);
		return citations;
	});
}

/** How the page words each kind of presence a source records in a state. */
const presenceWords: Record<string, string> = {
	land: 'land',
	'government-office': 'government office',
	other: 'census area'
};

/**
 * The states with a presence as one line, "Arizona, New Mexico, Utah", and
 * under it what sources record in each, grouped by kind: "Land: Arizona, New
 * Mexico, Utah. Government office: Arizona." Every state fact keeps its marker.
 */
function statesItem(record: NationRecord, sources: SourceUses, label: string): FactItem[] {
	const facts = record.states ?? [];
	if (facts.length === 0) return [];
	const citations: CitationMark[] = [];
	const codes: string[] = [];
	const byKind = new Map<string, string[]>();
	for (const fact of facts) {
		if (!codes.includes(fact.state)) codes.push(fact.state);
		const kind = fact.presence ? (presenceWords[fact.presence] ?? humanize(fact.presence).toLocaleLowerCase('en-US')) : undefined;
		if (kind) {
			const list = byKind.get(kind) ?? [];
			if (!list.includes(fact.state)) list.push(fact.state);
			byKind.set(kind, list);
		}
		sources.citeFact(fact, label, `${stateName(fact.state)}${kind ? ` (${kind})` : ''}`, citations);
	}
	const names = (list: string[]) => list.map(stateName).sort((first, second) => first.localeCompare(second, 'en'));
	const detail = [...byKind.entries()]
		.map(([kind, list]) => `${kind.charAt(0).toLocaleUpperCase('en-US')}${kind.slice(1)}: ${names(list).join(', ')}.`)
		.join(' ');
	return [{ text: names(codes).join(', '), note: detail || undefined, citations }];
}

function atAGlance(record: NationRecord, sources: SourceUses): FactGroup[] {
	const statesLabel = 'States with a presence';
	const recognitionLabel = 'Recognition';
	const regionLabel = 'Bureau of Indian Affairs region';
	const languagesLabel = 'Heritage languages';
	const administration = record.federal_administration;
	return [
		...group('recognition', recognitionLabel, recognitionItems(record, sources, recognitionLabel)),
		...group('states', statesLabel, statesItem(record, sources, statesLabel)),
		...governmentAtAGlance(record, sources),
		...group(
			'federal_administration',
			regionLabel,
			administration?.bureau_of_indian_affairs_region
				? [
						cited(sources, regionLabel, administration, {
							text: `${administration.bureau_of_indian_affairs_region} Region`,
							link: bureauRegionPage(administration.bureau_of_indian_affairs_region)
						}),
						...(administration.bureau_of_indian_affairs_agency
							? [
									cited(sources, regionLabel, administration, {
										label: 'Agency',
										text: administration.bureau_of_indian_affairs_agency,
										link: bureauRegionPage(
											administration.bureau_of_indian_affairs_region,
											administration.bureau_of_indian_affairs_agency
										)
									})
								]
							: [])
					]
				: []
		),
		...group(
			'languages',
			languagesLabel,
			(record.languages ?? []).flatMap((fact) =>
				typeof fact.name === 'string'
					? [cited(sources, languagesLabel, fact, { text: fact.name })]
					: []
			)
		),
		...group(
			'memberships',
			'Member of',
			(record.memberships ?? []).map((fact) =>
				cited(sources, 'Member of', fact, { text: fact.organization, link: organizationHome(fact) })
			)
		)
	];
}

const documentsLabel = 'Where the nation publishes its laws';

/**
 * The home page of an organization of nations, for the "Member of" row:
 * the organization's own site, taken from the source the membership cites
 * when the organization itself published it (its member list). Left out when
 * the source is someone else's, so the row never links a third party's page
 * as the organization's.
 */
function organizationHome(fact: CitedFact & { organization: string }): string | undefined {
	const source = fact.source ? sourceRecords().get(fact.source) : undefined;
	const publishedByIt = source?.citation.author?.some((author) => author.literal === fact.organization);
	const address = source?.citation.URL ?? source?.original_link;
	if (!publishedByIt || !address || !URL.canParse(address)) return undefined;
	return webLink(`${new URL(address).origin}/`);
}

/**
 * The nation's recognition, one line for each status: two sources that both
 * say "Federally recognized" make one line with both markers. Under it is the
 * short form of each distinct legal basis, such as "25 C.F.R. Part 83",
 * linked to the official text; the full wording stays with the cited source.
 */
function recognitionItems(record: NationRecord, sources: SourceUses, label: string): FactItem[] {
	const byLabel = new Map<string, FactItem & { citations: CitationMark[]; detailParts: CitationPart[] }>();
	for (const fact of record.recognition ?? []) {
		const view = recognitionView(fact);
		const item = byLabel.get(view.label) ?? { text: view.label, citations: [], detailParts: [] };
		byLabel.set(view.label, item);
		const short = view.short;
		if (short && !item.detailParts.some((part) => part.text === short.text)) {
			if (item.detailParts.length > 0) item.detailParts.push({ text: '; ' });
			item.detailParts.push(short);
		}
		sources.citeFact(fact, label, view.label, item.citations);
	}
	return [...byLabel.values()].map((item) => ({
		...item,
		detailParts: item.detailParts.length > 0 ? item.detailParts : undefined
	}));
}

/** The section that shows how the nation's government is set up. */
const governmentHeading = 'Government';

/**
 * The groups of the Government section, in the order the page shows them,
 * and the label each aspect of `governance` gets in its group
 * (schemas/tribe.schema.json; decision record 0042).
 */
const governanceGroups: { field: string; label: string; aspects: Record<string, string | undefined> }[] = [
	{ field: 'governance-form', label: 'Form of government', aspects: { form: undefined } },
	{
		field: 'governance-body',
		label: 'Governing body',
		aspects: {
			'governing-body': 'Name',
			'governing-body-size': 'Members',
			'governing-body-selection': 'How chosen',
			'governing-body-term': 'Term'
		}
	},
	{ field: 'governance-general-council', label: 'General council', aspects: { 'general-council': undefined } },
	{
		field: 'governance-head',
		label: 'Head of government',
		aspects: {
			'head-of-government': 'Title',
			'head-of-government-selection': 'How chosen',
			'head-of-government-term': 'Term',
			'other-officers': 'Other officers'
		}
	},
	{
		field: 'governance-elections',
		label: 'Elections',
		aspects: { elections: 'When', 'voting-age': 'Voting age', 'election-authority': 'Run by' }
	},
	{
		field: 'governance-branches',
		label: 'Branches of government',
		aspects: { branches: undefined, 'separation-of-powers': 'Separation of powers' }
	},
	{
		field: 'governance-judiciary',
		label: 'Courts and judges',
		aspects: {
			judiciary: 'Courts',
			'judicial-selection': 'How judges are chosen',
			'judicial-term': 'Judges’ term',
			'judicial-independence': 'Protection'
		}
	},
	{
		field: 'governance-amendment',
		label: 'Changing the governing document',
		aspects: { amendment: 'How', 'secretarial-approval': 'Secretary of the Interior’s approval' }
	},
	{ field: 'governance-removal', label: 'Recall and removal', aspects: { 'recall-and-removal': undefined } },
	{ field: 'governance-other', label: 'Other', aspects: { other: undefined } }
];

/** The legal form a federal source records, in the page's words. */
const governmentStructureKinds: Record<string, string> = {
	'indian-reorganization-act': 'Organized under the Indian Reorganization Act',
	'oklahoma-indian-welfare-act': 'Organized under the Oklahoma Indian Welfare Act',
	'alaska-indian-reorganization-act': 'Organized under the Indian Reorganization Act as amended for Alaska',
	'written-constitution-other': 'Written constitution adopted outside those Acts',
	traditional: 'Traditional government'
};

/**
 * Government: how the nation's government is set up, as its own governing
 * document, its website or an official directory states it. Each line is one
 * plain fact with its source; the words of the source that state it go in the
 * Sources list beside the fact, so a reader can check it. Never a summary of
 * a constitution (decision record 0042). The last line names the version of
 * each governing document the facts were read from, linked to its history in
 * "Laws and agreements".
 */
function governmentFacts(
	record: NationRecord,
	sources: SourceUses,
	documents: { id: string; heading: string; versions?: { id: string; label?: string }[] }[]
): FactGroup[] {
	const facts = record.governance ?? [];
	const groups: FactGroup[] = [];
	const read = new Map<string, FactItem>();
	for (const definition of governanceGroups) {
		const items: FactItem[] = [];
		if (definition.field === 'governance-form') {
			for (const fact of record.government_structure ?? []) {
				const text = governmentStructureKinds[fact.kind] ?? humanize(fact.kind);
				const note = fact.as_of ? `As of ${fact.as_of}` : undefined;
				if (items.some((item) => item.text === text)) {
					sources.citeFact(fact, definition.label, text, items.find((item) => item.text === text)!.citations);
					continue;
				}
				items.push(cited(sources, definition.label, fact, { text, note }));
			}
		}
		for (const [aspect, label] of Object.entries(definition.aspects)) {
			for (const fact of facts.filter((candidate) => candidate.aspect === aspect)) {
				const fromDirectory = !fact.document_version && !fact.quote;
				const itemLabel = fromDirectory && label ? `${label} in the federal directory` : label;
				const shown = [itemLabel, fact.value].filter(Boolean).join(': ');
				const citations: CitationMark[] = [];
				const sourceText = fact.quote ? `${shown}. “${fact.quote}”` : shown;
				sources.citeFact(fact, definition.label, sourceText, citations);
				items.push({ label: itemLabel, text: fact.value, citations });
				const version = fact.document_version as { document: string; version: string } | undefined;
				if (version && !read.has(`${version.document}/${version.version}`)) {
					const document = documents.find((candidate) => candidate.id === version.document);
					const label = document?.versions?.find((candidate) => candidate.id === version.version)?.label;
					if (document) {
						read.set(`${version.document}/${version.version}`, {
							text: label ? `${document.heading}: ${label}` : document.heading,
							link: `#document-${document.id}`
						});
					}
				}
			}
		}
		groups.push(...group(definition.field, definition.label, items));
	}
	if (read.size > 0) groups.push(...group('governance-read', 'Read from', [...read.values()]));
	return groups;
}

/**
 * At a glance: the name of the governing body and the title of the head of
 * government. The title the federal directory lists comes first, being the
 * newest; otherwise the governing document's.
 */
function governmentAtAGlance(record: NationRecord, sources: SourceUses): FactGroup[] {
	const facts = record.governance ?? [];
	const pick = (aspect: string) => {
		const matching = facts.filter((fact) => fact.aspect === aspect);
		return matching.find((fact) => !fact.document_version) ?? matching[0];
	};
	const body = pick('governing-body');
	const head = pick('head-of-government');
	const bodyLabel = 'Governing body';
	const headLabel = 'Head of government';
	return [
		...group('governance-glance-body', bodyLabel, body ? [cited(sources, bodyLabel, body, { text: body.value })] : []),
		...group('governance-glance-head', headLabel, head ? [cited(sources, headLabel, head, { text: head.value })] : [])
	];
}

/** The names the page gives each jurisdiction topic a record can hold, in the order the page shows them. */
const jurisdictionTopics: Record<string, string> = {
	'public-law-280': 'Public Law 280',
	'state-jurisdiction-statute': 'State jurisdiction under other federal laws',
	'violence-against-women-act-special-tribal-criminal-jurisdiction': 'Violence Against Women Act',
	'tribal-law-and-order-act-enhanced-sentencing': 'Tribal Law and Order Act',
	'indian-child-welfare-act': 'Indian Child Welfare Act'
};
const topicOrder = Object.keys(jurisdictionTopics);

/**
 * Jurisdiction: who has authority over what, as federal law and federal lists
 * record it for the nation, such as Public Law 280 or a designated agent for
 * Indian Child Welfare Act notices. Each line is the record's own cited detail.
 */
function jurisdictionFacts(record: NationRecord, sources: SourceUses): FactGroup[] {
	const section = 'Jurisdiction';
	const byTopic = new Map<string, FactItem[]>();
	const rank = (topic: string) => (topicOrder.includes(topic) ? topicOrder.indexOf(topic) : topicOrder.length);
	const facts = [...(record.jurisdiction ?? [])].sort((first, second) => rank(first.topic) - rank(second.topic));
	for (const fact of facts) {
		const label = jurisdictionTopics[fact.topic] ?? humanize(fact.topic);
		const text = fact.detail ?? humanize(fact.value ?? '');
		if (!text) continue;
		const list = byTopic.get(label) ?? [];
		list.push(cited(sources, section, fact, { label: undefined, text }));
		byTopic.set(label, list);
	}
	return [
		...[...byTopic.entries()].map(([label, items]) => ({ field: `jurisdiction-${label}`, label, items })),
		...agreementGroups(record, sources, section),
		...group('nearby-state-courts', 'State trial courts for the same counties', nearbyStateCourts(record, sources, section)),
		...group('court-cases', 'Court cases about the nation', courtCases(record, sources, section))
	];
}

/**
 * The state trial court of general jurisdiction for each county the nation's
 * Census area lies in, largest share first as the record lists them, each
 * linking the state judiciary's list of those courts.
 */
function nearbyStateCourts(record: NationRecord, sources: SourceUses, section: string): FactItem[] {
	return (record.nearby_state_courts ?? []).map((fact) =>
		cited(sources, section, fact, {
			text: fact.court,
			link: fact.link && URL.canParse(fact.link) ? webLink(fact.link) : undefined,
			detail: stateName(fact.state)
		})
	);
}

/** Reporter names written out in some records, in their short form. */
const reporterShortNames: Record<string, string> = { 'United States Reports': 'U.S.' };

/**
 * The court cases in the project's sources that are about the nation (the
 * source record lists it), oldest first: the case name, where it is reported
 * and the year, with the court under it. Each links the opinion the record
 * cites and is listed under Sources like any other fact.
 */
function courtCases(record: NationRecord, sources: SourceUses, section: string): FactItem[] {
	const year = (source: SourceRecord) => source.citation.issued?.['date-parts']?.[0]?.[0];
	const cases = [...sourceRecords().values()]
		.filter((source) => source.kind.endsWith('-case') && source.tribes?.includes(record.id) && source.citation.title)
		.sort((first, second) => (year(first) ?? 0) - (year(second) ?? 0));
	return cases.map((source) => {
		const { volume, page, number, authority } = source.citation;
		const reporter = source.citation['container-title'];
		const reported = volume && reporter && page ? `${volume} ${reporterShortNames[reporter] ?? reporter} ${page}` : number;
		const when = year(source);
		const address = source.citation.URL ?? source.original_link;
		return cited(sources, section, { source: source.key, confidence: 'high' }, {
			text: source.citation.title ?? source.key,
			link: address && URL.canParse(address) ? webLink(address) : undefined,
			detail: [reported, when ? `(${when})` : undefined].filter(Boolean).join(' ') || undefined,
			note: authority
		});
	});
}

/** The names the page gives each kind of jurisdiction agreement, in the order the page shows them. */
const agreementKinds: Record<string, string> = {
	'cross-deputization': 'Cross-deputization and law enforcement agreements',
	'tax-agreement': 'Tax agreements',
	'child-welfare-agreement': 'Child welfare agreements',
	other: 'Other agreements'
};

/**
 * Agreements with a state, county, city or federal agency, one group per
 * kind: what the agreement is, who the other party is, when it was signed,
 * and whether it has expired. Most sources do not say whether an agreement
 * is still in force, so only an expired one is marked.
 */
function agreementGroups(record: NationRecord, sources: SourceUses, section: string): FactGroup[] {
	const order = Object.keys(agreementKinds);
	const rank = (kind: string) => (order.includes(kind) ? order.indexOf(kind) : order.length);
	const facts = [...(record.jurisdiction_agreements ?? [])].sort(
		(first, second) => rank(first.kind) - rank(second.kind) || (first.date ?? '').localeCompare(second.date ?? '')
	);
	const byKind = new Map<string, FactItem[]>();
	for (const fact of facts) {
		const label = agreementKinds[fact.kind] ?? humanize(fact.kind);
		const list = byKind.get(label) ?? [];
		list.push(
			cited(sources, section, fact, {
				text: fact.agreement ?? fact.other_party,
				detail: [
					fact.agreement ? `with ${fact.other_party}` : undefined,
					fact.date ? readableDate(fact.date) : undefined,
					fact.status === 'expired' ? 'expired' : undefined
				]
					.filter(Boolean)
					.join(', '),
				note: fact.detail
			})
		);
		byKind.set(label, list);
	}
	return [...byKind.entries()].map(([label, items]) => ({ field: `jurisdiction-agreements-${label}`, label, items }));
}

/** How the page words each way a land base was set aside. */
const establishmentWords: Record<string, string> = {
	treaty: 'Treaty',
	'executive-order': 'Executive order',
	statute: 'Act of Congress',
	agreement: 'Agreement',
	'secretarial-proclamation': 'Proclamation of the Secretary of the Interior',
	purchase: 'Purchase',
	'court-decree': 'Court decree',
	'state-action': 'State action',
	// A letter or proclamation of an official: the instrument says what it is.
	other: ''
};

/**
 * The nation's relationship with the United States: its treaties, each linked
 * to its text in Kappler's Indian Affairs: Laws and Treaties; how its land was
 * set aside; and the Indian Health Service Area and service unit that serve it.
 * The Bureau of Indian Affairs region stays in At a glance. The Gaming
 * Commission's enforcement actions follow as a table (enforcementActions).
 */
function federalTies(record: NationRecord, sources: SourceUses): FactGroup[] {
	const section = 'Treaties and federal ties';
	const treaties = [...(record.treaties ?? [])].sort((first, second) => first.signed.localeCompare(second.signed));
	return [
		...group(
			'treaties',
			'Treaties',
			treaties.map((fact) =>
				cited(sources, section, fact, {
					text: fact.title,
					link: fact.kappler?.link ? webLink(fact.kappler.link) : undefined,
					detail: [
						readableDate(fact.signed),
						fact.statutes_at_large,
						fact.kappler?.page ? `${fact.kappler.volume ?? 2} Kappler ${fact.kappler.page}` : undefined
					]
						.filter(Boolean)
						.join(', '),
					note: fact.signatory ? `Signed as “${fact.signatory}”.` : undefined
				})
			)
		),
		...group(
			'land_establishment',
			'How the land was set aside',
			(record.land_establishment ?? []).map((fact) =>
				cited(sources, section, fact, {
					label: fact.land_area,
					text: [establishmentWords[fact.method] ?? humanize(fact.method), fact.instrument].filter(Boolean).join(': '),
					detail: fact.date ? readableDate(fact.date) : undefined,
					note: fact.detail
				})
			)
		),
		...group('indian_health_service', 'Indian Health Service', healthItems(record, sources, section)),
		...group(
			'indian-lands-opinions',
			'Indian lands opinions on gaming',
			[...(record.gaming?.indian_lands_opinions ?? [])]
				.sort((first, second) => first.date.localeCompare(second.date))
				.map((fact) =>
					cited(sources, section, fact, {
						text: fact.parcel,
						link: fact.link && URL.canParse(fact.link) ? webLink(fact.link) : undefined,
						detail: [readableDate(fact.date), fact.legal_theory, fact.accepted === undefined ? undefined : fact.accepted ? 'accepted' : 'not accepted']
							.filter(Boolean)
							.join(', ')
					})
				)
		)
	];
}

/** One National Indian Gaming Commission enforcement action, a row of its table on the nation page. */
interface EnforcementAction {
	key: string;
	/** YYYY-MM-DD, which sorts the table. */
	date: string;
	kind: string;
	number: string;
	link?: string;
	citations: CitationMark[];
}

/**
 * The Gaming Commission's enforcement actions against the nation's gaming,
 * oldest first, as rows of a table with Date, Type, Number, Document and
 * Source columns (Trevor, Nov. 23, 2026), after the section's other facts so
 * their markers keep the page's order.
 */
function enforcementActions(record: NationRecord, sources: SourceUses): EnforcementAction[] {
	const section = 'Treaties and federal ties';
	return [...(record.gaming?.enforcement_actions ?? [])]
		.sort((first, second) => first.date.localeCompare(second.date))
		.map((fact, index) => {
			const kind = sentenceCase(fact.kinds.map(humanize).join(' and '));
			const citations: CitationMark[] = [];
			sources.citeFact(fact, section, `Gaming Commission enforcement action: ${kind}, ${fact.tracking_number}`, citations);
			return {
				key: `${fact.tracking_number}-${index}`,
				date: fact.date,
				kind,
				number: fact.tracking_number,
				link: fact.link && URL.canParse(fact.link) ? webLink(fact.link) : undefined,
				citations
			};
		});
}

/** The first letter in capitals, the rest as given. */
function sentenceCase(text: string): string {
	return text.charAt(0).toLocaleUpperCase('en-US') + text.slice(1).toLocaleLowerCase('en-US');
}

/**
 * The Indian Health Service Area once, with the markers of every source that
 * names it, then each service unit or health program and who runs the
 * nation's health services, each with its own source.
 */
function healthItems(record: NationRecord, sources: SourceUses, section: string): FactItem[] {
	const facts = record.indian_health_service ?? [];
	if (facts.length === 0) return [];
	const areas = [...new Set(facts.map((fact) => fact.area))];
	// Each Area links to the page about it. Its markers are those of the facts
	// that name only the Area; the service unit and operator lines carry their own.
	const items: FactItem[] = areas.map((area) => {
		const naming = facts.filter((fact) => fact.area === area);
		const areaOnly = naming.filter((fact) => !fact.service_unit && !fact.operator);
		const citations: CitationMark[] = [];
		for (const fact of areaOnly.length > 0 ? areaOnly : naming) sources.citeFact(fact, section, `${area} Area`, citations);
		return { text: `${area} Area`, link: healthAreaPage(area), citations };
	});
	for (const fact of facts) {
		if (!fact.service_unit) continue;
		const runBy =
			fact.operator === 'tribal'
				? 'run by the nation or a Tribal organization'
				: fact.operator === 'indian-health-service'
					? 'run by the Indian Health Service'
					: undefined;
		items.push(cited(sources, section, fact, { label: 'Service unit or program', text: fact.service_unit, detail: runBy }));
	}
	for (const fact of facts) {
		if (!fact.operator || fact.service_unit) continue;
		const text =
			fact.operator === 'tribal'
				? 'Run by the nation or a Tribal organization'
				: 'Run by the Indian Health Service (a Direct Service Tribe)';
		items.push(cited(sources, section, fact, { label: 'Health services', text }));
	}
	return items;
}

/**
 * Courts and dispute resolution services, one heading per kind of service,
 * with the appeal paths between courts (src/lib/nation-services.ts).
 */
function courtsAndDisputeResolution(record: NationRecord, sources: SourceUses): ServiceCategory[] {
	return nationServices(
		[...(record.justice_institutions ?? []), ...(record.dispute_resolution?.forums ?? [])],
		(fact, section, text, marks) => sources.citeFact(fact, section, text, marks)
	);
}

/** The names the page gives each kind of court practice item, in the order the page shows them. */
const practiceKinds: Record<string, string> = {
	'bar-admission': 'Admission to practice',
	'court-rules': 'Court rules',
	'filing-fees': 'Filing fees',
	forms: 'Court forms',
	'public-defender': 'Public defender',
	'legal-aid': 'Legal aid'
};

/**
 * What a person needs to use the nation's courts, one group per kind: each
 * page or document linked, with the court it belongs to and what it says,
 * such as the fee amounts or how to apply.
 */
function courtPractice(record: NationRecord, sources: SourceUses): FactGroup[] {
	const section = 'Courts and dispute resolution';
	const order = Object.keys(practiceKinds);
	const rank = (kind: string) => (order.includes(kind) ? order.indexOf(kind) : order.length);
	const facts = [...(record.court_practice ?? [])].sort((first, second) => rank(first.kind) - rank(second.kind));
	const byKind = new Map<string, FactItem[]>();
	for (const fact of facts) {
		const label = practiceKinds[fact.kind] ?? humanize(fact.kind);
		const list = byKind.get(label) ?? [];
		list.push(
			cited(sources, section, fact, {
				text: fact.title,
				link: fact.link && URL.canParse(fact.link) ? webLink(fact.link) : undefined,
				detail: fact.court,
				note: fact.detail
			})
		);
		byKind.set(label, list);
	}
	return [...byKind.entries()].map(([label, items]) => ({ field: `court-practice-${label}`, label, items }));
}

/** The section that joins the nation's published law and its documents' histories. */
const lawHeading = 'Laws and agreements';

/**
 * Where the nation publishes its laws, and any published dispute resolution
 * law: linked, not reproduced. Two sources listing the same document make one
 * line; two different links with the same title, such as two "Tribal code"
 * links, are told apart by the site each one is on. A
 * document that has its own history below, such as a constitution, is not
 * listed again; its source stays in the Sources list.
 */
function publishedLaw(
	record: NationRecord,
	sources: SourceUses,
	documents: { kind: string }[]
): FactGroup[] {
	const lawLabel = 'Dispute resolution law';
	const hasHistory = (kind: string) => documents.some((document) => document.kind === humanize(kind));
	const entries = (record.governing_documents ?? []).filter((fact) => {
		if (!hasHistory(fact.kind)) return true;
		sources.use(fact, documentsLabel, fact.title ?? humanize(fact.kind));
		return false;
	});
	const titleOf = (fact: (typeof entries)[number]) => fact.title ?? humanize(fact.kind);
	const host = (link: string | undefined) => {
		const url = link && URL.canParse(link) ? new URL(link) : undefined;
		return url?.hostname.replace(/^www\./, '');
	};
	// One line per document: entries from several sources with the same
	// title and the same address, or the same title where one gives no
	// address, are one document shown once with the markers of every source.
	// Titles are compared without case, so "Corporate Charter" and "Corporate
	// charter" are one title.
	const lines: { title: string; link?: string; facts: typeof entries }[] = [];
	const sameTitle = (first: string, second: string) =>
		first.toLocaleLowerCase('en-US') === second.toLocaleLowerCase('en-US');
	const comparable = (link: string | undefined) => link?.replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '');
	for (const fact of entries) {
		const title = titleOf(fact);
		const link = webLink(fact.link);
		const line =
			lines.find((other) => sameTitle(other.title, title) && comparable(other.link) === comparable(link)) ??
			(link ? lines.find((other) => sameTitle(other.title, title) && !other.link) : undefined) ??
			(link ? undefined : lines.find((other) => sameTitle(other.title, title)));
		if (line) {
			line.facts.push(fact);
			line.link ??= link;
		} else {
			lines.push({ title, link, facts: [fact] });
		}
	}
	return [
		...group(
			'dispute_resolution_law',
			lawLabel,
			(record.dispute_resolution_law ?? []).map((key) => {
				const text = 'Published law on dispute resolution';
				return { text, citations: [sources.cite(key, { section: lawLabel, text })] };
			})
		),
		...group(
			'governing_documents',
			documentsLabel,
			lines.map((line) => {
				const shared = lines.filter((other) => sameTitle(other.title, line.title)).length > 1;
				const site = shared ? host(line.link) : undefined;
				// Cited under the plain title, the words At a glance uses, so the
				// Sources list names the fact once and links back to both markers.
				const citations: CitationMark[] = [];
				for (const fact of line.facts) sources.citeFact(fact, documentsLabel, line.title, citations);
				const kind = line.facts.find((fact) => fact.title && fact.kind !== 'other')?.kind;
				return {
					text: site ? `${line.title} (${site})` : line.title,
					link: line.link,
					detail: kind ? humanize(kind) : undefined,
					citations
				};
			})
		)
	];
}

/**
 * The rows "Laws and agreements" shows when the nation's constitution or its
 * published laws are not on record, so the section always says whether they
 * were found. The project keeps no search log for laws yet, so the note says
 * how far the sources go rather than how far a search went.
 */
function missingLaw(record: NationRecord, documents: { kind: string }[]): FactGroup[] {
	const kinds = new Set((record.governing_documents ?? []).map((fact) => fact.kind));
	// Articles of association are some nations' governing document in place of
	// a constitution. A corporate charter governs a business, so it is neither.
	const governing = ['constitution', 'articles-of-association'];
	const hasConstitution =
		governing.some((kind) => kinds.has(kind)) ||
		documents.some((document) => governing.map(humanize).includes(document.kind));
	const hasLaws =
		['law-code', 'court-rules', 'other'].some((kind) => kinds.has(kind)) ||
		(record.dispute_resolution_law ?? []).length > 0;
	const row = (field: string, label: string, what: string): FactGroup => {
		const { text, note } = emptySectionNote(what, '', searchSummary(field, record.id));
		return { field: `missing-${field}`, label, items: [{ text, note }] };
	};
	return [
		...(hasConstitution ? [] : [row('constitution', 'Constitution', 'a constitution or other governing document')]),
		...(hasLaws ? [] : [row('laws', 'Published laws', 'a law code or other published law')])
	];
}

/** Another nation that sources record in one of the same states. */
interface Neighbor {
	id: string;
	name: string;
}

/** The other nations in one state, listed in full when short, else counted with a link to the state's list. */
interface StateNeighbors {
	state: string;
	stateName: string;
	link: string;
	count: number;
	nations: Neighbor[];
}

/** States with more other nations than this are summed up with a link to the state's list. */
const neighborListLimit = 30;

/**
 * "Nearby Nations" (Trevor's heading, Nov. 23, 2026): for each state where sources record
 * the nation, the other nations recorded there, in alphabetical order. A
 * plain list, never a ranking or a comparison (site/DESIGN.md, "Nation
 * pages"). Long lists give way to a link to the state's page.
 */
function sameStates(record: NationRecord): StateNeighbors[] {
	const codes = [...new Set((record.states ?? []).map((fact) => fact.state))];
	const rows = nationIndexRows();
	return codes
		.map((code) => {
			const others = rows.filter((row) => row.id !== record.id && row.states.includes(code));
			return {
				state: code,
				stateName: stateName(code),
				link: `/nations/state/${code.toLocaleLowerCase('en-US')}`,
				count: others.length,
				nations: others.length <= neighborListLimit ? others.map(({ id, name }) => ({ id, name })) : []
			};
		})
		.filter((entry) => entry.count > 0)
		.sort((first, second) => first.stateName.localeCompare(second.stateName, 'en'));
}

/**
 * The small map on the nation's page, with the same views as the map of all
 * nations (Trevor, Nov. 22, 2026): the states where sources record the
 * nation's presence, its Bureau of Indian Affairs region, and the Census land
 * areas its entry names. Each view shows only the boxes that matter to the
 * nation, the main one zoomed to them (src/lib/presence-map.ts). A view with
 * nothing to show is left out; a page whose record lists no state has no map.
 * The state outlines are kept once and shared by the views.
 */
const zoomedPaths = new Map(geometry.zoomedStates.map((state) => [state.code, state.path]));

/** Land areas are small, so their view may zoom closer than the other views. */
const landAreaClosestZoom = 0.1;

/** A region fills most of the view, with its neighbors around it. */
const regionClosestZoom = 0.25;

function nationMap(record: NationRecord, sources: SourceUses): NationMapData | undefined {
	const present = new Set((record.states ?? []).map((fact) => fact.state));
	if (present.size === 0) return undefined;
	const states = geometry.smallStates;
	const views: { key: 'states' | 'region' | 'lands'; label: string; layout: PresenceMapLayout; layers: Record<string, BoxLayers> }[] = [];
	const emptyLayers = (layout: PresenceMapLayout) =>
		Object.fromEntries(layout.boxes.map((box) => [box.key, { shapes: [], dots: [], labels: [] } as BoxLayers]));

	sources.add('census-cartographic-boundary-states-2017', {
		section: 'Map',
		text: 'state and territory outlines, through us-atlas 3.0.1'
	});
	const statesLayout = layoutPresenceMap(geometry.frames, states, present, zoomedPaths);
	views.push({ key: 'states', label: 'States', layout: statesLayout, layers: emptyLayers(statesLayout) });

	const regionName = record.federal_administration?.bureau_of_indian_affairs_region;
	const region = geometry.regions.find((shape) => shape.name === regionName);
	if (region) {
		sources.add(geometry.regionSource.source, {
			section: 'Map',
			text: 'Bureau of Indian Affairs region outlines, simplified for a national map',
			where: `retrieved ${geometry.regionSource.retrieved}`
		});
		const layout = layoutPresenceMap(geometry.frames, states, new Set(), zoomedPaths, {
			focus: [region.path],
			closestZoom: regionClosestZoom
		});
		const layers = emptyLayers(layout);
		for (const box of layout.boxes) {
			for (const shape of geometry.regions) {
				if (!shapeInBox(box, shape.path)) continue;
				layers[box.key].shapes.push({ path: shape.path, kind: shape === region ? 'nation-region' : 'region' });
			}
			if (shapeInBox(box, region.path)) {
				layers[box.key].labels.push({ text: `${region.name} Region`, ...pointInBox(box, region.label) });
			}
		}
		views.push({ key: 'region', label: 'Region', layout, layers });
	}

	const areaFacts = (record.census_areas ?? []).filter((fact) => !fact.vintage || fact.vintage === '2020');
	const areas = geometry.landAreas.filter((shape) =>
		areaFacts.some((fact) => fact.geographic_identifier === shape.identifier)
	);
	if (areas.length > 0) {
		for (const fact of areaFacts) {
			if (fact.source) sources.add(fact.source, { section: 'Map', text: `land area: ${fact.name}` });
		}
		sources.add(geometry.landAreaSource.source, {
			section: 'Map',
			text: 'land area outlines, simplified for a national map',
			where: `retrieved ${geometry.landAreaSource.retrieved}`
		});
		sources.add('protomaps-basemap-openstreetmap', {
			section: 'Map',
			text: 'the map of places, roads and water under the land areas, where the browser can draw it'
		});
		const layout = layoutPresenceMap(geometry.frames, states, new Set(), zoomedPaths, {
			focus: areas.map((area) => area.path),
			closestZoom: landAreaClosestZoom
		});
		const layers = emptyLayers(layout);
		for (const box of layout.boxes) {
			for (const area of areas) {
				if (!shapeInBox(box, area.path)) continue;
				layers[box.key].shapes.push({ path: area.path, kind: 'land-area' });
				if (area.dot) layers[box.key].dots.push(pointInBox(box, area.dot));
			}
		}
		views.push({ key: 'lands', label: 'Land Areas', layout, layers });
	}

	const shared = shareStateShapes(views.map((view) => view.layout));
	return {
		shapes: shared.shapes,
		views: views.map((view, index) => ({ key: view.key, label: view.label, layout: shared.layouts[index], layers: view.layers })),
		stateNames: [...present].map(stateName).sort((first, second) => first.localeCompare(second, 'en')),
		region: region ? { name: `${region.name} Region`, link: `/nations/map#${regionAnchor(region.name)}` } : undefined,
		landAreas: areas.map((area) => ({ name: area.name, kind: landAreaKindLabels[area.kind] })),
		tileMap: areas.length > 0 ? nationTileMapData(areas.map((area) => area.identifier)) : undefined
	};
}

function heldCopies(id: string): { count: number; bytes: number } {
	const files = offlineSets().nations.get(id)?.files ?? [];
	return { count: files.length, bytes: files.reduce((total, [, bytes]) => total + bytes, 0) };
}

export const load: PageServerLoad = ({ params }) => {
	const record = nations().find((candidate) => candidate.id === params.id);
	if (!record) error(404, 'No nation page has this address.');

	const status = reviewStatusLabels[record.review?.status] ?? {
		label: humanize(record.review?.status ?? 'unknown'),
		meaning: ''
	};
	const page = {
		id: record.id,
		example: record.example === true,
		officialName: displayName(record.names.official),
		listedName: record.names.official,
		// Badges under the name; no federal recognition has none (src/lib/recognition-badges.ts).
		badges: recognitionBadges(record.recognition ?? []),
		// What each badge opens: how the nation got the status (Trevor, Nov. 23, 2026).
		badgeExplanations: recognitionExplanations(record),
		review: status,
		withdrawn: record.review?.status === 'withdrawn-at-request',
		// The copies of the nation's documents this site holds, to save offline or download as a ZIP.
		heldCopies: heldCopies(record.id)
	};

	if (page.withdrawn) {
		return {
			page,
			image: undefined,
			nameCitations: [],
			selfDesignations: [],
			pronunciations: [],
			glance: [],
			contacts: { websites: [], offices: [] },
			government: [],
			courts: [],
			practice: [],
			opinions: undefined,
			law: [],
			documents: [],
			jurisdiction: [],
			ties: [],
			enforcement: [],
			stories: [],
			timeline: undefined,
			empty: {} as EmptySections,
			neighbors: [],
			map: undefined,
			sources: [],
			outline: {
				title: page.officialName,
				items: [{ label: 'Review status', link: '#review-status' }]
			} satisfies PageOutline as PageOutline
		};
	}

	const sources = new SourceUses();
	// Each source is filed under the part of the page that first cites it, so a
	// long Sources list folds into groups that follow the page (Trevor, Nov. 23,
	// 2026). The name and seal at the top go with At a glance.
	sources.part('At a glance');
	// The nation's seal or logo, only when its reuse status allows showing it
	// (docs/official-images.md). The Worker serves it from the private bucket.
	// It is shown first, under the name, so its source is numbered first.
	const shownImage = (record.official_images ?? []).find(
		(image) => image.private_copy && imageMayBeShown(image)
	);
	// It has no caption (Trevor, Nov. 22, 2026): the credit, and the statement
	// that the nation does not endorse the site, go in its Sources entry,
	// and a removal request goes through Report a problem.
	// Selecting it opens it larger in the image viewer, with a download button
	// and links to its References entry and to where it is published
	// (src/lib/image-viewer.ts). The viewer leaves out the credit line, which
	// the References entry keeps (Trevor, Nov. 23, 2026).
	let image: NationImage | undefined;
	if (shownImage) {
		const kind = humanize(shownImage.kind);
		// A copy from somewhere other than the nation's own website, such as
		// Wikimedia Commons, names who made it and its license instead.
		const origin = shownImage.credit ?? 'As the nation’s website publishes it.';
		const credit = `${origin} It belongs to the nation, which does not endorse this site.`;
		const sourceNumber = shownImage.source
			? sources.add(shownImage.source, { section: kind, text: credit, where: whereInSource(shownImage) })
			: undefined;
		image = {
			src: imagePath(record.id),
			kind,
			original: shownImage.image_link,
			source: sourceNumber ? `#${sourceAnchor(sourceNumber)}` : undefined
		};
	}

	const nameCitations: CitationMark[] = [];
	// The name gets a marker only where the page shows the listed name on a
	// line of its own; otherwise its source is in the Sources list alone
	// (Trevor, Nov. 22, 2026, asked to remove "Name as the recognizing list gives it").
	if (record.names.official_source) {
		// The page of the nation's entry, from the recognition fact the same source supports.
		const entry = record.recognition?.find((fact) => fact.source === record.names.official_source);
		const nameUse = { section: 'Alias', text: record.names.official, where: entry ? whereInSource(entry) : undefined };
		if (displayName(record.names.official) !== record.names.official) {
			sources.cite(record.names.official_source, nameUse, nameCitations);
		} else {
			sources.add(record.names.official_source, nameUse);
		}
	}
	const selfDesignations = (record.names.self_designation ?? []).map((fact) => {
		const citations: CitationMark[] = [];
		sources.citeFact(fact, 'The nation’s own name', fact.name, citations);
		return { name: fact.name, languageTag: fact.language_tag, citations };
	});

	// Copied only from an authoritative source, never worked out from the
	// spelling (docs/data-model.md, "Names and languages").
	const pronunciations = (record.names.pronunciation ?? []).map((fact) => {
		const recording = webLink(fact.recording);
		const said = [
			fact.respelling,
			fact.phonetic_transcription ? `/${fact.phonetic_transcription}/` : undefined,
			recording ? 'recording' : undefined
		]
			.filter(Boolean)
			.join(', ');
		const citations: CitationMark[] = [];
		sources.citeFact(fact, 'How to say', `${fact.name}: ${said}`, citations);
		return {
			citations,
			name: fact.name,
			languageTag: fact.language_tag,
			respelling: fact.respelling,
			phoneticTranscription: fact.phonetic_transcription,
			recording
		};
	});

	// Sources are numbered in the order the page first cites them, which is
	// the order the page shows them: At a glance comes right after the title.
	const names = [page.listedName, page.officialName];
	const glance = atAGlance(record, sources);
	sources.part(contactsHeading);
	const contacts = contactCard(record, sources);
	sources.part('Map');
	const map = nationMap(record, sources);
	const histories = nationDocumentHistories(record.id);
	sources.part(governmentHeading);
	const government = governmentFacts(
		record,
		sources,
		histories.map((history) => ({
			id: history.id,
			heading: documentHeading(history.title, names),
			versions: history.versions.map((version) => ({ id: version.id, label: labelOf(version, version.id) }))
		}))
	);
	sources.part('Courts and dispute resolution');
	const courts = courtsAndDisputeResolution(record, sources);
	const practice = courtPractice(record, sources);
	sources.part(opinionsHeading);
	const opinions = courtOpinions(record.id, sources);
	// Within Laws and agreements, each document's sources go under its heading.
	const documents = histories.map((history) => {
		const heading = documentHeading(history.title, names);
		sources.part(lawHeading, heading);
		return { ...documentHistoryView(history, sources, names), heading };
	});
	sources.part(lawHeading, documentsLabel);
	const law = [...publishedLaw(record, sources, documents), ...missingLaw(record, documents)];
	sources.part('Jurisdiction');
	const jurisdiction = jurisdictionFacts(record, sources);
	sources.part('Treaties and federal ties');
	const ties = federalTies(record, sources);
	const enforcement = enforcementActions(record, sources);
	// Every dated record on the page on one line, after the sections it
	// repeats, so its markers reuse their sources' numbers.
	const timeline = nationTimeline(record, sources, documents);
	const hasTimeline = timeline.entries.length > 0 || timeline.opinions.length > 0;
	// The nation's stories, each linked to its own page, which carries the
	// story's citations; a restricted or withdrawn story is never listed.
	const stories = nationStorySummaries(record.id);
	// The legal sections always show, and say plainly when nothing was found,
	// so a reader can see whether recourse may be available (Trevor, Nov. 22, 2026).
	const empty: EmptySections = {
		government:
			government.length > 0
				? undefined
				: emptySectionNote(
						'how the nation’s government is set up',
						'A nation can govern itself under a constitution or by tradition that is not published online; its government office can say.',
						searchSummary('governance', record.id)
					),
		courts:
			courts.length > 0 || practice.length > 0
				? undefined
				: emptySectionNote(
						'a court or other forum',
						'A nation can settle disputes through its council or a court that is not listed online; its government office can say.',
						searchSummary('courts', record.id) ?? searchSummary('dispute-resolution', record.id)
					),
		jurisdiction:
			jurisdiction.length > 0
				? undefined
				: emptySectionNote(
						'the nation’s Public Law 280 status or an Indian Child Welfare Act agent',
						'',
						searchSummary('jurisdiction', record.id)
					)
	};
	const result = {
		page,
		image,
		nameCitations,
		selfDesignations,
		pronunciations,
		glance,
		contacts,
		map,
		government,
		courts,
		practice,
		opinions,
		law,
		documents,
		jurisdiction,
		ties,
		enforcement,
		timeline: hasTimeline ? timeline : undefined,
		stories,
		empty,
		neighbors: sameStates(record),
		sources: sources.list
	};

	// The page's outline, for the sidebar: one entry per heading, in the page's order.
	const items: OutlineItem[] = [];
	const hasContacts = contacts.websites.length > 0 || contacts.offices.length > 0;
	if (glance.length > 0 || map) items.push({ label: 'At a glance', link: '#glance-heading' });
	if (hasContacts) items.push({ label: contactsHeading, link: '#contacts-heading' });
	items.push({ label: governmentHeading, link: '#government-heading' });
	items.push({ label: 'Courts and dispute resolution', link: '#courts-heading' });
	if (opinions) items.push({ label: opinionsHeading, link: '#opinions-heading' });
	items.push({
		label: lawHeading,
		link: '#law-heading',
		children: documents.map((document) => ({ label: document.heading, link: `#document-${document.id}` }))
	});
	items.push({ label: 'Jurisdiction', link: '#jurisdiction-heading' });
	if (ties.length > 0 || enforcement.length > 0) items.push({ label: 'Treaties and federal ties', link: '#ties-heading' });
	if (hasTimeline) items.push({ label: timelineHeading, link: '#timeline-heading' });
	if (stories.length > 0) items.push({ label: 'Stories', link: '#stories-heading' });
	if (result.neighbors.length > 0) {
		items.push({ label: 'Nearby Nations', link: '#neighbors-heading' });
	}
	items.push({ label: 'References', link: '#sources-heading' });

	// The sidebar puts the nation and these headings under Directory (src/lib/sidebar-outline.ts).
	const outline: PageOutline = { title: page.officialName, items };
	return { ...result, outline };
};
