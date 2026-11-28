/**
 * The path from research to public review of the model code, as the
 * timeline page shows it (/about/timeline). Trevor asked for the page on
 * Nov. 23, 2026.
 *
 * The steps follow the project's gates (docs/roadmap.md) and the
 * recommendation to run drafting the way the Uniform Law Commission runs a
 * drafting committee (research/analyses/2026-11-23-similar-legal-projects.md,
 * section 6b; checked against the sources in
 * research/sessions/2026/2026-11-23-public-review-timeline.md). The page
 * names neither document, since the website does not point readers to the
 * project's internal records.
 *
 * Dates appear only for steps already taken, as those documents record them.
 * No date is given for a step ahead until a document sets one.
 *
 * Text is Markdown and may cite sources as [@key]. Update `updated`, the
 * statuses and the checks whenever a step moves.
 */

export type StepStatus = 'done' | 'now' | 'next' | 'planned';

export interface StepCheck {
	label: string;
	done: boolean;
	/** When it was done, as the roadmap records it. */
	date?: string;
	/** What is done and what is left, for a check the roadmap marks only partly done. */
	note?: string;
}

export interface TimelineStep {
	id: string;
	title: string;
	/** The project's own name for a checkpoint, such as "Gate 1". */
	gate?: string;
	status: StepStatus;
	/** A recorded date or version, never a forecast. */
	when?: string;
	/** One or two sentences, always shown. */
	summary: string;
	/** More on how the step works, folded until the reader opens it. */
	details?: string;
	checks?: StepCheck[];
	/** True for the steps where the public can read and comment on the drafts. */
	publicReview?: boolean;
}

/** The date the statuses below were last checked against the roadmap. */
export const updated = 'Nov. 23, 2026';

export const introduction =
	'This is the path the model code takes from research to public review. Each step waits for the one before it: nothing is drafted until the evidence has been checked and the outline approved. Dates are given only for steps already taken.';

export const steps: TimelineStep[] = [
	{
		id: 'gather-the-evidence',
		title: 'Gather the evidence',
		status: 'done',
		when: 'Began Nov. 20, 2026',
		summary:
			'Collect what Native nations have published about resolving disputes: their codes, court rules, constitutions and peacemaking programs, and the [legal history](/foundations) behind them. Research goes on alongside every later step.'
	},
	{
		id: 'check-the-evidence',
		title: 'Check the evidence',
		gate: 'Gate 1',
		status: 'now',
		when: 'Began Nov. 21, 2026',
		summary:
			'Before anything is drafted, the lead author reviews the research, so the code never describes a practice its sources do not support.',
		checks: [
			{ label: 'Decide where records from bulk databases belong', done: true, date: 'Nov. 21, 2026' },
			{ label: 'Decide how bands within one nation are counted', done: true, date: 'Nov. 21, 2026' },
			{ label: 'Sort the bulk records: keep, relabel or drop', done: true, date: 'Nov. 22, 2026' },
			{ label: 'Adopt the list of dispute resolution methods', done: true, date: 'Nov. 22, 2026' },
			{
				label: 'Resolve duplicate records',
				done: false,
				note: 'Duplicate provisions removed Nov. 22, 2026; doubled source records and forums recorded under two kinds still to do'
			},
			{ label: 'Confirm that every record a draft relies on was read from the actual text', done: false }
		]
	},
	{
		id: 'settle-the-scope-and-outline',
		title: 'Settle the scope and outline',
		gate: 'Gate 2',
		status: 'next',
		when: 'Working outline, version 0.5, Nov. 22, 2026',
		summary:
			'Re-run the analysis on the checked evidence, answer the open questions about what the code covers, and approve its outline.',
		details:
			'The lead author answered most of the scope questions on Nov. 22, 2026. Still open are whether to keep a division on negotiation, which family and child welfare matters to cover, and questions about the book. The lead author approves the outline with the input of the project’s advisors, and the approved version is kept on record, so later editions can change it the same way.'
	},
	{
		id: 'form-a-drafting-committee',
		title: 'Form a drafting committee',
		status: 'planned',
		summary:
			'Drafting follows the committee model of the Uniform Law Commission, which used it with Native nations to write the Model Tribal Secured Transactions Act.[@woessner-2006-super-model-secured-transactions-code]',
		details:
			'The lead author serves as the reporter, the committee’s drafter, as in a Uniform Law Commission committee.[@uniform-law-commission-frequently-asked-questions] The committee is the reporter and the project’s advisors. Tribal judges, peacemaking program staff, Tribal law organizations and any nation that asks are invited as observers, as the Commission invites interested groups to send observers to its committees.[@uniform-law-commission-drafting-committees] Observers speak at meetings but do not vote (project choice).\n\nA reader group of community members and court clerks also reads each draft. Like the American Law Institute’s Members Consultative Group, its readers need not be experts and read the drafts “the way the project’s intended audience would.”[@american-law-institute-how-ali-works]'
	},
	{
		id: 'draft-in-the-open',
		title: 'Draft in the open',
		status: 'planned',
		publicReview: true,
		summary:
			'Each division of the code is drafted with its commentary and posted on this site as soon as it exists, with a version label, for anyone to read and comment on.',
		details:
			'The Uniform Law Commission posts every committee draft “for review and comment,” and its drafting meetings are open to the public.[@uniform-law-commission-frequently-asked-questions; @uniform-law-commission-drafting-committees] Before a provision is adopted, the committee tests it against written case studies, as the committee that drafted the secured transactions act did.[@woessner-2006-super-model-secured-transactions-code]\n\nPeacemaking provisions are drafted as a division of their own, never as a kind of mediation or arbitration, as the [charter](/charter) commits.'
	},
	{
		id: 'read-line-by-line',
		title: 'Read each division line by line',
		status: 'planned',
		publicReview: true,
		summary:
			'Before a division is called finished, the committee reads it through line by line in a meeting open to observers.',
		details:
			'The Uniform Law Commission presents its drafts for “line-by-line reading and debate” at its Annual Meeting.[@uniform-law-commission-drafting-committees]'
	},
	{
		id: 'consult-the-nations',
		title: 'Consult the nations named',
		gate: 'Gate 3',
		status: 'planned',
		publicReview: true,
		summary:
			'Every nation whose law is cited or described is offered the chance, through its own offices, to review what the work says about it before publication.',
		details:
			'Each nation’s page shows where its review stands, from “drafted from public sources” to “approved by nation,” as the [charter](/charter) sets out. A nation can also ask at any time to correct, restrict or remove material about it.'
	},
	{
		id: 'publish-the-first-edition',
		title: 'Publish the 1st Edition',
		status: 'planned',
		summary:
			'The website, the printed book and the ebook are published together from the same text. Later editions go through the same steps.'
	}
];

/** How long the same kind of work has taken elsewhere, since no dates are set for the steps ahead. */
export const comparison =
	'No dates are set for the steps ahead, because each one waits on the step before it. For comparison, Uniform Law Commission drafting committees typically meet three times a year for at least two years.[@uniform-law-commission-drafting-committees] The Model Tribal Secured Transactions Act took four years of drafting, from 2001 to August 2005.[@woessner-2006-super-model-secured-transactions-code] The Crow Nation’s legislature then debated it for several months and adopted it by a vote of 17 to 1 in April 2006.[@federal-reserve-bank-minneapolis-2006-crow-nation-adopts-secured-transactions-code]';

export const statusLabels: Record<StepStatus, string> = {
	done: 'Done',
	now: 'We are here',
	next: 'Next',
	planned: 'Planned'
};
