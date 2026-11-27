/**
 * The shapes an item page passes to InfoPage.svelte, the site's one layout
 * for an item, like a wiki's article with its infobox (Trevor, Nov. 24, 2026).
 */
import type { CitationMark } from './citation-marks.ts';

export interface InfoPicture {
	src: string;
	alt: string;
	/** Who made the picture; none for a picture a person gave of themselves. */
	credit?: string;
	/** The picture's page at its source, with its date and rights. */
	original?: string;
	width: number;
	height: number;
}

/** Another name for the item, shown under the title: "Kan-gi-shun-ca, as the Supreme Court Reporter prints it". */
export interface InfoName {
	name: string;
	/** The name's language tag, such as a story's title in the nation's language. */
	language?: string;
	note?: string;
	citations?: CitationMark[];
}

/**
 * Key facts only where it earns its place (Trevor chose option B on Nov.
 * 26, 2026, after a review of 103 pages found the panel mostly repeating the
 * title and lead on treaties, statutes, courts and stubs, project files
 * design/at-a-glance-review/). A page keeps the panel when it has at least
 * this many facts, or a picture, map or other panel; with fewer, its facts
 * join the lead line instead.
 */
export const glancePanelMinimum = 3;

/** On a phone the panel shows this many facts; the rest, and a map, wait behind "Show all". */
export const glancePhoneRows = 4;

/** A fact as the panel and the lead line both show it (FactGroups.svelte). */
interface GlanceGroup {
	label: string;
	items: { text: string; citations?: unknown[] }[];
}

/** Lower case, straight quotes and single spaces, so the same words match however they are typed. */
function plain(text: string): string {
	return text
		.normalize('NFKC')
		.replace(/[‘’]/g, "'")
		.replace(/[“”]/g, '"')
		.replace(/\s+/g, ' ')
		.trim()
		.toLocaleLowerCase('en-US');
}

/** The words appear in the shown text as whole words, not inside another word or number. */
function shownIn(words: string, shown: string): boolean {
	const escaped = words.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, 'u').test(shown);
}

/**
 * The facts without those the title or lead already says, such as a
 * treaty's citation, which is its lead word for word, or its kind and date.
 * A fact stays when it carries its own source markers (a nation's recognition
 * with its legal basis), since the title and lead have none, and when its
 * words are too short to tell apart from a number in a sentence.
 */
export function withoutRepeats<Group extends GlanceGroup>(groups: Group[], shown: (string | undefined)[]): Group[] {
	const text = plain(shown.filter(Boolean).join(' \n '));
	if (!text) return groups;
	return groups.filter(
		(group) =>
			!group.items.every((item) => {
				const words = plain(item.text);
				return words.length >= 4 && (item.citations?.length ?? 0) === 0 && shownIn(words, text);
			})
	);
}
