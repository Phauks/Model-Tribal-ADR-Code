/**
 * The groups of the Government section, in the order the page shows them,
 * and the label each aspect of `governance` gets in its group
 * (schemas/tribe.schema.json; decision record 0042). The aspect a group is
 * named for has no label of its own, so a page reads "Governing body: Tribal
 * Council" and "Head of government: President", never "Name:" or "Title:";
 * the citation says where the value comes from (Trevor, Nov. 27, 2026).
 */
export const governanceGroups: { field: string; label: string; aspects: Record<string, string | undefined> }[] = [
	{ field: 'governance-form', label: 'Form of government', aspects: { form: undefined } },
	{
		field: 'governance-body',
		label: 'Governing body',
		aspects: {
			'governing-body': undefined,
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
			'head-of-government': undefined,
			'head-of-government-selection': 'How chosen',
			'head-of-government-term': 'Term',
			'other-officers': 'Other officers'
		}
	},
	{
		field: 'governance-elections',
		label: 'Elections',
		aspects: { elections: undefined, 'voting-age': 'Voting age', 'election-authority': 'Run by' }
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
			judiciary: undefined,
			'judicial-selection': 'How judges are chosen',
			'judicial-term': 'Judges’ term',
			'judicial-independence': 'Protection'
		}
	},
	{
		field: 'governance-amendment',
		label: 'Changing the governing document',
		aspects: { amendment: undefined, 'secretarial-approval': 'Secretary of the Interior’s approval' }
	},
	{ field: 'governance-removal', label: 'Recall and removal', aspects: { 'recall-and-removal': undefined } },
	{ field: 'governance-other', label: 'Other', aspects: { other: undefined } }
];
