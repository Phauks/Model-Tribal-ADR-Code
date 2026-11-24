/**
 * Problem reports and messages about a claimed nation page go to the
 * nation's team as well as the project (Trevor, Nov. 23, 2026). The team
 * sees what was written and where; it sees who sent it only when the sender
 * ticked "Share my name and contact details with the nation's team", which
 * is ticked from the start when someone writes to the team from the page's
 * badge ("If you claim a page, you have to be willing to take the input",
 * Trevor, Nov. 23, 2026). Requests to restrict or remove material stay with
 * the project, which handles them under docs/requests.md.
 */
export const teamReportKinds = ['correct', 'question', 'contribute'] as const;
export type TeamReportKind = (typeof teamReportKinds)[number];

/** Days the project waits for the team before it steps in. */
export const teamAnswerDays = 7;

export const teamAnswerOutcomes = ['fixed', 'no-change', 'wrote-back'] as const;
export type TeamAnswerOutcome = (typeof teamAnswerOutcomes)[number];

export const teamAnswerLabels: Record<TeamAnswerOutcome, string> = {
	fixed: 'Fixed on the page',
	'no-change': 'No change needed',
	'wrote-back': 'Wrote back to the sender'
};

/** The answers a team can give: writing back only when it can see who sent it. */
export function answersFor(senderShared: boolean): TeamAnswerOutcome[] {
	return teamAnswerOutcomes.filter((outcome) => outcome !== 'wrote-back' || senderShared);
}

/** Where the badge's "Write to the team" link goes for a nation. */
export function writeToTeamLink(nationIdentifier: string): string {
	return `/requests?kind=question&record=${encodeURIComponent(`tribes/${nationIdentifier}`)}&to=team`;
}

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
