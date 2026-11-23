/**
 * What a recognition badge on a nation's page opens: how the nation came to
 * hold that status, when, and the document that shows it (Trevor asked on
 * Nov. 23, 2026: "clicking the badge should invoke how it got that status").
 *
 * Each recognition fact becomes one line. Its kind ("Act of Congress",
 * "Federal acknowledgment process", "State law") is named only when the
 * fact's own legal basis says so; otherwise the line gives the legal basis
 * alone. Where the record holds no document for how a federally recognized
 * nation was first recognized, the panel says so instead of guessing.
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
}

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
	if (fact.type === 'federal') {
		if (fact.source === federalListSource && !fact.petition_number && /Fed\. Reg\./.test(basis) && !/Pub\. L\./.test(basis)) {
			return 'On the federal list of recognized tribes';
		}
		if (/Pub\. L\.|Public Law|P\.L\. \d/.test(basis)) return 'Act of Congress';
		if (/[Ff]inal [Dd]etermination/.test(basis)) return 'Federal acknowledgment process';
		if (/Assistant Secretary|administratively/.test(basis)) return 'Decision of the Assistant Secretary – Indian Affairs';
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
			since: fact.since ? readableDate(fact.since) : undefined
		});
	}
	const federal = facts.some((fact) => fact.type === 'federal');
	const onlyTheList = federal && lines.every((line) => line.how === 'On the federal list of recognized tribes');
	const gap = onlyTheList
		? 'This site has not yet found the document by which the United States first recognized this nation. The federal list is the current record of its status.'
		: lines.every((line) => line.legalBasis.length === 0)
			? 'This site’s record does not yet say how the nation came to hold this status.'
			: undefined;
	return { label, lines, gap };
}
