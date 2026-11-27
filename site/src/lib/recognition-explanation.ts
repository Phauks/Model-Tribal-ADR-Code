/**
 * What a recognition badge on a nation's page opens: how the nation came to
 * hold that status, when, and the document that shows it (Trevor asked on
 * Nov. 23, 2026: "clicking the badge should invoke how it got that status").
 *
 * Each recognition fact becomes one line. Its kind ("Act of Congress",
 * "Federal acknowledgment process", "State law") is named only when the
 * fact's own legal basis says so (a case name such as "Tillie Hardwick v.
 * United States" makes it a court judgment); otherwise the line gives the legal basis
 * alone. Where the record holds no document for how a federally recognized
 * nation was first recognized, the panel gives the earliest record found that
 * shows the United States dealing with it as a recognized nation, by kind
 * (Trevor, Nov. 27, 2026: "the first instance that it shows they were
 * federally recognized"), or says it has none instead of guessing.
 */
import type { CitationPart } from './legal-citations.ts';
import { readableDate } from './readable-date.ts';

export interface ExplanationLine {
	/** How the status came about, such as "Act of Congress"; absent when the record does not say. */
	how?: string;
	/** The legal basis, with its citations linked to the official text. */
	legalBasis: CitationPart[];
	/** When the status took effect, such as "Dec. 22, 1973". */
	since?: string;
	/** The line rests on a match the project inferred, such as a treaty linked by name. */
	unverified?: boolean;
}

export interface BadgeExplanation {
	/** The status in words, such as "Federally recognized". */
	label: string;
	lines: ExplanationLine[];
	/** A sentence for what the record does not hold, such as how the nation was first recognized. */
	gap?: string;
}

export interface ExplainedFact {
	type: string;
	legal_basis?: string;
	source?: string;
	since?: string;
	petition_number?: string;
	/** For the earliest record found, not the act that recognized the nation: its kind (schemas/tribe.schema.json). */
	earliest_record?: string;
	verification?: string;
}

/** What each kind of earliest record is called on the page. */
export const earliestRecordKinds: Record<string, string> = {
	treaty: 'Treaty',
	land: 'Land set aside',
	constitution: 'Constitution approved',
	'federal-list': 'Earliest federal list naming the nation'
};

/** The sentence under an earliest record, when the record holds nothing that conferred the status. */
export const earliestRecordNote = 'This is the earliest record of federal recognition this site has found. The relationship may be older.';

/**
 * Makes a document's name open the document too (Trevor, Nov. 23, 2026: "the
 * name of the document should be clickable"): when a legal basis starts with
 * a name and then a linked citation, as "Menominee Restoration Act, Pub. L.
 * No. 93-197, … 87 Stat. 770", the name gets the citation's link.
 */
export function linkDocumentName(parts: CitationPart[]): CitationPart[] {
	const [first, ...rest] = parts;
	const link = rest.find((part) => part.link)?.link;
	if (!first || first.link || !link) return parts;
	const name = /^(.*?)(,\s*)$/.exec(first.text);
	if (!name || name[1].length === 0) return parts;
	return [{ text: name[1], link }, { text: name[2] }, ...rest];
}

/** The source key of the Bureau of Indian Affairs list of recognized tribes. */
export const federalListSource = 'bia-recognized-entities-2026';

/** How a status came about, as the fact's own legal basis states it. */
export function howRecognized(fact: ExplainedFact): string | undefined {
	const basis = fact.legal_basis ?? '';
	if (fact.type === 'federal' && fact.earliest_record) return earliestRecordKinds[fact.earliest_record];
	if (fact.type === 'federal') {
		if (fact.source === federalListSource && !fact.petition_number && /Fed\. Reg\./.test(basis) && !/Pub\. L\./.test(basis)) {
			return 'On the federal list of recognized tribes';
		}
		if (/Pub\. L\.|Public Law|P\.L\. \d/.test(basis)) return 'Act of Congress';
		if (/[Ff]inal [Dd]etermination/.test(basis)) return 'Federal acknowledgment process';
		if (/Assistant Secretary|administratively/.test(basis)) return 'Decision of the Assistant Secretary – Indian Affairs';
		if (/^[^,]+ v\. United States, No\./.test(basis)) return 'Court judgment';
		return undefined;
	}
	if (fact.type === 'state') {
		if (/[Ee]xecutive [Oo]rder/.test(basis)) return 'Executive order';
		if (/[Rr]esolution/.test(basis)) return 'Legislative resolution';
		if (/\b(Code|Statutes|Laws|Acts)\b|§/.test(basis)) return 'State law';
		if (/^(Listed|Described|Recognized) by/.test(basis)) return 'Listed by a state office';
		return undefined;
	}
	return undefined;
}

/**
 * The explanation for one badge, from the nation's facts of that status. A
 * legal basis two facts share (two petitions recognized by one Act) shows once.
 */
export function explainStatus(
	label: string,
	facts: readonly ExplainedFact[],
	parts: (fact: ExplainedFact) => CitationPart[]
): BadgeExplanation {
	const seen = new Set<string>();
	const lines: ExplanationLine[] = [];
	for (const fact of facts) {
		const key = fact.legal_basis ?? `${fact.source}`;
		if (seen.has(key)) continue;
		seen.add(key);
		lines.push({
			how: howRecognized(fact),
			legalBasis: fact.legal_basis ? linkDocumentName(parts(fact)) : [],
			since: fact.since ? readableDate(fact.since) : undefined,
			unverified: fact.verification === 'inferred' || undefined
		});
	}
	const federal = facts.some((fact) => fact.type === 'federal');
	const earliest = new Set(Object.values(earliestRecordKinds));
	const onlyTheList = federal && lines.every((line) => line.how === 'On the federal list of recognized tribes');
	const onlyEarliest =
		federal && lines.some((line) => line.how && earliest.has(line.how)) && lines.every((line) => line.how === 'On the federal list of recognized tribes' || (line.how && earliest.has(line.how)));
	const gap = onlyTheList
		? 'This site has not yet found the document by which the United States first recognized this nation. The federal list is the current record of its status.'
		: onlyEarliest
			? earliestRecordNote
			: lines.every((line) => line.legalBasis.length === 0)
			? 'This site’s record does not yet say how the nation came to hold this status.'
			: undefined;
	return { label, lines, gap };
}
