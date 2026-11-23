/**
 * A nation's recognition statuses as pages show them: the status in words,
 * and its legal basis with each citation linked to the official text
 * (src/lib/legal-citations.ts). Where nothing in the legal basis can be
 * linked, it links to the source the fact came from.
 */
import { citationParts, shortCitation, type CitationPart } from '../legal-citations.ts';
import { recognitionLabel } from '../nation-labels.ts';
import { recognitionBadge, type RecognitionBadge } from '../recognition-badges.ts';
import { copyPagePath } from '../public-copies.ts';
import { publicCopyFor, sources, type NationRecord } from './content.ts';

export interface RecognitionView {
	/** The status in words, such as "Federally recognized". */
	label: string;
	/** The full legal basis, split into text and linked citations. */
	legalBasis: CitationPart[];
	/** A short form for lists, such as "25 C.F.R. Part 83". */
	short?: CitationPart;
	/** The badge lists show for it; none for no federal recognition (src/lib/recognition-badges.ts). */
	badge?: RecognitionBadge;
}

type RecognitionFact = NonNullable<NationRecord['recognition']>[number];

function sourceLink(fact: RecognitionFact): string | undefined {
	return fact.source ? sources().get(fact.source)?.original_link : undefined;
}

/**
 * Points a linked citation at the copy this site keeps of the document, when
 * it keeps one (src/lib/public-copies.ts), so "108 Stat. 4791" opens quickly
 * from this site. The capture index records the government address.
 */
function toSavedCopy(part: CitationPart): CitationPart {
	const copy = publicCopyFor(part.link);
	return copy ? { ...part, link: copyPagePath(copy) } : part;
}

export function recognitionView(fact: RecognitionFact): RecognitionView {
	const state = typeof fact.state === 'string' ? fact.state : undefined;
	const label = recognitionLabel(fact.type, state);
	const badge = recognitionBadge(fact.type, state);
	if (!fact.legal_basis) return { label, legalBasis: [], badge };
	const fallback = sourceLink(fact);
	const short = shortCitation(fact.legal_basis, fallback);
	return {
		label,
		badge,
		legalBasis: citationParts(fact.legal_basis, fallback).map(toSavedCopy),
		short: short ? toSavedCopy(short) : undefined
	};
}

/**
 * A nation's recognition statuses for a list: one entry per status, so two
 * facts that both say "State recognized (Maryland)" show once. The entry
 * keeps the first short citation found for that status.
 */
export function recognitionViews(record: NationRecord): RecognitionView[] {
	const byLabel = new Map<string, RecognitionView>();
	for (const fact of record.recognition ?? []) {
		const view = recognitionView(fact);
		const existing = byLabel.get(view.label);
		if (!existing) byLabel.set(view.label, view);
		else if (!existing.short && view.short) byLabel.set(view.label, { ...existing, short: view.short });
	}
	return [...byLabel.values()];
}
