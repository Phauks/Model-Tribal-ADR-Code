/**
 * Names the document a nation's listed name comes from, for the line under
 * the nation's name ("Listed as … in …"). Trevor asked on Nov. 23, 2026 for
 * the document's own name in place of "the list that recognizes it": the
 * federal list, for example, is cited as Indigo Book cites a Federal
 * Register notice, its title in italics, the volume, first page, the page of
 * the nation's entry and the date.
 */

export interface ListedIn {
	/** The document's title, shown in italics. */
	title: string;
	/** The rest of the citation after the title, such as "91 Fed. Reg. 4102, 4104 (Jan. 30, 2026)". */
	rest?: string;
}

interface CitedDocument {
	kind?: string;
	citation: {
		title?: string;
		'container-title-short'?: string;
		volume?: string | number;
		page?: string | number;
		issued?: { 'date-parts'?: (number | string)[][] };
	};
}

const months = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];

function writtenDate(parts: (number | string)[] | undefined): string | undefined {
	if (!parts || parts.length === 0) return undefined;
	const [year, month, day] = parts.map(Number);
	if (!month) return String(year);
	if (!day) return `${months[month - 1]} ${year}`;
	return `${months[month - 1]} ${day}, ${year}`;
}

/**
 * The document's title and the rest of its citation. `locator` is where in
 * the document the nation's entry is, such as "91 Fed. Reg. 4104"; its page
 * becomes the pinpoint. Undefined when the source has no title.
 */
export function listedIn(document: CitedDocument | undefined, locator?: string): ListedIn | undefined {
	const title = document?.citation.title?.trim();
	if (!document || !title) return undefined;
	const { volume, page } = document.citation;
	const date = writtenDate(document.citation.issued?.['date-parts']?.[0]);
	const reporter = document.citation['container-title-short'];
	if (reporter === 'Fed. Reg.' && volume && page) {
		const first = String(page).split(/[-–]/)[0];
		const pin = locator ? new RegExp(`\\b${volume} Fed\\. Reg\\. (\\d+)`).exec(locator)?.[1] : undefined;
		const pages = pin && pin !== first ? `${first}, ${pin}` : first;
		return { title, rest: `${volume} Fed. Reg. ${pages}${date ? ` (${date})` : ''}` };
	}
	// A title that already gives the date, such as "List of Petitioners by State (as of November 12, 2013)", needs no other.
	const year = document.citation.issued?.['date-parts']?.[0]?.[0];
	return { title, rest: date && !(year && title.includes(String(year))) ? `(${date})` : undefined };
}
