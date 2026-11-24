/**
 * The rows of the Native nations index and the ways to browse it. The
 * directory at /nations shows every row in one table (Trevor, Nov. 23, 2026:
 * "why not just one big table?"); the short pages, one per first letter and
 * one per state, stay for the links that open a state's nations.
 */
import { foldForSearch } from '../tables/table-definition.ts';
import { displayName, entityTypeLabels, stateName } from '../nation-labels.ts';
import { nationVerification } from '../review-status.ts';
import { nations, type NationRecord } from './content.ts';
import { recognitionViews, type RecognitionView } from './recognition.ts';

export interface NationIndexRow {
	id: string;
	/** The name as pages show it, without states the list adds (displayName). */
	name: string;
	/** The name exactly as the recognizing list gives it. */
	listedName: string;
	entityType: string;
	/** "a" to "z", or "other" for a name that starts with anything else. */
	letter: string;
	/** State and territory codes, such as "NV". */
	states: string[];
	statesText: string;
	/** "Verified" once the nation has reviewed the page, otherwise "Unverified" (src/lib/review-status.ts). */
	review: string;
	verified: boolean;
	recognition: RecognitionView[];
	/** The Bureau of Indian Affairs region that serves the nation, such as "Pacific". */
	region: string;
}

export interface NationGroup {
	entityType: string;
	label: string;
	rows: NationIndexRow[];
}

export interface BrowseLink {
	/** The address segment, such as "a" or "nv". */
	key: string;
	label: string;
	count: number;
}

export const otherLetter = 'other';

function letterOf(name: string): string {
	const first = foldForSearch(name).replace(/^[^\p{L}\p{N}]+/u, '').charAt(0);
	return /[a-z]/.test(first) ? first : otherLetter;
}

function rowOf(record: NationRecord): NationIndexRow {
	const states = [...new Set((record.states ?? []).map((fact) => fact.state))];
	return {
		id: record.id,
		name: displayName(record.names.official),
		listedName: record.names.official,
		entityType: record.entity_type,
		letter: letterOf(displayName(record.names.official)),
		states,
		statesText: states.map(stateName).join(', '),
		review: nationVerification(record.review?.status).label,
		verified: nationVerification(record.review?.status).verified,
		recognition: recognitionViews(record),
		region: record.federal_administration?.bureau_of_indian_affairs_region ?? ''
	};
}

let rowCache: NationIndexRow[] | undefined;

export function nationIndexRows(): NationIndexRow[] {
	rowCache ??= nations()
		.map(rowOf)
		.sort((first, second) => first.name.localeCompare(second.name, 'en', { sensitivity: 'base' }));
	return rowCache;
}

/**
 * Rows grouped by kind of community, in the order of entityTypeLabels. The
 * Native Hawaiian community and the Indigenous peoples of the territories
 * stay in their own groups, never listed as tribes (docs/terms).
 */
export function groupsOf(rows: NationIndexRow[]): NationGroup[] {
	return Object.keys(entityTypeLabels)
		.map((entityType) => ({
			entityType,
			label: entityTypeLabels[entityType],
			rows: rows.filter((row) => row.entityType === entityType)
		}))
		.filter((group) => group.rows.length > 0);
}

/** Every letter from A to Z, with how many pages start with it; then "Other" if any. */
export function letterLinks(): BrowseLink[] {
	const rows = nationIndexRows();
	const links = 'abcdefghijklmnopqrstuvwxyz'.split('').map((letter) => ({
		key: letter,
		label: letter.toLocaleUpperCase('en-US'),
		count: rows.filter((row) => row.letter === letter).length
	}));
	const other = rows.filter((row) => row.letter === otherLetter).length;
	if (other > 0) links.push({ key: otherLetter, label: 'Other', count: other });
	return links;
}

/** Every state or territory with at least one page, sorted by name. */
export function stateLinks(): BrowseLink[] {
	const counts = new Map<string, number>();
	for (const row of nationIndexRows()) {
		for (const state of row.states) counts.set(state, (counts.get(state) ?? 0) + 1);
	}
	return [...counts.entries()]
		.map(([code, count]) => ({ key: code.toLocaleLowerCase('en-US'), label: stateName(code), count }))
		.sort((first, second) => first.label.localeCompare(second.label, 'en'));
}
