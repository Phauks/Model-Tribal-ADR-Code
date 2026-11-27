/**
 * Links for the citations inside a document's text (Trevor, Nov. 27, 2026:
 * "items within the text should link when able"). The document text card
 * (src/lib/components/DocumentText.svelte) shows a copy's words; this module
 * finds the citations in them and links each one:
 *
 * - to its page on this site when the project has one: a case by its
 *   reporter citation ("309 U.S. 506"), a statute by its Public Law number or
 *   its Statutes at Large page, an executive order by its number, a section
 *   of Title 25 of the Code ("25 U.S.C. § 5321", and in a Title 25 text
 *   "section 5321 of this title") and a section of 25 C.F.R.;
 * - to the official text elsewhere, marked as leaving the site (↗), for a
 *   Code section, a regulation, a Statutes at Large page or a Public Law
 *   the site has no page for, at the addresses the reading links already use
 *   (research/reading-links/sites.yaml);
 * - a case the project holds no record of stays plain text, unless the copy
 *   itself already links it (the Caselaw Access Project copies link
 *   case.law, scripts/caselaw/copy_links.py). Guessing a case.law address
 *   from a citation alone can name the wrong case.
 *
 * Text already inside a link is left alone. Shared by the Worker, which
 * looks the citations up in the build's index (src/lib/server/text-link-index.ts),
 * and the tests.
 */
import { citationKey } from './case-links.ts';

/** One citation found in a text. */
export interface FoundCitation {
	/** Where it is in the text. */
	start: number;
	end: number;
	/** The key the index knows it by, such as "case:309 us 506", "usc:25:5321", "pl:100-89". */
	key: string;
	/** The address to use when the index has no page for it, outside this site; none for a case. */
	fallback?: string;
}

/** Reporters that are not case reporters, so a "volume reporter page" match on them is not a case. */
const notCaseReporters = /^(?:U\.?\s?S\.?\s?C|C\.?\s?F\.?\s?R|Stat|Fed\.?\s?Reg|Pub|Cong|Sess|Rev|No|Op|Exec|Sec|Ch|Art|Vol|Doc|Rep|Res|Ann|Code|Comp|Laws|Act)\b/i;

const sectionNumber = String.raw`(\d+[a-z]?(?:[-–]\d+[a-z]?)?)`;

const patterns: { pattern: RegExp; found: (match: RegExpExecArray, options: LinkOptions) => Omit<FoundCitation, 'start' | 'end'> | undefined }[] = [
	{
		// 25 U.S.C. § 1300f, 25 U.S.C. 5342, 25 U.S.C.A. § 1911, 25 USC 5321
		pattern: new RegExp(String.raw`\b(\d{1,2})\s+U\.?\s?S\.?\s?C\.?(?:\s?A\.?)?\s*(?:§§?|[Ss]ec(?:tion)?s?\.?)?\s*${sectionNumber}`, 'g'),
		found: (match) => ({ key: `usc:${Number(match[1])}:${match[2].replace('–', '-')}`, fallback: uscodeLink(match[1], match[2]) })
	},
	{
		// "section 5321 of this title", in a text of Title 25 of the Code
		pattern: new RegExp(String.raw`\b[Ss]ections?\s+${sectionNumber}\s+of\s+this\s+title\b`, 'g'),
		found: (match, options) => (options.codeTitle ? { key: `usc:${options.codeTitle}:${match[1].replace('–', '-')}`, fallback: uscodeLink(options.codeTitle, match[1]) } : undefined)
	},
	{
		// 25 C.F.R. § 83.1, 25 CFR 83.1, 25 C.F.R. pt. 83
		pattern: /\b(\d{1,2})\s+C\.?\s?F\.?\s?R\.?\s*(?:§§?|[Ss]ec(?:tion)?\.?|pt\.|[Pp]art)?\s*(\d+(?:\.\d+[a-z]?)?)/g,
		found: (match) => ({
			key: `cfr:${Number(match[1])}:${match[2]}`,
			fallback: match[2].includes('.') ? `https://www.ecfr.gov/current/title-${Number(match[1])}/section-${match[2]}` : `https://www.ecfr.gov/current/title-${Number(match[1])}/part-${match[2]}`
		})
	},
	{
		// Pub. L. No. 100-89, Public Law 93-638, P.L. 280
		pattern: /\b(?:Pub(?:lic)?\.?\s*L(?:aw|\.)?|P\.\s?L\.)\s*(?:No\.\s*)?(\d{2,3})[-–](\d{1,4})\b/g,
		found: (match) => ({
			key: `pl:${Number(match[1])}-${Number(match[2])}`,
			// GovInfo has the public laws from the 104th Congress (1995) on.
			...(Number(match[1]) >= 104 ? { fallback: `https://www.govinfo.gov/link/plaw/${Number(match[1])}/public/${Number(match[2])}?link-type=html` } : {})
		})
	},
	{
		// 101 Stat. 666
		pattern: /\b(\d{1,3})\s+Stat\.\s+(\d{1,4})\b/g,
		found: (match) => ({ key: `stat:${Number(match[1])}:${Number(match[2])}`, fallback: `https://www.govinfo.gov/link/statute/${Number(match[1])}/${Number(match[2])}` })
	},
	{
		// Exec. Order No. 8473, Executive Order 13175, E.O. 13175
		pattern: /\b(?:Exec(?:utive)?\.?\s*Order|E\.\s?O\.)\s*(?:No\.\s*)?(\d{3,5})\b/g,
		found: (match) => ({ key: `eo:${Number(match[1])}` })
	},
	{
		// 309 U.S. 506, 60 S. Ct. 653, 84 L.Ed. 894, 73 Ariz. 22, 236 P.2d 1011, 23 Ariz.App. 540
		pattern: /\b(\d{1,4})\s+((?:[A-Z][A-Za-z']{0,9}\.?\s?){1,4}(?:(?:2d|3d|4th|5th)\s?)?)(\d{1,5})\b/g,
		found: (match) => {
			const reporter = match[2].trim();
			if (notCaseReporters.test(reporter) || !/\./.test(reporter) && !/^[A-Z]{2,}$/.test(reporter)) return undefined;
			return { key: `case:${citationKey(match[1], reporter, match[3])}` };
		}
	}
];

/** The address of a Code section at the Office of the Law Revision Counsel, which the reading links use too. */
function uscodeLink(title: string, section: string): string {
	return `https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title${Number(title)}-section${section.replace(/[-–].*$/, '')}&num=0&edition=prelim`;
}

export interface LinkOptions {
	/** The Code title the text is from, such as "25", so "section 5321 of this title" can be read. */
	codeTitle?: string;
}

/** The citations in a plain stretch of text, first to last, none overlapping. */
export function citationsInText(text: string, options: LinkOptions = {}): FoundCitation[] {
	const found: FoundCitation[] = [];
	for (const { pattern, found: make } of patterns) {
		pattern.lastIndex = 0;
		for (const match of text.matchAll(pattern)) {
			const start = match.index;
			const end = start + match[0].replace(/\s+$/, '').length;
			if (found.some((other) => start < other.end && end > other.start)) continue;
			const citation = make(match, options);
			if (citation) found.push({ start, end, ...citation });
		}
	}
	return found.sort((a, b) => a.start - b.start);
}

/** The stretches of an HTML text that are words outside any link, with where each starts. */
function textOutsideLinks(html: string): { at: number; text: string }[] {
	const stretches: { at: number; text: string }[] = [];
	let depth = 0;
	let at = 0;
	for (const tag of html.matchAll(/<(\/?)([a-zA-Z][\w-]*)[^>]*>/g)) {
		if (depth === 0 && tag.index > at) stretches.push({ at, text: html.slice(at, tag.index) });
		const name = tag[2].toLowerCase();
		if (name === 'a') depth += tag[1] ? (depth > 0 ? -1 : 0) : 1;
		at = tag.index + tag[0].length;
	}
	if (depth === 0 && at < html.length) stretches.push({ at, text: html.slice(at) });
	return stretches;
}

/** Every citation in an HTML text, outside its links: the keys to look up. */
export function citationKeys(html: string, options: LinkOptions = {}): string[] {
	const keys = new Set<string>();
	for (const stretch of textOutsideLinks(html)) for (const citation of citationsInText(stretch.text, options)) keys.add(citation.key);
	return [...keys];
}

function escapeAttribute(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/**
 * The HTML text with its citations linked: to the page `pages` gives for its
 * key (an address on this site), else to its official text elsewhere, marked
 * as leaving the site.
 */
export function linkCitations(html: string, pages: ReadonlyMap<string, string>, options: LinkOptions = {}): string {
	const stretches = textOutsideLinks(html);
	let output = '';
	let at = 0;
	for (const stretch of stretches) {
		const citations = citationsInText(stretch.text, options);
		if (citations.length === 0) continue;
		output += html.slice(at, stretch.at);
		let inside = 0;
		for (const citation of citations) {
			const page = pages.get(citation.key);
			const target = page ?? citation.fallback;
			if (!target) continue;
			output += stretch.text.slice(inside, citation.start);
			const words = stretch.text.slice(citation.start, citation.end);
			output += page
				? `<a href="${escapeAttribute(page)}" data-cite-link>${words}</a>`
				: `<a href="${escapeAttribute(target)}" class="external" target="_blank" rel="noopener noreferrer" data-cite-link>${words}</a>`;
			inside = citation.end;
		}
		output += stretch.text.slice(inside);
		at = stretch.at + stretch.text.length;
	}
	return output + html.slice(at);
}

/** Links in a signature to the signer's page, such as "U. S. Grant" to President Grant's, matched on the last name. */
export function linkSigners(html: string, signers: { name: string; link: string }[]): string {
	if (signers.length === 0) return html;
	return html.replace(/<span class="signer">([^<]*)<\/span>/g, (whole, words: string) => {
		const name = words.split(',')[0].trim();
		const last = name.split(/\s+/).at(-1)?.toLocaleLowerCase('en-US');
		const signer = signers.find((candidate) => candidate.name.replace(/,?\s+Jr\.?$/, '').split(/\s+/).at(-1)?.toLocaleLowerCase('en-US') === last);
		return signer ? `<span class="signer"><a href="${escapeAttribute(signer.link)}">${words}</a></span>` : whole;
	});
}
