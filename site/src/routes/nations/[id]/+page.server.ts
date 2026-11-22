import { error } from '@sveltejs/kit';
import type { OutlineItem, PageOutline } from '#lib/site-sections.ts';
import geometry from 'virtual:map-geometry';
import { webLink } from '#lib/contact-links.ts';
import { contactCards, contactsHeading, type ContactCards } from '#lib/contact-card.ts';
import { imageMayBeShown, imagePath } from '#lib/official-images.ts';
import {
	nations,
	sources as sourceRecords,
	type CitedFact,
	type NationRecord
} from '#lib/server/content.ts';
import { layoutPresenceMap } from '#lib/presence-map.ts';
import { documentHistoriesFor } from '#lib/server/document-history.ts';
import { nationServices, type ServiceCategory } from '#lib/nation-services.ts';
import { SourceUses, type CitationMark } from '#lib/server/source-uses.ts';
import { recognitionView } from '#lib/server/recognition.ts';
import type { CitationPart } from '#lib/legal-citations.ts';
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
	/** The markers of the fact's sources (src/lib/citation-marks.ts). */
	citations?: CitationMark[];
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

function atAGlance(record: NationRecord, sources: SourceUses): FactGroup[] {
	const statesLabel = 'States with a presence';
	const stateItems = new Map<string, FactItem>();
	for (const fact of record.states ?? []) {
		const presence = fact.presence ? humanize(fact.presence).toLocaleLowerCase('en-US') : '';
		let item = stateItems.get(fact.state);
		if (item) {
			if (presence && !item.detail?.includes(presence)) {
				item.detail = [item.detail, presence].filter(Boolean).join('; ');
			}
		} else {
			item = { text: stateName(fact.state), detail: presence || undefined, citations: [] };
			stateItems.set(fact.state, item);
		}
		sources.citeFact(
			fact,
			statesLabel,
			`${stateName(fact.state)}${presence ? ` (${presence})` : ''}`,
			item.citations
		);
	}

	const recognitionLabel = 'Recognition';
	const regionLabel = 'Bureau of Indian Affairs region';
	const languagesLabel = 'Heritage languages';
	const administration = record.federal_administration;
	return [
		...group(
			'recognition',
			recognitionLabel,
			(record.recognition ?? []).map((fact) => {
				const view = recognitionView(fact);
				return cited(sources, recognitionLabel, fact, {
					text: view.label,
					detail: fact.legal_basis,
					detailParts: view.legalBasis.length > 0 ? view.legalBasis : undefined
				});
			})
		),
		...group('states', statesLabel, [...stateItems.values()]),
		...group(
			'federal_administration',
			regionLabel,
			administration?.bureau_of_indian_affairs_region
				? [
						cited(sources, regionLabel, administration, {
							text: administration.bureau_of_indian_affairs_region,
							link: `/nations/map#${regionAnchor(administration.bureau_of_indian_affairs_region)}`,
							detail: administration.bureau_of_indian_affairs_agency
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
		)
	];
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

function publishedLaw(record: NationRecord, sources: SourceUses): FactGroup[] {
	const lawLabel = 'Dispute resolution law';
	const documentsLabel = 'Where the nation publishes its laws';
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
			(record.governing_documents ?? []).map((fact) =>
				cited(sources, documentsLabel, fact, {
					text: fact.title ?? humanize(fact.kind),
					link: webLink(fact.link),
					detail: fact.title ? humanize(fact.kind) : undefined
				})
			)
		)
	];
}

/**
 * Short sentences generated only from cited facts, never inferred from
 * silence and never comparing one nation with another (site/DESIGN.md,
 * "Nation pages"). Each sentence's sources are listed under "Recorded
 * features" in the Sources section.
 */
function recordedFeatures(record: NationRecord, sources: SourceUses): FactItem[] {
	const section = 'Recorded features';
	const features: FactItem[] = [];
	const feature = (text: string, facts: CitedFact[]) => {
		const citations: CitationMark[] = [];
		for (const fact of facts) sources.citeFact(fact, section, text, citations);
		features.push({ text, citations });
	};

	const peacemaking = [
		...(record.justice_institutions ?? []),
		...(record.dispute_resolution?.forums ?? [])
	].filter((fact) => fact.kind.includes('peacemaking'));
	if (peacemaking.length > 0) {
		feature('A source records a peacemaking program or forum.', peacemaking);
	}

	const appeals = (record.justice_institutions ?? []).filter(
		(fact) => fact.kind === 'court-of-appeals'
	);
	if (appeals.length > 0) feature('A source records a court of appeals.', appeals);

	const laws = record.dispute_resolution_law ?? [];
	if (laws.length > 0) {
		const text = 'The nation has published law on peacemaking, mediation or a related process.';
		const citations: CitationMark[] = [];
		for (const key of laws) sources.cite(key, { section, text }, citations);
		features.push({ text, citations });
	}

	const states = [...new Set((record.states ?? []).map((fact) => fact.state))];
	if (states.length > 1) {
		feature(
			`Sources record a presence in ${states.length} states and territories: ${states
				.map(stateName)
				.join(', ')}.`,
			record.states ?? []
		);
	}

	return features;
}

/**
 * The small map of the states where sources record the nation's presence
 * (state presence only, never the nation's land). It reuses the shapes of the
 * nations map, simplified for a small drawing, and shows only the boxes that
 * hold the nation's states, the main one zoomed to them (src/lib/presence-map.ts).
 * It is left out when no state is recorded.
 */
const zoomedPaths = new Map(geometry.zoomedStates.map((state) => [state.code, state.path]));

function presenceMap(record: NationRecord, sources: SourceUses) {
	const present = new Set((record.states ?? []).map((fact) => fact.state));
	if (present.size === 0) return undefined;
	sources.add('census-cartographic-boundary-states-2017', {
		section: 'Map of states with a presence',
		text: 'state and territory outlines, through us-atlas 3.0.1'
	});
	return {
		...layoutPresenceMap(geometry.frames, geometry.smallStates, present, zoomedPaths),
		stateNames: [...present].map(stateName).sort((first, second) => first.localeCompare(second, 'en'))
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
		review: { ...status, lastVerified: record.review?.last_verified },
		withdrawn: record.review?.status === 'withdrawn-at-request'
	};

	if (page.withdrawn) {
		return {
			page,
			image: undefined,
			nameCitations: [],
			selfDesignations: [],
			pronunciations: [],
			features: [],
			glance: [],
			contacts: { websites: [], offices: [] },
			courts: [],
			law: [],
			documents: [],
			map: undefined,
			sources: [],
			outline: {
				title: page.officialName,
				items: [{ label: 'Review status', link: '#review-heading' }]
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
	let image: { src: string; kind: string; foundOn?: string; citations: CitationMark[] } | undefined;
	if (shownImage) {
		const kind = humanize(shownImage.kind);
		const citations: CitationMark[] = [];
		sources.citeFact(shownImage, kind, 'As the nation’s website publishes it', citations);
		const foundOn = shownImage.source ? sourceRecords().get(shownImage.source) : undefined;
		image = { src: imagePath(record.id), kind, foundOn: webLink(foundOn?.original_link), citations };
	}

	const nameCitations: CitationMark[] = [];
	if (record.names.official_source) {
		sources.cite(
			record.names.official_source,
			{ section: 'Name as the recognizing list gives it', text: record.names.official },
			nameCitations
		);
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

	const result = {
		page,
		image,
		nameCitations,
		selfDesignations,
		pronunciations,
		features: recordedFeatures(record, sources),
		glance: atAGlance(record, sources),
		contacts: contactCard(record, sources),
		map: presenceMap(record, sources),
		courts: courtsAndDisputeResolution(record, sources),
		law: publishedLaw(record, sources),
		documents: documentHistoriesFor(record.id, sources),
		sources: sources.list
	};

	// The page's outline, for the sidebar: one entry per heading the page shows.
	const items: OutlineItem[] = [
		{ label: 'Review status', link: '#review-heading' },
		{ label: 'About this Nation', link: '#about-heading' }
	];
	if (result.glance.length > 0 || result.map) items.push({ label: 'At a glance', link: '#glance-heading' });
	if (result.courts.length > 0) items.push({ label: 'Courts and dispute resolution', link: '#courts-heading' });
	if (result.law.length > 0) items.push({ label: 'Published law', link: '#law-heading' });
	if (result.documents.length > 0) {
		items.push({
			label: 'Document history',
			link: '#documents-heading',
			children: result.documents.map((document) => ({
				label: shortDocumentTitle(document.title, [page.listedName, page.officialName]),
				link: `#document-${document.id}`
			}))
		});
	}
	items.push({ label: 'Sources', link: '#sources-heading' });

	return { ...result, outline: { title: page.officialName, items } satisfies PageOutline as PageOutline };
};

/**
 * A document's title for the sidebar, without the nation's name that opens it
 * ("Navajo Nation–State of Arizona Gaming Compact" becomes "State of Arizona
 * Gaming Compact"), since the sidebar already names the nation above it.
 */
function shortDocumentTitle(title: string, names: string[]): string {
	for (const name of names) {
		for (const dash of ['–', '-', '—']) {
			if (title.startsWith(`${name}${dash}`)) return title.slice(name.length + 1);
		}
	}
	return title;
}
