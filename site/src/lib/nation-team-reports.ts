/**
 * Problem reports about a claimed nation page go to the nation's team as
 * well as the project (Trevor, Nov. 23, 2026). The team sees what is wrong
 * and where, never who sent it; requests to restrict or remove material stay
 * with the project, which handles them under docs/requests.md.
 */
export const teamReportKinds = ['correct', 'question', 'contribute'] as const;
export type TeamReportKind = (typeof teamReportKinds)[number];

/** Days the project waits for the team before it steps in. */
export const teamAnswerDays = 7;

export const teamAnswerOutcomes = ['fixed', 'no-change'] as const;
export type TeamAnswerOutcome = (typeof teamAnswerOutcomes)[number];

export const teamAnswerLabels: Record<TeamAnswerOutcome, string> = {
	fixed: 'Fixed on the page',
	'no-change': 'No change needed'
};

export function isTeamReportKind(kind: string): kind is TeamReportKind {
	return (teamReportKinds as readonly string[]).includes(kind);
}

/** What the project's list says about the team's part in a report. */
export function teamReportState(
	answer: { outcome: TeamAnswerOutcome } | undefined,
	receivedAt: string,
	time: Date = new Date()
): string {
	if (answer) return `Team: ${teamAnswerLabels[answer.outcome].toLocaleLowerCase('en-US')}`;
	const days = Math.floor((time.getTime() - Date.parse(receivedAt)) / (24 * 60 * 60 * 1000));
	return days >= teamAnswerDays ? `Team: no answer in ${teamAnswerDays} days` : 'With the nation’s team';
}
