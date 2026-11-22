/**
 * Court names as the Indigo Book abbreviates them in a citation's
 * parenthetical (Indigo Book R10.1.3 and Table T1), and docket numbers in the
 * form "No. 2017-1620" (R10.1.6). A source record keeps the court's full
 * name; the citation prints the abbreviation. The Supreme Court of the United
 * States is left out when the case is in the United States Reports.
 *
 * The same rules as courtAbbreviation() and caseItem() in
 * pdf/pipeline/citations.mjs, so the website and the book cite a case alike
 * (a change to one belongs in the other). Runs at build time.
 */

const ordinals: Record<string, string> = {
	first: '1st',
	second: '2d',
	third: '3d',
	fourth: '4th',
	fifth: '5th',
	sixth: '6th',
	seventh: '7th',
	eighth: '8th',
	ninth: '9th',
	tenth: '10th',
	eleventh: '11th',
	federal: 'Fed.',
	'district of columbia': 'D.C.',
	'd.c.': 'D.C.'
};

const states: Record<string, string> = {
	Alabama: 'Ala.',
	Alaska: 'Alaska',
	Arizona: 'Ariz.',
	Arkansas: 'Ark.',
	California: 'Cal.',
	Colorado: 'Colo.',
	Connecticut: 'Conn.',
	Florida: 'Fla.',
	Idaho: 'Idaho',
	Kansas: 'Kan.',
	Michigan: 'Mich.',
	Minnesota: 'Minn.',
	Montana: 'Mont.',
	Nebraska: 'Neb.',
	Nevada: 'Nev.',
	'New Mexico': 'N.M.',
	'New York': 'N.Y.',
	'North Dakota': 'N.D.',
	Oklahoma: 'Okla.',
	Oregon: 'Or.',
	'South Dakota': 'S.D.',
	Utah: 'Utah',
	Washington: 'Wash.',
	Wisconsin: 'Wis.',
	Wyoming: 'Wyo.'
};

type Abbreviate = (...parts: string[]) => string | null | undefined;

const courts: [RegExp, Abbreviate][] = [
	[/^Supreme Court of the United States$/, () => ''],
	[
		/^(?:United States|U\.S\.) Court of Appeals for the (.+?) Circuit$/i,
		(name) => {
			const ordinal = ordinals[name.toLowerCase()];
			return ordinal ? `${ordinal} Cir.` : null;
		}
	],
	[/^United States Court of Federal Claims$/, () => 'Fed. Cl.'],
	[/^United States Court of Claims$/, () => 'Ct. Cl.'],
	[/^(?:United States|U\.S\.) District Court for the District of (.+)$/, (state) => (states[state] ? `D. ${states[state]}` : null)],
	[
		/^(?:United States|U\.S\.) District Court for the (Northern|Southern|Eastern|Western|Central|Middle) District of (.+)$/,
		(part, state) => (states[state] ? `${part[0]}.D. ${states[state]}` : null)
	],
	[/^U\.S\. District Court, ([NSEWCM])\.D\. (.+)$/, (part, state) => (states[state] ? `${part}.D. ${states[state]}` : null)],
	[
		/^Supreme Court of (Alaska|Wisconsin|Montana|Washington|Arizona|New Mexico|Oklahoma|Minnesota|Idaho|Nevada|California)$/,
		(state) => states[state]
	],
	[/^(Oklahoma|Alaska|Wisconsin|Montana|Washington|Arizona|New Mexico) Supreme Court$/, (state) => states[state]],
	[/^Supreme Court of Guam$/, () => 'Guam'],
	[/^Supreme Court of the Virgin Islands$/, () => 'V.I.'],
	[/^Supreme Court of the Commonwealth of the Northern Mariana Islands$/, () => 'N. Mar. I.']
];

/** The Indigo Book abbreviation of a court's name, or the name itself when there is no rule for it. */
export function courtAbbreviation(authority: unknown, item: Record<string, unknown> = {}): unknown {
	if (typeof authority !== 'string') return authority;
	for (const [pattern, abbreviate] of courts) {
		const match = pattern.exec(authority.trim());
		if (!match) continue;
		const short = abbreviate(...match.slice(1));
		if (short === '' && item['container-title'] !== 'U.S.') return authority;
		if (short !== null && short !== undefined) return short;
	}
	return authority;
}

/** A case's citation data as the citation style needs it: the court abbreviated, a docket number with "No.". */
export function caseItem(citation: Record<string, unknown>): Record<string, unknown> {
	if (citation.type !== 'legal_case') return citation;
	const item = { ...citation };
	const authority = courtAbbreviation(item.authority, item);
	if (authority) item.authority = authority;
	else delete item.authority;
	if (typeof item.number === 'string' && /^\d/.test(item.number.trim())) item.number = `No. ${item.number.trim()}`;
	return item;
}
