/**
 * Links the legal citations inside a recognition status's legal basis to the
 * official text, so "25 C.F.R. Part 83" becomes a link to that part of the
 * Code of Federal Regulations (Trevor asked for this on Nov. 22, 2026). The
 * citation stays in the text, beside the status it supports; the page's
 * Sources section still lists the source the fact came from.
 *
 * Only citations whose official text has a stable address are linked:
 *
 * - Code of Federal Regulations parts and sections: the eCFR, as the
 *   project's regulation source records already use.
 * - United States Code sections: the Legal Information Institute, as the
 *   project's statute source records already use.
 * - Statutes at Large from volume 65 (1951) on, Public Laws from the 104th
 *   Congress (1995) on, and the Federal Register from volume 1 (1936): the
 *   GovInfo link service, which forwards to the PDF of the page cited.
 *   GovInfo's coverage of each collection sets those starting points.
 *
 * Anything else, such as a state statute or an executive order, is left as
 * text here; the nation page then links the whole legal basis to the
 * fact's own source.
 */

export interface CitationPart {
	text: string;
	link?: string;
}

interface CitationRule {
	pattern: RegExp;
	link: (match: RegExpExecArray) => string | undefined;
}

const govinfoLink = 'https://www.govinfo.gov/link';

const rules: CitationRule[] = [
	{
		// 25 C.F.R. § 83.1, 25 C.F.R. §§ 83.1
		pattern: /\b(\d+) C\.F\.R\. §§? ?(\d+)\.(\d+)/g,
		link: (match) => `https://www.ecfr.gov/current/title-${match[1]}/section-${match[2]}.${match[3]}`
	},
	{
		// 25 C.F.R. Part 83, 25 C.F.R. pt. 83
		pattern: /\b(\d+) C\.F\.R\. (?:[Pp]art|pt\.) (\d+)/g,
		link: (match) => `https://www.ecfr.gov/current/title-${match[1]}/part-${match[2]}`
	},
	{
		// 20 U.S.C. § 7512, 25 U.S.C. §§ 5130
		pattern: /\b(\d+) U\.S\.C\. §§? ?(\d+[a-z]?(?:-\d+)?)/g,
		link: (match) => `https://www.law.cornell.edu/uscode/text/${match[1]}/${match[2]}`
	},
	{
		// 108 Stat. 4791
		pattern: /\b(\d+) Stat\. (\d+)/g,
		link: (match) =>
			Number(match[1]) >= 65 ? `${govinfoLink}/statute/${match[1]}/${match[2]}?link-type=pdf` : undefined
	},
	{
		// 50 FR 39047, 26 Fed. Reg. 3073
		pattern: /\b(\d+) (?:FR|Fed\. Reg\.) (\d+)/g,
		link: (match) => `${govinfoLink}/fr/${match[1]}/${match[2]}?link-type=pdf`
	},
	{
		// Pub. L. No. 119-60, Pub. L. 119-60, P.L. 115-121, Public Law 115-121. A
		// territory's own laws ("Guam P.L. 12-226") are not federal law.
		pattern: /(?<!Guam )\b(?:Pub\. L\.(?: No\.)?|P\.L\.|Public Law) (\d+)-(\d+)/g,
		link: (match) =>
			Number(match[1]) >= 104 ? `${govinfoLink}/plaw/${match[1]}/public/${match[2]}?link-type=pdf` : undefined
	}
];

interface Found {
	start: number;
	end: number;
	link: string;
}

/** Every linkable citation in the text, in order, without overlaps. */
function findCitations(text: string): Found[] {
	const found: Found[] = [];
	for (const rule of rules) {
		rule.pattern.lastIndex = 0;
		for (let match = rule.pattern.exec(text); match; match = rule.pattern.exec(text)) {
			const link = rule.link(match);
			if (link) found.push({ start: match.index, end: match.index + match[0].length, link });
		}
	}
	found.sort((first, second) => first.start - second.start);
	const kept: Found[] = [];
	for (const citation of found) {
		const last = kept.at(-1);
		if (!last || citation.start >= last.end) kept.push(citation);
	}
	return kept;
}

/**
 * Splits a legal basis into plain text and linked citations. When nothing in
 * it can be linked and a fallback link is given (the fact's source), the
 * whole text links there.
 */
export function citationParts(text: string, fallbackLink?: string): CitationPart[] {
	const found = findCitations(text);
	if (found.length === 0) return [fallbackLink ? { text, link: fallbackLink } : { text }];
	const parts: CitationPart[] = [];
	let position = 0;
	for (const citation of found) {
		if (citation.start > position) parts.push({ text: text.slice(position, citation.start) });
		parts.push({ text: text.slice(citation.start, citation.end), link: citation.link });
		position = citation.end;
	}
	if (position < text.length) parts.push({ text: text.slice(position) });
	return parts;
}

/** The longest short form shown in a list, such as the nations index. */
const shortFormLimit = 48;

/**
 * A short form of a legal basis for a list: its first linkable citation, or,
 * when there is none, its opening words up to the first semicolon or
 * parenthesis if they are short, linked to the fallback. Undefined when
 * neither fits; the nation's own page then gives the full legal basis.
 */
export function shortCitation(text: string, fallbackLink?: string): CitationPart | undefined {
	const found = findCitations(text);
	// A Public Law older than GovInfo's Public Law collection is still the
	// name a reader knows, so it stands for the act, linked to the act's
	// Statutes at Large page when the text gives one.
	const publicLaw = /\bPub\. L\.(?: No\.)? \d+-\d+/.exec(text);
	const statute = found.find((citation) => / Stat\. /.test(text.slice(citation.start, citation.end)));
	if (publicLaw && statute && !found.some((citation) => citation.start === publicLaw.index)) {
		return { text: publicLaw[0].replace(/^Pub\. L\. (?!No\.)/, 'Pub. L. No. '), link: statute.link };
	}
	const [first] = found;
	if (first) return { text: text.slice(first.start, first.end), link: first.link };
	const opening = text.split(/;| \(/)[0].trim().replace(/[,.]$/, '');
	if (opening.length === 0 || opening.length > shortFormLimit) return undefined;
	return fallbackLink ? { text: opening, link: fallbackLink } : { text: opening };
}
