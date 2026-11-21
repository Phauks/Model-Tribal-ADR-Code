import { error } from '@sveltejs/kit';
import { nations, type CitedFact, type NationRecord } from '#lib/server/content.ts';
import { Notes } from '#lib/server/markdown.ts';
import { humanize, reviewStatusLabels, stateName } from '#lib/nation-labels.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = () => nations().map((record) => ({ id: record.id }));

/** One fact as the page shows it: words, an optional link, and its note numbers. */
interface FactItem {
	text: string;
	link?: string;
	detail?: string;
	notes: number[];
}

/** A labeled group of facts, tied to the record field a "Report a problem" link names. */
interface FactGroup {
	field: string;
	label: string;
	items: FactItem[];
}

/**
 * A record's link, only when it is a complete web address. Anything else,
 * such as "www.example.org" or a note typed into the field, is shown as text
 * and never turned into a link.
 */
function webLink(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined;
	try {
		const url = new URL(value);
		return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined;
	} catch {
		return undefined;
	}
}

function cite(notes: Notes, fact: CitedFact | undefined): number[] {
	if (!fact?.source) return [];
	const locator = [fact.locator, fact.as_of ? `as of ${fact.as_of}` : undefined]
		.filter(Boolean)
		.join(', ');
	return [notes.add(fact.source, locator || undefined)];
}

function group(field: string, label: string, items: FactItem[]): FactGroup[] {
	return items.length > 0 ? [{ field, label, items }] : [];
}

function atAGlance(record: NationRecord, notes: Notes): FactGroup[] {
	const stateItems = new Map<string, FactItem>();
	for (const fact of record.states ?? []) {
		const existing = stateItems.get(fact.state);
		const presence = fact.presence ? humanize(fact.presence).toLocaleLowerCase('en-US') : '';
		if (existing) {
			existing.notes.push(...cite(notes, fact));
			if (presence && !existing.detail?.includes(presence)) {
				existing.detail = [existing.detail, presence].filter(Boolean).join('; ');
			}
		} else {
			stateItems.set(fact.state, {
				text: stateName(fact.state),
				detail: presence || undefined,
				notes: cite(notes, fact)
			});
		}
	}

	const administration = record.federal_administration;
	return [
		...group(
			'recognition',
			'Recognition',
			(record.recognition ?? []).map((fact) => ({
				text: humanize(fact.type),
				detail: fact.legal_basis,
				notes: cite(notes, fact)
			}))
		),
		...group('states', 'States with a presence', [...stateItems.values()]),
		...group(
			'contacts',
			'Government contacts',
			(record.contacts ?? []).map((fact) => ({
				text: fact.kind === 'website' ? fact.value : `${humanize(fact.kind)}: ${fact.value}`,
				link: fact.kind === 'website' ? webLink(fact.value) : undefined,
				detail: fact.label,
				notes: cite(notes, fact)
			}))
		),
		...group(
			'federal_administration',
			'Bureau of Indian Affairs region',
			administration?.bureau_of_indian_affairs_region
				? [
						{
							text: administration.bureau_of_indian_affairs_region,
							detail: administration.bureau_of_indian_affairs_agency,
							notes: cite(notes, administration)
						}
					]
				: []
		),
		...group(
			'languages',
			'Heritage languages',
			(record.languages ?? []).flatMap((fact) =>
				typeof fact.name === 'string' ? [{ text: fact.name, notes: cite(notes, fact) }] : []
			)
		)
	];
}

function courtsAndDisputeResolution(record: NationRecord, notes: Notes): FactGroup[] {
	return [
		...group(
			'justice_institutions',
			'Courts and justice institutions',
			(record.justice_institutions ?? []).map((fact) => ({
				text: fact.name,
				link: webLink(fact.link),
				detail: humanize(fact.kind),
				notes: cite(notes, fact)
			}))
		),
		...group(
			'dispute_resolution',
			'Dispute resolution forums',
			(record.dispute_resolution?.forums ?? []).map((fact) => ({
				text: fact.name ?? humanize(fact.kind),
				link: webLink(fact.link),
				detail: fact.name ? humanize(fact.kind) : undefined,
				notes: cite(notes, fact)
			}))
		)
	];
}

function publishedLaw(record: NationRecord, notes: Notes): FactGroup[] {
	return [
		...group(
			'dispute_resolution_law',
			'Dispute resolution law',
			(record.dispute_resolution_law ?? []).map((key) => ({
				text: 'Published law on dispute resolution',
				notes: [notes.add(key)]
			}))
		),
		...group(
			'governing_documents',
			'Where the nation publishes its laws',
			(record.governing_documents ?? []).map((fact) => ({
				text: fact.title ?? humanize(fact.kind),
				link: webLink(fact.link),
				detail: fact.title ? humanize(fact.kind) : undefined,
				notes: cite(notes, fact)
			}))
		)
	];
}

/**
 * Short sentences generated only from cited facts, never inferred from
 * silence and never comparing one nation with another (site/DESIGN.md,
 * "Nation pages").
 */
function recordedFeatures(record: NationRecord, notes: Notes): FactItem[] {
	const features: FactItem[] = [];

	const peacemaking = [
		...(record.justice_institutions ?? []),
		...(record.dispute_resolution?.forums ?? [])
	].filter((fact) => fact.kind.includes('peacemaking'));
	if (peacemaking.length > 0) {
		features.push({
			text: 'A source records a peacemaking program or forum.',
			notes: peacemaking.flatMap((fact) => cite(notes, fact))
		});
	}

	const appeals = (record.justice_institutions ?? []).filter(
		(fact) => fact.kind === 'court-of-appeals'
	);
	if (appeals.length > 0) {
		features.push({
			text: 'A source records a court of appeals.',
			notes: appeals.flatMap((fact) => cite(notes, fact))
		});
	}

	if ((record.dispute_resolution_law ?? []).length > 0) {
		features.push({
			text: 'The nation has published law on peacemaking, mediation or a related process.',
			notes: (record.dispute_resolution_law ?? []).map((key) => notes.add(key))
		});
	}

	const states = [...new Set((record.states ?? []).map((fact) => fact.state))];
	if (states.length > 1) {
		features.push({
			text: `Sources record a presence in ${states.length} states and territories: ${states
				.map(stateName)
				.join(', ')}.`,
			notes: [...new Set((record.states ?? []).flatMap((fact) => cite(notes, fact)))]
		});
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
		withdrawn: record.review?.status === 'withdrawn-at-request',
		officialNote: [] as number[]
	};

	if (page.withdrawn) {
		return { page, selfDesignations: [], features: [], glance: [], courts: [], law: [], notes: [] };
	}

	const notes = new Notes();
	const officialNote = record.names.official_source ? [notes.add(record.names.official_source)] : [];
	const selfDesignations = (record.names.self_designation ?? []).map((fact) => ({
		name: fact.name,
		languageTag: fact.language_tag,
		notes: cite(notes, fact)
	}));

	return {
		page: { ...page, officialNote },
		selfDesignations,
		features: recordedFeatures(record, notes),
		glance: atAGlance(record, notes),
		courts: courtsAndDisputeResolution(record, notes),
		law: publishedLaw(record, notes),
		notes: notes.list
	};
};
