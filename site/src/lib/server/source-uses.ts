/**
 * Collects the sources cited on one page and numbers them in the order the
 * page first cites them, for the page's Sources section
 * (src/lib/components/SourceList.svelte).
 *
 * A fact or sentence shown on the page gets a numbered marker beside it, as
 * Wikipedia shows citations (Trevor, Nov. 22, 2026; site/DESIGN.md, section 6,
 * "Citations"): cite() and citeFact() record the use and return the marker.
 * The Sources section lists each source once, links its number back to every
 * marker that cites it, and lists every fact the source supports with the
 * place in the source (locator) and the date the value was true (as of)
 * (docs/citation-style.md). add() and use() record a use that has no marker
 * of its own, such as the outlines a map is drawn from.
 *
 * part() names the part of the page the next citations sit in, such as
 * "Courts". A source keeps the part that first cites
 * it, so a long Sources list can fold into groups that follow the page
 * (Trevor, Nov. 23, 2026; src/lib/source-groups.ts).
 */
import { markAnchor, type CitationMark } from '../citation-marks.ts';
import type { CitedFact } from './content.ts';
import { sources } from './content.ts';
import { formatSource } from './markdown.ts';

export type { CitationMark } from '../citation-marks.ts';

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
	/** The ids of the markers that cite this source, in page order; the Sources list links back to each. */
	backlinks: string[];
	/** The facts, grouped so a heading and a locator shared by several facts appear once. */
	groups: SourceUseGroup[];
	/** The part of the page that first cites the source, such as "Courts". */
	part?: string;
	/** Within that part, the document or heading that first cites it, such as "Gaming compact with Arizona". */
	subpart?: string;
}

/** The locator and as-of date of a cited fact, as one phrase. */
export function whereInSource(fact: Pick<CitedFact, 'locator' | 'as_of'>): string | undefined {
	const parts = [fact.locator, fact.as_of ? `as of ${fact.as_of}` : undefined].filter(Boolean);
	return parts.length > 0 ? parts.join(', ') : undefined;
}

export class SourceUses {
	readonly #entries = new Map<
		string,
		Omit<SourceEntry, 'groups'> & { uses: SourceUse[] }
	>();
	readonly #citation: (key: string) => string;
	#part: { part?: string; subpart?: string } = {};

	/** citation gives a source's citation as HTML; by default, the short form formatSource writes. */
	constructor(citation: (key: string) => string = (key) => formatSource(sources().get(key), key)) {
		this.#citation = citation;
	}

	/**
	 * Names the part of the page, and optionally the document or heading within
	 * it, that the citations recorded next sit in. A source already numbered
	 * keeps the part that first cited it.
	 */
	part(part: string, subpart?: string): void {
		this.#part = { part, subpart };
	}

	/** Records that the source with this key supports one fact on the page, and returns the source's number. */
	add(key: string, use: SourceUse): number {
		let entry = this.#entries.get(key);
		if (!entry) {
			entry = {
				number: this.#entries.size + 1,
				key,
				html: this.#citation(key),
				backlinks: [],
				uses: [],
				...this.#part
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

	/** Records the source of a cited fact, if it names one, with no marker. */
	use(fact: CitedFact | undefined, section: string, text: string): void {
		if (!fact?.source) return;
		this.add(fact.source, { section, text, where: whereInSource(fact) });
	}

	/**
	 * Records that the source supports one fact and returns the marker to show
	 * beside it. When `marks` (the markers already beside the same fact) holds
	 * one for this source, the use is recorded under that marker and no second
	 * marker is made; otherwise the new marker is added to `marks`.
	 */
	cite(key: string, use: SourceUse, marks?: CitationMark[]): CitationMark {
		const number = this.add(key, use);
		const existing = marks?.find((mark) => mark.number === number);
		if (existing) return existing;
		const entry = this.#entries.get(key)!;
		const mark: CitationMark = {
			number,
			anchor: markAnchor(number, entry.backlinks.length + 1),
			where: use.where
		};
		entry.backlinks.push(mark.anchor);
		marks?.push(mark);
		return mark;
	}

	/**
	 * A further marker for a fact the page shows a second time, such as an
	 * entry on its timeline that repeats a treaty listed above it. When the
	 * page already cites the source, the marker links to its entry and no
	 * second line is added to the entry's list of facts; otherwise this is
	 * cite().
	 */
	again(key: string, use: SourceUse): CitationMark {
		const entry = this.#entries.get(key);
		if (!entry) return this.cite(key, use);
		const mark: CitationMark = {
			number: entry.number,
			anchor: markAnchor(entry.number, entry.backlinks.length + 1),
			where: use.where
		};
		entry.backlinks.push(mark.anchor);
		return mark;
	}

	/** cite() for a cited fact: nothing when the fact names no source. */
	citeFact(
		fact: CitedFact | undefined,
		section: string,
		text: string,
		marks?: CitationMark[]
	): CitationMark | undefined {
		if (!fact?.source) return undefined;
		return this.cite(fact.source, { section, text, where: whereInSource(fact) }, marks);
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
