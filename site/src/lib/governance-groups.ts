/**
 * The groups of the Government section, in the order the page shows them,
 * and the label each aspect of `governance` gets in its group
 * (schemas/tribe.schema.json; decision record 0042).
 */
export const governanceGroups: { field: string; label: string; aspects: Record<string, string | undefined> }[] = [
	{ field: 'governance-form', label: 'Form of government', aspects: { form: undefined } },
	{
		field: 'governance-body',
		label: 'Governing body',
		aspects: {
			'governing-body': 'Name',
			'governing-body-size': 'Members',
			'governing-body-selection': 'How chosen',
			'governing-body-term': 'Term'
		}
	},
	{ field: 'governance-general-council', label: 'General council', aspects: { 'general-council': undefined } },
	{
		field: 'governance-head',
		label: 'Head of government',
		aspects: {
			'head-of-government': 'Title',
			'head-of-government-selection': 'How chosen',
			'head-of-government-term': 'Term',
			'other-officers': 'Other officers'
		}
	},
	{
		field: 'governance-elections',
		label: 'Elections',
		aspects: { elections: 'When', 'voting-age': 'Voting age', 'election-authority': 'Run by' }
	},
	{
		field: 'governance-branches',
		label: 'Branches of government',
		aspects: { branches: undefined, 'separation-of-powers': 'Separation of powers' }
	},
	{
		field: 'governance-judiciary',
		label: 'Courts and judges',
		aspects: {
			judiciary: 'Courts',
			'judicial-selection': 'How judges are chosen',
			'judicial-term': 'Judges’ term',
			'judicial-independence': 'Protection'
		}
	},
	{
		field: 'governance-amendment',
		label: 'Changing the governing document',
		aspects: { amendment: 'How', 'secretarial-approval': 'Secretary of the Interior’s approval' }
	},
	{ field: 'governance-removal', label: 'Recall and removal', aspects: { 'recall-and-removal': undefined } },
	{ field: 'governance-other', label: 'Other', aspects: { other: undefined } }
];
