/**
 * The names federal laws are known by, by source key, such as "General
 * Allotment Act" for the act of Feb. 8, 1887, ch. 119, whose official title
 * is a sentence long. Used for the context laws on each nation's timeline
 * (src/lib/server/timeline.ts) and for the laws in an essay's outline in the
 * sidebar while it is edited (src/lib/essays/editor-outline.ts).
 */
export const lawNames: Record<string, string> = {
	'indian-removal-act-1830': 'Indian Removal Act',
	'major-crimes-act-1885': 'Major Crimes Act',
	'general-allotment-act-1887': 'General Allotment Act',
	'indian-reorganization-act-1934': 'Indian Reorganization Act',
	'public-law-83-280': 'Public Law 280',
	'indian-civil-rights-act-1968': 'Indian Civil Rights Act of 1968',
	'indian-self-determination-and-education-assistance-act-1975': 'Indian Self-Determination and Education Assistance Act',
	'indian-child-welfare-act-1978': 'Indian Child Welfare Act of 1978',
	'indian-gaming-regulatory-act-1988': 'Indian Gaming Regulatory Act',
	'indian-tribal-justice-act-1993': 'Indian Tribal Justice Act',
	'tribal-law-and-order-act-2010': 'Tribal Law and Order Act of 2010',
	'violence-against-women-reauthorization-act-2013-title-ix': 'Violence Against Women Reauthorization Act of 2013, title IX',
	'violence-against-women-act-reauthorization-act-2022-title-viii': 'Violence Against Women Act Reauthorization Act of 2022, title VIII'
};
