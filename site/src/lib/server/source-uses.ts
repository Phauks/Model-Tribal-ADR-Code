/**
 * Collects the sources behind the facts on one nation page, so that every
 * fact stays traceable to its source without a citation mark beside it.
 *
 * Trevor asked (2026-11-21) that the citation for each fact not sit next to
 * the fact. The page instead ends with a "Sources" section: one numbered
 * entry per source, each listing every fact on the page that the source
 * supports, with the place in the source (locator) and the date the value was
 * true (as of). Reading a fact's line under its source gives the same
 * information a numbered note did (docs/citation-style.md).
 */
import type { CitedFact } from './content.ts';
import { sources } from './content.ts';
import { formatSource } from './markdown.ts';

/** One fact as the Sources section names it. */
export interface SourceUse {
	/** The page heading or label the fact appears under, such as "Government contacts". */
	section: string;
	/** The fact as shown on the page, such as "Phone: (505) 455-2273". */
	text: string;
	/** Where in the source, and as of when, such as "Pueblo of San Ildefonso, New Mexico, as of 2026-11-20". */
	where?: string;
}

/** Facts under one heading that a source supports at the same place and date. */
export interface SourceUseGroup {
	section: string;
	where?: string;
	facts: string[];
}

/** One source and the facts it supports, numbered in the order the page first uses it. */
export interface SourceEntry {
	number: number;
	key: string;
	/** The citation, as HTML, in the project's style. */
	html: string;
	/** The facts, grouped so a heading and a locator shared by several facts appear once. */
	groups: SourceUseGroup[];
}

/** The locator and as-of date of a cited fact, as one phrase. */
export function whereInSource(fact: Pick<CitedFact, 'locator' | 'as_of'>): string | undefined {
	const parts = [fact.locator, fact.as_of ? `as of ${fact.as_of}` : undefined].filter(Boolean);
	return parts.length > 0 ? parts.join(', ') : undefined;
}

export class SourceUses {
	readonly #entries = new Map<string, Omit<SourceEntry, 'groups'> & { uses: SourceUse[] }>();
	readonly #citation: (key: string) => string;

	/** citation gives a source's citation as HTML; by default, the short form formatSource writes. */
	constructor(citation: (key: string) => string = (key) => formatSource(sources().get(key), key)) {
		this.#citation = citation;
	}

	/** Records that the source with this key supports one fact on the page, and returns the source's number. */
	add(key: string, use: SourceUse): number {
		let entry = this.#entries.get(key);
		if (!entry) {
			entry = {
				number: this.#entries.size + 1,
				key,
				html: this.#citation(key),
				uses: []
			};
			this.#entries.set(key, entry);
		}
		const repeated = entry.uses.some(
			(existing) =>
				existing.section === use.section &&
				existing.text === use.text &&
				existing.where === use.where
		);
		if (!repeated) entry.uses.push(use);
		return entry.number;
	}

	/** Records the source of a cited fact, if it names one. */
	use(fact: CitedFact | undefined, section: string, text: string): void {
		if (!fact?.source) return;
		this.add(fact.source, { section, text, where: whereInSource(fact) });
	}

	get list(): SourceEntry[] {
		return [...this.#entries.values()].map(({ uses, ...entry }) => {
			const groups: SourceUseGroup[] = [];
			for (const use of uses) {
				const group = groups.find(
					(candidate) => candidate.section === use.section && candidate.where === use.where
				);
				if (group) group.facts.push(use.text);
				else
					groups.push({
						section: use.section,
						where: use.where,
						facts: [use.text]
					});
			}
			return { ...entry, groups };
		});
	}
}
