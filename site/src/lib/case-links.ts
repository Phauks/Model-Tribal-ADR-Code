/**
 * Links to the cases a court cites inside a quoted paragraph (Trevor, Nov.
 * 23, 2026: "if we have the links to those other cited cases, can we make it
 * so we can link and click into those cases? ... hover on the case name ...
 * to get a preview"). A citation such as "Fisher v. District Court, 424 U.S.
 * 382" is matched to one of the project's case records by its reporter
 * citation, or by the case's name written out in full; the link and the
 * preview come from /cases/previews.json (src/routes/cases/previews.json).
 *
 * Shared by the build, which writes the citation index, and the page, which
 * finds citations in the paragraphs it shows.
 */

/** A case as its preview shows it (LinkPreviews.svelte). */
export interface CasePreview {
	id: string;
	/** The case name, as the record gives it. */
	name: string;
	/** "424 U.S. 382 (1976)". */
	citation: string;
	court: string;
	decided: string;
	/** The holding, from the case's box in an essay, if it has one. */
	holding?: string;
	/** The case's own page, /cases/<key>. */
	link: string;
}

export interface CasePreviewList {
	cases: CasePreview[];
	/** Reporter citations ("424 us 382", from citationKey) to case ids. */
	citations: Record<string, string>;
}

/** A reporter citation in a form that ignores spacing and periods: "424 U. S. 382" and "424 U.S. 382" are both "424 us 382". */
export function citationKey(volume: string, reporter: string, page: string): string {
	return `${Number(volume)} ${reporter.replace(/[\s.]/g, '').toLowerCase()} ${Number(page)}`;
}

/** The reporter citations in a line such as "21 U.S. 543", "96 S. Ct. 943" or "236 Wis. 2d 384". */
export function parseCitation(text: string): { volume: string; reporter: string; page: string } | undefined {
	const match = /^\s*(\d{1,4})\s+([A-Z][A-Za-z.' ]{0,24}?(?:\s?(?:2d|3d|4th))?)\s+(\d{1,5})\s*$/.exec(text);
	return match ? { volume: match[1], reporter: match[2], page: match[3] } : undefined;
}

// A volume, a reporter of capitalized abbreviations (and "2d", "3d", "4th"), and a first page.
const citationPattern = /\b(\d{1,4})\s+((?:[A-Z][A-Za-z']{0,7}\.?\s?){1,4}(?:(?:2d|3d|4th)\s?)?)\s*(\d{1,5})\b/g;

/** A stretch of a paragraph that names a case the project has a record of. */
export interface CaseMention {
	start: number;
	end: number;
	id: string;
}

function firstWordOfName(name: string): string | undefined {
	const first = name.replace(/^(?:ex parte|in re)\s+/i, '').split(/\s+/)[0];
	return first && first.length > 1 ? first.replace(/[^\p{L}'’]/gu, '') : undefined;
}

/**
 * The case citations in a paragraph that match a record: the case name and
 * its first reporter citation together where the name can be found just
 * before the citation, or the citation alone; then full case names written
 * without a citation ("Williams v. Lee, supra").
 */
export function caseMentions(text: string, list: CasePreviewList): CaseMention[] {
	const byIdentifier = new Map(list.cases.map((entry) => [entry.id, entry]));
	const mentions: CaseMention[] = [];
	for (const match of text.matchAll(citationPattern)) {
		const id = list.citations[citationKey(match[1], match[2], match[3])];
		const entry = id ? byIdentifier.get(id) : undefined;
		if (!entry) continue;
		let start = match.index;
		const end = match.index + match[0].length;
		// The case name ends with ", " just before the citation.
		const before = text.slice(Math.max(0, start - 200), start);
		const word = firstWordOfName(entry.name);
		if (word && /,\s*$/.test(before)) {
			let at = before.lastIndexOf(word);
			const between = at >= 0 ? before.slice(at) : '';
			const prefix = /(?:ex parte|in re)\s+$/i.exec(before.slice(0, Math.max(0, at)));
			if (at >= 0 && !/[;()]/.test(between) && (/\sv\.\s/.test(between) || prefix)) {
				if (prefix) at -= prefix[0].length;
				start = start - before.length + at;
			}
		}
		if (mentions.some((mention) => mention.start < end && start < mention.end)) continue;
		mentions.push({ start, end, id: entry.id });
	}
	for (const entry of list.cases) {
		if (entry.name.length < 10 || !/\sv\.\s|^ex parte\s|^in re\s/i.test(entry.name)) continue;
		let from = 0;
		for (;;) {
			const at = text.indexOf(entry.name, from);
			if (at < 0) break;
			from = at + entry.name.length;
			if (mentions.some((mention) => mention.start < from && at < mention.end)) continue;
			mentions.push({ start: at, end: from, id: entry.id });
		}
	}
	return mentions.sort((a, b) => a.start - b.start);
}
