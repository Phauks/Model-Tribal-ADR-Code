// Words shown for nation record values (schemas/tribe.schema.json).

/** Turns an open-vocabulary value such as "court-of-appeals" into "Court of appeals". */
export function humanize(value: string): string {
	const words = value.replaceAll('-', ' ').replaceAll('_', ' ');
	return words.charAt(0).toLocaleUpperCase('en-US') + words.slice(1);
}

export const reviewStatusLabels: Record<string, { label: string; meaning: string }> = {
	'drafted-from-public-sources': {
		label: 'Drafted from public sources',
		meaning:
			'The project drafted this page from published sources. The nation has not reviewed it yet.'
	},
	'sent-to-nation': {
		label: 'Sent to the nation',
		meaning: 'The project has sent this page to the nation for review. The nation has not replied yet.'
	},
	'reviewed-by-nation': {
		label: 'Reviewed by the nation',
		meaning: 'The nation has reviewed this page. Its corrections are included.'
	},
	'approved-by-nation': {
		label: 'Approved by the nation',
		meaning: 'The nation has approved this page.'
	},
	'withdrawn-at-request': {
		label: 'Withdrawn',
		meaning: 'This material was withdrawn at the nation’s request.'
	}
};

export const entityTypeLabels: Record<string, string> = {
	'native-nation': 'Native nations',
	'native-hawaiian': 'Native Hawaiian community',
	'territorial-indigenous-people': 'Indigenous peoples of the territories',
	'alaska-native-corporation': 'Alaska Native corporations'
};

export const stateNames: Record<string, string> = {
	AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
	CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia',
	HI: 'Hawaiʻi', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas',
	KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts',
	MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana',
	NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico',
	NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
	OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
	TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
	WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', AS: 'American Samoa', GU: 'Guam',
	MP: 'Northern Mariana Islands', PR: 'Puerto Rico', VI: 'United States Virgin Islands'
};

export function stateName(code: string): string {
	return stateNames[code] ?? code;
}

/**
 * The id of a Bureau of Indian Affairs region's row on the map page, such as
 * "region-eastern-oklahoma" for "Eastern Oklahoma".
 */
export function regionAnchor(regionName: string): string {
	return `region-${regionName
		.normalize('NFKD')
		.toLocaleLowerCase('en-US')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')}`;
}
