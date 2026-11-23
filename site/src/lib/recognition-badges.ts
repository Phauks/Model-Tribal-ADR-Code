/**
 * Recognition badges: a short label for each recognition status a Native
 * nation holds, shown under a nation's name, in the nations lists, in search
 * results and in the map's lists (Trevor chose these on Nov. 22, 2026, from
 * the mockups in project files design/recognition-markers/, wording set 2).
 *
 * A badge names a status the nation holds: "Federal", "State: Massachusetts",
 * "Petitioning". No federal recognition gets no badge at all (Trevor: "if no
 * federal, just don't say anything"), so a nation that is only state
 * recognized shows one state badge, and one with no status shows none. The
 * full wording, with its legal basis, stays in the nation page's At a glance
 * box. Each badge also carries the full wording for its tooltip and for
 * screen readers. A recognition status is a legal fact, not a judgment of a
 * nation's standing as a people.
 */
import { stateName } from './nation-labels.ts';

export type RecognitionBadgeKind = 'federal' | 'state' | 'petitioning' | 'territorial' | 'congressional';

export interface RecognitionBadge {
	kind: RecognitionBadgeKind;
	/** The short label on the badge, such as "State: Massachusetts". */
	label: string;
	/** The full wording, such as "State recognized (Massachusetts)", for the tooltip and screen readers. */
	fullLabel: string;
}

/** The federal answer comes first, then the statuses other governments give. */
const badgeOrder: RecognitionBadgeKind[] = ['federal', 'petitioning', 'congressional', 'territorial', 'state'];

/**
 * The badge for one recognition status (schemas/tribe.schema.json,
 * recognition.type), or none for "unrecognized" and any unknown type.
 */
export function recognitionBadge(type: string, state?: string): RecognitionBadge | undefined {
	const place = state ? stateName(state) : undefined;
	switch (type) {
		case 'federal':
			return { kind: 'federal', label: 'Federal', fullLabel: 'Federally recognized' };
		case 'state':
			return {
				kind: 'state',
				label: place ? `State: ${place}` : 'State',
				fullLabel: place ? `State recognized (${place})` : 'State recognized'
			};
		case 'petitioning':
			return { kind: 'petitioning', label: 'Petitioning', fullLabel: 'Petitioning for federal acknowledgment' };
		case 'territorial-law':
			return {
				kind: 'territorial',
				label: place ? `Territorial: ${place}` : 'Territorial',
				fullLabel: place ? `Status under territorial law (${place})` : 'Status under territorial law'
			};
		case 'congressional-special-relationship':
			return { kind: 'congressional', label: 'Congress', fullLabel: 'Special relationship recognized by Congress' };
		default:
			return undefined;
	}
}

/** Sorts badges with the federal answer first, then each state in alphabetical order. */
export function compareBadges(first: RecognitionBadge, second: RecognitionBadge): number {
	return badgeOrder.indexOf(first.kind) - badgeOrder.indexOf(second.kind) || first.label.localeCompare(second.label, 'en');
}

/** A nation's badges: one for each distinct status, in the order of compareBadges. */
export function recognitionBadges(facts: readonly { type: string; state?: unknown }[]): RecognitionBadge[] {
	const byLabel = new Map<string, RecognitionBadge>();
	for (const fact of facts) {
		const badge = recognitionBadge(fact.type, typeof fact.state === 'string' ? fact.state : undefined);
		if (badge && !byLabel.has(badge.label)) byLabel.set(badge.label, badge);
	}
	return [...byLabel.values()].sort(compareBadges);
}
