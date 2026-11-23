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
	type NationRecord
} from '#lib/server/content.ts';
import { emptySectionNote, type EmptyNote } from '#lib/search-status.ts';
import { layoutPresenceMap, pointInBox, shapeInBox, shareStateShapes, type BoxLayers, type NationMapData, type PresenceMapLayout } from '#lib/presence-map.ts';
import { landAreaKindLabels } from '#lib/nations-map-drawing.ts';
import { readableDate } from '#lib/readable-date.ts';
import { documentHeading, documentHistoriesFor } from '#lib/server/document-history.ts';
import { nationServices, type ServiceCategory } from '#lib/nation-services.ts';
import { SourceUses, type CitationMark } from '#lib/server/source-uses.ts';
import { recognitionBadges } from '#lib/recognition-badges.ts';
import { recognitionView } from '#lib/server/recognition.ts';
import type { CitationPart } from '#lib/legal-citations.ts';
import { nationIndexRows } from '#lib/server/nation-index.ts';
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

/** What the courts and jurisdiction sections say when they have nothing to show. */
interface EmptySections {
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
		...group(
			'federal_administration',
			regionLabel,
			administration?.bureau_of_indian_affairs_region
				? [
						cited(sources, regionLabel, administration, {
							text: `${administration.bureau_of_indian_affairs_region} Region`,
							link: `/nations/map#${regionAnchor(administration.bureau_of_indian_affairs_region)}`,
							note: administration.bureau_of_indian_affairs_agency
								? `Agency: ${administration.bureau_of_indian_affairs_agency}`
								: undefined
						})
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

/** The names the page gives each jurisdiction topic a record can hold. */
const jurisdictionTopics: Record<string, string> = {
	'public-law-280': 'Public Law 280',
	'indian-child-welfare-act': 'Indian Child Welfare Act',
	'violence-against-women-act-special-tribal-criminal-jurisdiction': 'Violence Against Women Act'
};

/**
 * Jurisdiction: who has authority over what, as federal law and federal lists
 * record it for the nation, such as Public Law 280 or a designated agent for
 * Indian Child Welfare Act notices. Each line is the record's own cited detail.
 */
function jurisdictionFacts(record: NationRecord, sources: SourceUses): FactGroup[] {
	const section = 'Jurisdiction';
	const byTopic = new Map<string, FactItem[]>();
	for (const fact of record.jurisdiction ?? []) {
		const label = jurisdictionTopics[fact.topic] ?? humanize(fact.topic);
		const text = fact.detail ?? humanize(fact.value ?? '');
		if (!text) continue;
		const list = byTopic.get(label) ?? [];
		list.push(cited(sources, section, fact, { label: undefined, text }));
		byTopic.set(label, list);
	}
	return [...byTopic.entries()].map(([label, items]) => ({ field: `jurisdiction-${label}`, label, items }));
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
 * "Other nations in the same states": for each state where sources record
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
		landAreas: areas.map((area) => ({ name: area.name, kind: landAreaKindLabels[area.kind] }))
	};
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
		review: {
			...status,
			lastVerified: record.review?.last_verified ? readableDate(record.review.last_verified) : undefined
		},
		withdrawn: record.review?.status === 'withdrawn-at-request'
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
			courts: [],
			law: [],
			documents: [],
			jurisdiction: [],
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
	// The nation's seal or logo, only when its reuse status allows showing it
	// (docs/official-images.md). The Worker serves it from the private bucket.
	// It is shown first, under the name, so its source is numbered first.
	const shownImage = (record.official_images ?? []).find(
		(image) => image.private_copy && imageMayBeShown(image)
	);
	// It has no caption (Trevor, Nov. 22, 2026): the credit, and the statement
	// that the nation does not endorse the site, go in its Sources entry,
	// and a removal request goes through Report a problem.
	let image: { src: string; kind: string } | undefined;
	if (shownImage) {
		const kind = humanize(shownImage.kind);
		// A copy from somewhere other than the nation's own website, such as
		// Wikimedia Commons, names who made it and its license instead.
		const origin = shownImage.credit ?? 'As the nation’s website publishes it.';
		sources.use(
			shownImage,
			kind,
			`${origin} It belongs to the nation, which does not endorse this site.`
		);
		image = { src: imagePath(record.id), kind };
	}

	const nameCitations: CitationMark[] = [];
	// The name gets a marker only where the page shows the listed name on a
	// line of its own; otherwise its source is in the Sources list alone
	// (Trevor, Nov. 22, 2026, asked to remove "Name as the recognizing list gives it").
	if (record.names.official_source) {
		const nameUse = { section: 'Name as the recognizing list gives it', text: record.names.official };
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
	const contacts = contactCard(record, sources);
	const map = nationMap(record, sources);
	const courts = courtsAndDisputeResolution(record, sources);
	const documents = documentHistoriesFor(record.id, sources).map((document) => ({
		...document,
		heading: documentHeading(document.title, names)
	}));
	const law = [...publishedLaw(record, sources, documents), ...missingLaw(record, documents)];
	const jurisdiction = jurisdictionFacts(record, sources);
	// The legal sections always show, and say plainly when nothing was found,
	// so a reader can see whether recourse may be available (Trevor, Nov. 22, 2026).
	const empty: EmptySections = {
		courts:
			courts.length > 0
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
		courts,
		law,
		documents,
		jurisdiction,
		empty,
		neighbors: sameStates(record),
		sources: sources.list
	};

	// The page's outline, for the sidebar: one entry per heading, in the page's order.
	const items: OutlineItem[] = [];
	const hasContacts = contacts.websites.length > 0 || contacts.offices.length > 0;
	if (glance.length > 0 || map) items.push({ label: 'At a glance', link: '#glance-heading' });
	if (hasContacts) items.push({ label: contactsHeading, link: '#contacts-heading' });
	items.push({ label: 'Courts and dispute resolution', link: '#courts-heading' });
	items.push({
		label: lawHeading,
		link: '#law-heading',
		children: documents.map((document) => ({ label: document.heading, link: `#document-${document.id}` }))
	});
	items.push({ label: 'Jurisdiction', link: '#jurisdiction-heading' });
	if (result.neighbors.length > 0) {
		items.push({ label: 'Other nations in the same states', link: '#neighbors-heading' });
	}
	items.push({ label: 'Sources', link: '#sources-heading' });

	return { ...result, outline: { title: page.officialName, items } satisfies PageOutline as PageOutline };
};
