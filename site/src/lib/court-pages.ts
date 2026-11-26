/**
 * Each court's page address, from the name a record or an opinion gives it
 * (Trevor, Nov. 24, 2026: pages for the courts the site names, design
 * /mnt/project-files/design/stub-pages/). One court can be named several
 * ways ("9th Cir.", "U.S. Court of Appeals for the Ninth Circuit"), so a
 * name is first put in one form, and the page's address is made from that.
 *
 * Shared by the build, which makes the pages (src/lib/server/courts.ts), and
 * the pages that link a court's name to its page.
 */

const ordinalWords: Record<string, string> = {
	'1st': 'First',
	'2d': 'Second',
	'2nd': 'Second',
	'3d': 'Third',
	'3rd': 'Third',
	'4th': 'Fourth',
	'5th': 'Fifth',
	'6th': 'Sixth',
	'7th': 'Seventh',
	'8th': 'Eighth',
	'9th': 'Ninth',
	'10th': 'Tenth',
	'11th': 'Eleventh',
	'd.c.': 'District of Columbia',
	'fed.': 'Federal'
};

const districtParts: Record<string, string> = { N: 'Northern', S: 'Southern', E: 'Eastern', W: 'Western', C: 'Central', M: 'Middle' };

const stateNames = new Set([
	'Alabama',
	'Alaska',
	'Arizona',
	'Arkansas',
	'California',
	'Colorado',
	'Connecticut',
	'Florida',
	'Idaho',
	'Kansas',
	'Michigan',
	'Minnesota',
	'Montana',
	'Nebraska',
	'Nevada',
	'New Mexico',
	'New York',
	'North Dakota',
	'Oklahoma',
	'Oregon',
	'South Dakota',
	'Utah',
	'Washington',
	'Wisconsin',
	'Wyoming'
]);

/** "Okla." to "Oklahoma", as the Indigo Book abbreviates the states in a court's name (src/lib/server/case-citations.ts). */
const stateAbbreviations: Record<string, string> = {
	'Ala.': 'Alabama',
	'Ariz.': 'Arizona',
	'Ark.': 'Arkansas',
	'Cal.': 'California',
	'Colo.': 'Colorado',
	'Conn.': 'Connecticut',
	'Fla.': 'Florida',
	'Kan.': 'Kansas',
	'Mich.': 'Michigan',
	'Minn.': 'Minnesota',
	'Mont.': 'Montana',
	'Neb.': 'Nebraska',
	'Nev.': 'Nevada',
	'N.M.': 'New Mexico',
	'N.Y.': 'New York',
	'N.D.': 'North Dakota',
	'Okla.': 'Oklahoma',
	'Or.': 'Oregon',
	'S.D.': 'South Dakota',
	'Wash.': 'Washington',
	'Wis.': 'Wisconsin',
	'Wyo.': 'Wyoming'
};

const supremeCourt = /^(?:Supreme Court of the United States|U\.S\. Supreme Court)$/;

/** A court's name in one form: "9th Cir." and "U.S. Court of Appeals for the Ninth Circuit" are both "United States Court of Appeals for the Ninth Circuit". */
export function courtName(name: string): string {
	const text = name.trim().replace(/\s+/g, ' ');
	const circuit = /^(\d{1,2}(?:st|d|nd|rd|th)|D\.C\.|Fed\.) Cir\.$/i.exec(text);
	if (circuit) {
		const word = ordinalWords[circuit[1].toLowerCase()];
		if (word) return `United States Court of Appeals for the ${word} Circuit`;
	}
	const appeals = /^(?:United States|U\.S\.) Court of Appeals for the (.+?) Circuit$/i.exec(text);
	if (appeals) {
		const word = ordinalWords[appeals[1].toLowerCase()] ?? appeals[1];
		return `United States Court of Appeals for the ${word} Circuit`;
	}
	if (text === 'Fed. Cl.') return 'United States Court of Federal Claims';
	const shortDistrict = /^([NSEWCM])\.D\. ([A-Z][A-Za-z. ]+)$/.exec(text);
	const shortState = shortDistrict ? stateAbbreviations[shortDistrict[2]] : undefined;
	if (shortDistrict && shortState) return `United States District Court for the ${districtParts[shortDistrict[1]]} District of ${shortState}`;
	const district = /^U\.S\. District Court, ([NSEWCM])\.D\. (.+)$/.exec(text);
	if (district) return `United States District Court for the ${districtParts[district[1]]} District of ${district[2]}`;
	const stateCourt = /^(.+) Supreme Court$/.exec(text);
	if (stateCourt && stateNames.has(stateCourt[1])) return `Supreme Court of ${stateCourt[1]}`;
	return text;
}

/** The part of a court's address after /courts/. */
export function courtKey(name: string): string {
	return courtName(name)
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/&/g, ' and ')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/**
 * The page for a court the site names: the Supreme Court's own pages for the
 * Supreme Court of the United States, else /courts/<key>. Every court a case
 * record or a Tribal court opinion names has a page, so the address is
 * always one the site has.
 */
export function courtPagePath(name: string | undefined): string | undefined {
	if (!name?.trim()) return undefined;
	if (supremeCourt.test(name.trim())) return '/supreme-court';
	const key = courtKey(name);
	return key ? `/courts/${key}` : undefined;
}

/** Whether a name is the Supreme Court of the United States, which has its own pages. */
export function isSupremeCourt(name: string): boolean {
	return supremeCourt.test(name.trim());
}
