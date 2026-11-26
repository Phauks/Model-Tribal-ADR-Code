/**
 * The opinions in a court case and the report page where each starts (a
 * source record's `opinions` block, schemas/source.schema.json), shared by
 * the case's page and the essay renderer. Trevor, Nov. 24, 2026: "For
 * opinion, concurring, dissenting, all of those, if they exist, we should
 * link to them", and quotes should say "where in the document they were,
 * example (majority opinion, minority, dissent)".
 */

export type OpinionKind =
	| 'majority'
	| 'plurality'
	| 'judgment'
	| 'concurrence'
	| 'special concurrence'
	| 'concurrence in the result'
	| 'concurrence in part and in the judgment'
	| 'concurrence in part and in the result'
	| 'concurrence in part and dissent in part'
	| 'concurrence in part, concurrence in the judgment in part, and dissent in part'
	| 'concurrence in part, concurrence in the result in part, and dissent in part'
	| 'dissent'
	| 'dissent in part'
	| 'per curiam';

export interface OpinionEntry {
	kind: OpinionKind;
	justice: string;
	page: number;
	/** The page of the saved scan that holds it, where that is not counted from the case's first page (an inserted map or blank leaf comes before it). */
	scan_page?: number;
	note?: string;
}

/** What each kind of opinion is called, as a case box's bench line names it (case-facts.ts). */
export const opinionLabels: Record<string, string> = {
	majority: 'opinion of the Court',
	plurality: 'plurality opinion',
	concurrence: 'concurring opinion',
	'special concurrence': 'opinion concurring in the judgment',
	'concurrence in the result': 'concurring in the result',
	'concurrence in the result without opinion': 'concurring in the result, without an opinion',
	'concurrence in part and in the judgment': 'opinion concurring in part and concurring in the judgment',
	'concurrence in part and in the result': 'opinion concurring in part and concurring in the result',
	'concurrence in part and dissent in part': 'opinion concurring in part and dissenting in part',
	'concurrence in part, concurrence in the judgment in part, and dissent in part': 'opinion concurring in part, concurring in the judgment in part, and dissenting in part',
	'concurrence in part, concurrence in the result in part, and dissent in part': 'opinion concurring in part, concurring in the result in part, and dissenting in part',
	'dissent in part': 'opinion dissenting in part',
	judgment: 'opinion announcing the judgment',
	dissent: 'dissenting opinion',
	'coauthored dissent': 'joint dissenting opinion',
	'per curiam': 'per curiam opinion',
	'in chambers': 'opinion in chambers'
};

/** "Opinion of the Court", with a capital, for a heading or the start of a line. */
export function opinionTitle(kind: string): string {
	const label = opinionLabels[kind] ?? kind;
	return label[0].toUpperCase() + label.slice(1);
}

/** A justice's surname: "John Marshall" is "Marshall". */
export function surname(name: string): string {
	return name.replace(/,?\s+(?:Jr\.|Sr\.|II|III)$/, '').trim().split(/\s+/).pop() ?? name;
}

/** The first page a pinpoint names: "p. 559", "pp. 536-538" and "559 n.3" all start at 559. */
export function firstPage(pinpoint: string | null | undefined): number | undefined {
	const match = /(\d{1,5})/.exec(pinpoint ?? '');
	return match ? Number(match[1]) : undefined;
}

/**
 * The opinion a page falls in: the last one that starts on or before it.
 * A page before the first opinion, such as the reporter's statement of the
 * case, falls in none.
 */
export function opinionAt(opinions: OpinionEntry[] | undefined, page: number | undefined): OpinionEntry | undefined {
	if (!opinions?.length || page === undefined) return undefined;
	return [...opinions].sort((first, second) => first.page - second.page).filter((opinion) => opinion.page <= page).at(-1);
}

/** How a quotation names the opinion it comes from: "Opinion of the Court (Marshall)", "Concurring opinion (McLean)". */
export function quoteOpinionLabel(opinion: OpinionEntry): string {
	return opinion.kind === 'per curiam' ? 'Per curiam opinion' : `${opinionTitle(opinion.kind)} (${surname(opinion.justice)})`;
}
