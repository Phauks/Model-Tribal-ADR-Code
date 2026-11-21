import { error } from '@sveltejs/kit';
import { emailLink, mapSearchLink, phoneLink, webLink } from '#lib/contact-links.ts';
import { nations, type CitedFact, type NationRecord } from '#lib/server/content.ts';
import { SourceUses } from '#lib/server/source-uses.ts';
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
function contactItem(fact: { kind: string; value: string; label?: string }): FactItem {
	const detail = fact.label;
	switch (fact.kind) {
		case 'website':
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
			(record.recognition ?? []).map((fact) =>
				cited(sources, recognitionLabel, fact, {
					text: humanize(fact.type),
					detail: fact.legal_basis
				})
			)
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
		return { page, selfDesignations: [], features: [], glance: [], courts: [], law: [], sources: [] };
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

	return {
		page,
		selfDesignations,
		features: recordedFeatures(record, sources),
		glance: atAGlance(record, sources),
		courts: courtsAndDisputeResolution(record, sources),
		law: publishedLaw(record, sources),
		sources: sources.list
	};
};
