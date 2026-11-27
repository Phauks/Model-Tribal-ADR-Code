/**
 * A Supreme Court case as the Justice timelines show it: the bench chart on
 * the Court, Justice and President pages and the Supreme Court timeline
 * (Trevor, Nov. 27, 2026: "while hovering over a case, showcase the name of
 * the case, show which justices were involved"; "one timeline for all cases
 * as well"). Built from the case records' `supreme_court` block by
 * src/lib/server/chart-cases.ts; shared by the server and the browser.
 */

/** How one Justice voted: with the majority, in dissent, took no part, or the record does not say. */
export type BenchVote = 'majority' | 'dissent' | 'none' | 'unknown';

export interface CaseVote {
	/** The Justice's key (people.yaml), which the chart's rows also carry, to put the vote on the right bar. */
	person: string;
	/** "Holmes", "Van Devanter". */
	name: string;
	/** The Justice's page. */
	link: string;
	vote: BenchVote;
	/** What the Justice wrote or joined, when the record says: "opinion of the Court", "dissenting opinion". */
	opinion?: string;
	/** The Justice wrote an opinion of their own. */
	wrote?: true;
	chief?: true;
}

/** Unanimous, divided, divided evenly, or a tally the record does not give. */
export type CaseOutcome = 'unanimous' | 'divided' | 'equally divided' | 'unknown';

export interface ChartCase {
	key: string;
	name: string;
	/** "228 U.S. 243". */
	citation: string;
	link?: string;
	/** YYYY-MM-DD. */
	decided?: string;
	decidedText?: string;
	/** "White Court". */
	court: string;
	courtLink?: string;
	/** "6–3". */
	tally?: string;
	outcome: CaseOutcome;
	perCuriam?: true;
	/** Every Justice the record names, the Chief Justice first and then by seniority. */
	votes: CaseVote[];
}

export const voteLabels: Record<BenchVote, string> = {
	majority: 'Majority',
	dissent: 'Dissent',
	none: 'Took no part',
	unknown: 'Vote not recorded'
};

/** "Divided, 6–3", "Unanimous, 9–0, per curiam", "Tally not recorded". */
export function outcomeText(item: ChartCase): string {
	const curiam = item.perCuriam ? ', per curiam' : '';
	if (!item.tally) return item.perCuriam ? 'Per curiam' : 'Tally not recorded';
	if (item.outcome === 'equally divided') return `Equally divided Court, ${item.tally}`;
	return `${item.outcome === 'unanimous' ? 'Unanimous' : 'Divided'}, ${item.tally}${curiam}`;
}

/** "Pitney for the Court · Dissent: Holmes", for the timeline's line under each case. */
export function writersText(item: ChartCase): string {
	const writers = item.votes.filter((vote) => vote.wrote);
	const court = writers.find((vote) => /opinion of the Court|plurality|announcing the judgment/.test(vote.opinion ?? ''));
	const dissents = writers.filter((vote) => vote.vote === 'dissent' && /dissent/.test(vote.opinion ?? ''));
	const parts: string[] = [];
	if (court) parts.push(`${court.name} for the Court`);
	else if (item.perCuriam) parts.push('Per curiam');
	if (dissents.length > 0) parts.push(`Dissent: ${dissents.map((vote) => vote.name).join(', ')}`);
	return parts.join(' · ');
}
