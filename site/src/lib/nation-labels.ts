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
			'This page was drafted from published sources. The nation has not reviewed it yet.'
	},
	'sent-to-nation': {
		label: 'Sent to the nation',
		meaning: 'This page has been sent to the nation for review. The nation has not replied yet.'
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

/**
 * Words for each kind of recognition status (schemas/tribe.schema.json,
 * recognition.type). A state status names its state when the record gives one.
 */
const recognitionTypeLabels: Record<string, string> = {
	federal: 'Federally recognized',
	state: 'State recognized',
	petitioning: 'Petitioning for federal acknowledgment',
	unrecognized: 'No federal recognition',
	'congressional-special-relationship': 'Special relationship recognized by Congress',
	'territorial-law': 'Status under territorial law'
};

export function recognitionLabel(type: string, state?: string): string {
	const label = recognitionTypeLabels[type] ?? humanize(type);
	return state && (type === 'state' || type === 'territorial-law') ? `${label} (${stateName(state)})` : label;
}

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

const stateNamePattern = Object.values(stateNames)
	.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
	.sort((first, second) => second.length - first.length)
	.join('|');
/** ", Arizona, New Mexico, & Utah" or ", Nevada and Utah" at the end of a name. */
const trailingStates = new RegExp(`,\\s*(?:${stateNamePattern})(?:(?:,\\s*|,?\\s+(?:&|and)\\s+)(?:${stateNamePattern}))*\\s*$`, 'u');
/** A name whose last words before the list are "of <State>", as in "Fort Mojave Indian Tribe of Arizona, California & Nevada". */
const endsWithOfState = new RegExp(`\\bof\\s+(?:the\\s+State\\s+of\\s+)?(?:${stateNamePattern})$`, 'u');

/**
 * A nation's name as pages show it: the name on the recognizing list without
 * the states the list adds after a comma, so "Navajo Nation, Arizona, New
 * Mexico, & Utah" shows as "Navajo Nation" (Trevor, Nov. 22, 2026). States
 * that belong to the name itself stay: "Paiute Indian Tribe of Utah" has no
 * comma, and "Fort Mojave Indian Tribe of Arizona, California & Nevada" is
 * left whole because its list continues an "of Arizona". The listed name
 * stays in the record and is shown on the nation's page.
 */
export function displayName(listedName: string): string {
	const name = listedName.trim().replace(/,$/, '').trim();
	const match = trailingStates.exec(name);
	if (!match) return name;
	const before = name.slice(0, match.index).trim();
	if (before === '' || endsWithOfState.test(before)) return name;
	return before;
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

const countWords = ['', 'one', 'both', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/**
 * What sources record in each state, in one line under the states, worded as
 * in the approved nation page (layout A, Nov. 22, 2026): "Land in all three;
 * government office in Arizona". Land comes first, then a government office,
 * then anything else; kinds recorded in the same states share one phrase.
 * `kinds` holds each kind's words ("land", "government office") with its
 * state names; `states` is every state on the line.
 */
export function presenceNote(kinds: [kind: string, states: string[]][], states: string[]): string | undefined {
	const rank = (kind: string) => {
		const index = ['land', 'government office'].indexOf(kind);
		return index === -1 ? 2 : index;
	};
	const groups = new Map<string, { kinds: string[]; states: string[] }>();
	for (const [kind, list] of [...kinds].sort((first, second) => rank(first[0]) - rank(second[0]))) {
		const key = [...list].sort().join('|');
		const group = groups.get(key) ?? { kinds: [], states: list };
		group.kinds.push(kind);
		groups.set(key, group);
	}
	const where = (list: string[]) => {
		if (list.length > 1 && list.length === states.length) {
			const word = countWords[list.length];
			return word === 'both' ? 'both' : `all ${word ?? list.length}`;
		}
		return list.length > 2 ? `${list.slice(0, -1).join(', ')} and ${list.at(-1)}` : list.join(' and ');
	};
	const text = [...groups.values()]
		.map((group) => `${group.kinds.join(' and ')} in ${where(group.states)}`)
		.join('; ');
	return text ? `${text.charAt(0).toLocaleUpperCase('en-US')}${text.slice(1)}` : undefined;
}
