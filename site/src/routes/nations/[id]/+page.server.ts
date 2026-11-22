import { error } from '@sveltejs/kit';
import geometry from 'virtual:map-geometry';
import { emailLink, mapSearchLink, phoneLink, webLink } from '#lib/contact-links.ts';
import { imageMayBeShown, imagePath } from '#lib/official-images.ts';
import {
	nations,
	sources as sourceRecords,
	type CitedFact,
	type NationRecord
} from '#lib/server/content.ts';
import { documentHistoriesFor } from '#lib/server/document-history.ts';
import { SourceUses } from '#lib/server/source-uses.ts';
import { recognitionView } from '#lib/server/recognition.ts';
import type { CitationPart } from '#lib/legal-citations.ts';
import { humanize, regionAnchor, reviewStatusLabels, stateName } from '#lib/nation-labels.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = () => nations().map((record) => ({ id: record.id }));

/**
 * One fact as the page shows it: an optional label, the words, an optional
 * link and a detail in parentheses. Its source is listed in the page's
 * Sources section, not beside it.
 */
interface FactItem {
	label?: string;
	text: string;
	link?: string;
	/** Words for screen readers after the link, such as "on Google Maps". */
	linkHint?: string;
	detail?: string;
	/** A detail with linked citations, such as a status's legal basis; shown in place of detail. */
	detailParts?: CitationPart[];
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

/** Shows a fact and records its source under the group's label. */
function cited(sources: SourceUses, section: string, fact: CitedFact, item: FactItem): FactItem {
	sources.use(fact, section, [item.label, item.text].filter(Boolean).join(': '));
	return item;
}

/** A contact as the page shows it, with a link a reader can act on where one makes sense. */
function contactItem(fact: {
	kind: string;
	value: string;
	label?: string;
	link_status?: string;
	link_checked?: string;
}): FactItem {
	const detail = fact.label;
	switch (fact.kind) {
		case 'website':
			// A lapsed domain no longer belongs to the nation, so it is never linked.
			if (fact.link_status === 'lapsed') {
				const checked = fact.link_checked ? ` (checked ${fact.link_checked})` : '';
				return {
					text: fact.value,
					detail: [detail, `No longer the nation's website${checked}`].filter(Boolean).join('; ')
				};
			}
			return { text: fact.value, link: webLink(fact.value), detail };
		case 'physical-address':
		case 'mailing-address':
			return {
				label: humanize(fact.kind),
				text: fact.value,
				link: mapSearchLink(fact.value),
				linkHint: 'on Google Maps',
				detail
			};
		case 'phone':
			return { label: 'Phone', text: fact.value, link: phoneLink(fact.value), detail };
		case 'email-general':
			return { label: 'Email', text: fact.value, link: emailLink(fact.value), detail };
		default:
			// Fax numbers and anything else are shown as text: a fax cannot be dialed from a page.
			return { label: humanize(fact.kind), text: fact.value, detail };
	}
}

function atAGlance(record: NationRecord, sources: SourceUses): FactGroup[] {
	const statesLabel = 'States with a presence';
	const stateItems = new Map<string, FactItem>();
	for (const fact of record.states ?? []) {
		const existing = stateItems.get(fact.state);
		const presence = fact.presence ? humanize(fact.presence).toLocaleLowerCase('en-US') : '';
		sources.use(
			fact,
			statesLabel,
			`${stateName(fact.state)}${presence ? ` (${presence})` : ''}`
		);
		if (existing) {
			if (presence && !existing.detail?.includes(presence)) {
				existing.detail = [existing.detail, presence].filter(Boolean).join('; ');
			}
		} else {
			stateItems.set(fact.state, { text: stateName(fact.state), detail: presence || undefined });
		}
	}

	const recognitionLabel = 'Recognition';
	const contactsLabel = 'Government contacts';
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
			'contacts',
			contactsLabel,
			(record.contacts ?? []).map((fact) => cited(sources, contactsLabel, fact, contactItem(fact)))
		),
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

function courtsAndDisputeResolution(record: NationRecord, sources: SourceUses): FactGroup[] {
	const courtsLabel = 'Courts and justice institutions';
	const forumsLabel = 'Dispute resolution forums';
	return [
		...group(
			'justice_institutions',
			courtsLabel,
			(record.justice_institutions ?? []).map((fact) =>
				cited(sources, courtsLabel, fact, {
					text: fact.name,
					link: webLink(fact.link),
					detail: humanize(fact.kind)
				})
			)
		),
		...group(
			'dispute_resolution',
			forumsLabel,
			(record.dispute_resolution?.forums ?? []).map((fact) =>
				cited(sources, forumsLabel, fact, {
					text: fact.name ?? humanize(fact.kind),
					link: webLink(fact.link),
					detail: fact.name ? humanize(fact.kind) : undefined
				})
			)
		)
	];
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
				sources.add(key, { section: lawLabel, text });
				return { text };
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
		for (const fact of facts) sources.use(fact, section, text);
		features.push({ text });
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
		for (const key of laws) sources.add(key, { section, text });
		features.push({ text });
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
 * (decision record 0007: state presence only, never the nation's land). It
 * reuses the shapes of the nations map, simplified for a small drawing, and
 * is left out when no state is recorded.
 */
function presenceMap(record: NationRecord, sources: SourceUses) {
	const present = new Set((record.states ?? []).map((fact) => fact.state));
	if (present.size === 0) return undefined;
	sources.add('census-cartographic-boundary-states-2017', {
		section: 'Map of states with a presence',
		text: 'state and territory outlines, through us-atlas 3.0.1'
	});
	return {
		width: geometry.width,
		height: geometry.height,
		stateNames: [...present].map(stateName).sort((first, second) => first.localeCompare(second, 'en')),
		states: geometry.smallStates
			.map((shape) => ({ ...shape, name: stateName(shape.code), present: present.has(shape.code) }))
			// Shaded states are drawn last, so their outlines sit on top of their neighbors'.
			.sort((first, second) => Number(first.present) - Number(second.present))
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
		officialName: record.names.official,
		review: { ...status, lastVerified: record.review?.last_verified },
		withdrawn: record.review?.status === 'withdrawn-at-request'
	};

	if (page.withdrawn) {
		return {
			page,
			image: undefined,
			selfDesignations: [],
			pronunciations: [],
			features: [],
			glance: [],
			courts: [],
			law: [],
			documents: [],
			map: undefined,
			sources: []
		};
	}

	const sources = new SourceUses();
	if (record.names.official_source) {
		sources.add(record.names.official_source, {
			section: 'Name as the recognizing list gives it',
			text: record.names.official
		});
	}
	const selfDesignations = (record.names.self_designation ?? []).map((fact) => {
		sources.use(fact, 'The nation’s own name', fact.name);
		return { name: fact.name, languageTag: fact.language_tag };
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
		sources.use(fact, 'How to say', `${fact.name}: ${said}`);
		return {
			name: fact.name,
			languageTag: fact.language_tag,
			respelling: fact.respelling,
			phoneticTranscription: fact.phonetic_transcription,
			recording
		};
	});

	// The nation's seal or logo, only when its reuse status allows showing it
	// (docs/official-images.md). The Worker serves it from the private bucket.
	const shownImage = (record.official_images ?? []).find(
		(image) => image.private_copy && imageMayBeShown(image)
	);
	let image: { src: string; kind: string; foundOn?: string } | undefined;
	if (shownImage) {
		const kind = humanize(shownImage.kind);
		sources.use(shownImage, kind, 'As the nation’s website publishes it');
		const foundOn = shownImage.source ? sourceRecords().get(shownImage.source) : undefined;
		image = { src: imagePath(record.id), kind, foundOn: webLink(foundOn?.original_link) };
	}

	return {
		page,
		image,
		selfDesignations,
		pronunciations,
		features: recordedFeatures(record, sources),
		glance: atAGlance(record, sources),
		map: presenceMap(record, sources),
		courts: courtsAndDisputeResolution(record, sources),
		law: publishedLaw(record, sources),
		documents: documentHistoriesFor(record.id, sources),
		sources: sources.list
	};
};
