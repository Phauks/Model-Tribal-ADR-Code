/**
 * Problem reports a nation's team sees and answers (src/lib/nation-team-reports.ts).
 */
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { teamAnswerLabels, teamReportKinds, type TeamAnswerOutcome, type TeamReportKind } from '../nation-team-reports.ts';
import { eventStatement } from './events.ts';
import { now } from './identifiers.ts';
import type { SignedInPerson } from './people.ts';

export interface TeamReport {
	identifier: string;
	reference: string;
	kind: TeamReportKind;
	material: string | null;
	details: string | null;
	receivedAt: string;
	outcome: TeamAnswerOutcome | null;
	note: string | null;
	answeredAt: string | null;
	answeredByName: string | null;
}

const kindList = teamReportKinds.map((kind) => `'${kind}'`).join(', ');

/** Open reports about a nation's page, newest first, without who sent them. */
export async function reportsForTeam(database: D1Database, nationIdentifier: string): Promise<TeamReport[]> {
	const result = await database
		.prepare(
			`SELECT requests.identifier, requests.reference, requests.kind, requests.material, requests.details,
			        requests.received_at AS receivedAt, answers.outcome, answers.note, answers.answered_at AS answeredAt,
			        people.display_name AS answeredByName
			 FROM requests
			 LEFT JOIN nation_team_report_answers AS answers ON answers.request_identifier = requests.identifier
			 LEFT JOIN people ON people.identifier = answers.answered_by
			 WHERE requests.nation_identifier = ? AND requests.kind IN (${kindList}) AND requests.status != 'resolved'
			 ORDER BY requests.received_at DESC
			 LIMIT 100`
		)
		.bind(nationIdentifier)
		.all<TeamReport>();
	return result.results;
}

/** The team's answers to these reports, for the project's list. */
export async function teamAnswersFor(
	database: D1Database,
	requestIdentifiers: string[]
): Promise<Map<string, { outcome: TeamAnswerOutcome }>> {
	const answers = new Map<string, { outcome: TeamAnswerOutcome }>();
	if (requestIdentifiers.length === 0) return answers;
	const result = await database
		.prepare(
			`SELECT request_identifier AS requestIdentifier, outcome FROM nation_team_report_answers
			 WHERE request_identifier IN (SELECT value FROM json_each(?))`
		)
		.bind(JSON.stringify(requestIdentifiers))
		.all<{ requestIdentifier: string; outcome: TeamAnswerOutcome }>();
	for (const row of result.results) answers.set(row.requestIdentifier, { outcome: row.outcome });
	return answers;
}

/** Records the team's answer, once per report, in the report's own history so the project sees it. */
export async function answerReport(
	database: D1Database,
	report: { identifier: string; nationIdentifier: string },
	outcome: TeamAnswerOutcome,
	note: string | null,
	person: SignedInPerson,
	time = now()
): Promise<void> {
	await database.batch([
		database
			.prepare(
				`INSERT INTO nation_team_report_answers (request_identifier, nation_identifier, outcome, note, answered_by, answered_at)
				 VALUES (?, ?, ?, ?, ?, ?)
				 ON CONFLICT (request_identifier) DO UPDATE SET outcome = excluded.outcome, note = excluded.note,
				   answered_by = excluded.answered_by, answered_at = excluded.answered_at`
			)
			.bind(report.identifier, report.nationIdentifier, outcome, note, person.identifier, time),
		eventStatement(database, {
			personIdentifier: person.identifier,
			action: `The nation’s team answered: ${teamAnswerLabels[outcome].toLocaleLowerCase('en-US')}`,
			targetKind: 'request',
			targetIdentifier: report.identifier,
			note
		})
	]);
}
