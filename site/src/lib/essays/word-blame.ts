/**
 * Who wrote each word of an essay, from its saved versions, for the credits
 * under each section heading (docs/editing.md, "Credits"). The lead author
 * chose on Nov. 24, 2026 to credit sections from the edit history, with a
 * way to add someone by hand, in place of attesting.
 *
 * It works like git blame at the level of words, as in WikiWho (Flöck and
 * Acosta, "WikiWho: Precise and Efficient Attribution of Authorship of
 * Revisioned Content", WWW 2014): each saved version is compared with the
 * one before it, paragraphs first and then the words of the paragraphs that
 * changed. A word that is still there keeps the person and version that
 * first wrote it; a new word belongs to whoever saved the version (or, for a
 * version saved by the live room, to the person who typed it). A paragraph
 * also remembers everyone who changed it, so an edit that only took words
 * out still counts as editing.
 *
 * Only words count, without their punctuation; the fence lines of boxes
 * (":::: case ...") and link addresses are left out, and so is the front
 * matter. A change to punctuation alone still counts as changing the
 * paragraph.
 */
import { matches } from './merge.ts';
import { splitFrontMatter } from './syntax.ts';

/** The largest table of words compared at once; past it, a changed stretch counts as rewritten. */
const largestComparison = 4_000_000;

/** Who wrote one word: an index into `people`, and the version it first appeared in. */
interface WordOrigin {
	person: number;
	version: number;
}

/** Who changed a paragraph, and the first and last version they changed it in. */
type Touch = [person: number, from: number, to: number];

/** Run-length words: [person, version, count]. */
type WordRuns = [person: number, version: number, count: number][];

export interface BlameParagraph {
	words: WordRuns;
	touched: Touch[];
}

/** Who wrote what in one version, paragraph by paragraph (paragraphsOf). Kept as JSON. */
export interface Blame {
	/** People by index: their identifier, or null for text no one is known to have written. */
	people: (string | null)[];
	paragraphs: BlameParagraph[];
}

/** What a new version adds: who saved it, and its number. */
export interface VersionLabel {
	person: string | null;
	version: number;
}

/** The paragraphs of an essay's body: runs of lines between blank lines. */
export function paragraphsOf(text: string): string[] {
	return splitFrontMatter(text)
		.body.replace(/\r\n?/g, '\n')
		.split(/\n[ \t]*\n/)
		.map((paragraph) => paragraph.trim())
		.filter(Boolean);
}

const fenceLine = /^\s*:{3,}/;
/** A word: letters and digits, with apostrophes and hyphens inside ("Georgia's", "self-government"). */
const wordPattern = /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu;
/** A link's address, which is not words anyone wrote. */
const linkAddress = /\]\([^)\s]*(?:\s+"[^"]*")?\)/g;

/** The words of a paragraph that count. */
export function wordsOf(paragraph: string): string[] {
	const words: string[] = [];
	for (const line of paragraph.split('\n')) {
		if (fenceLine.test(line)) continue;
		for (const found of line.replace(linkAddress, ']').matchAll(wordPattern)) words.push(found[0]);
	}
	return words;
}

/** The words of a whole text, in order, as one list (the order of an overlay). */
export function allWordsOf(text: string): string[] {
	return paragraphsOf(text).flatMap(wordsOf);
}

function expand(runs: WordRuns): WordOrigin[] {
	const origins: WordOrigin[] = [];
	for (const [person, version, count] of runs) for (let index = 0; index < count; index += 1) origins.push({ person, version });
	return origins;
}

function compress(origins: WordOrigin[]): WordRuns {
	const runs: WordRuns = [];
	for (const origin of origins) {
		const last = runs.at(-1);
		if (last && last[0] === origin.person && last[1] === origin.version) last[2] += 1;
		else runs.push([origin.person, origin.version, 1]);
	}
	return runs;
}

function addTouch(touched: Touch[], person: number, from: number, to: number): void {
	const known = touched.find((touch) => touch[0] === person);
	if (!known) touched.push([person, from, to]);
	else {
		known[1] = Math.min(known[1], from);
		known[2] = Math.max(known[2], to);
	}
}

class People {
	list: (string | null)[];
	constructor(list: (string | null)[] = []) {
		this.list = [...list];
	}
	index(person: string | null): number {
		const found = this.list.indexOf(person);
		if (found >= 0) return found;
		this.list.push(person);
		return this.list.length - 1;
	}
}

/** Pairs of matching indexes on a longest common subsequence, or none when the lists are too long to compare. */
function pairs(first: string[], second: string[]): Int32Array {
	if (first.length * second.length > largestComparison) {
		// Keep what is the same at the start and the end, which needs no table.
		const found = new Int32Array(first.length).fill(-1);
		let start = 0;
		while (start < first.length && start < second.length && first[start] === second[start]) {
			found[start] = start;
			start += 1;
		}
		for (let a = first.length - 1, b = second.length - 1; a >= start && b >= start && first[a] === second[b]; a -= 1, b -= 1) found[a] = b;
		return found;
	}
	return matches(first, second);
}

/**
 * The blame of a first version, or of a text whose earlier blame is lost:
 * every word belongs to its label, or to the overlay's person for that word.
 */
export function freshBlame(text: string, label: VersionLabel, overlay?: (string | null)[]): Blame {
	return carryForward(null, text, label, overlay);
}

/**
 * The blame of `next`, from the blame of the version before it. `overlay`,
 * when the live room kept one, names who typed each word of `next` (null
 * where it does not know), and is used for the words that are new.
 */
export function carryForward(
	previous: { text: string; blame: Blame } | null,
	next: string,
	label: VersionLabel,
	overlay?: (string | null)[]
): Blame {
	const people = new People(previous?.blame.people ?? []);
	const labelPerson = people.index(label.person);
	const newParagraphs = paragraphsOf(next);
	const newWords = newParagraphs.map(wordsOf);
	// Where each new paragraph's words start in the overlay.
	const overlayStarts: number[] = [];
	newWords.reduce((start, words) => (overlayStarts.push(start), start + words.length), 0);
	const overlayPerson = (paragraph: number, word: number): number => {
		const person = overlay?.[overlayStarts[paragraph] + word];
		return person === undefined || person === null ? labelPerson : people.index(person);
	};

	let oldParagraphs = previous ? paragraphsOf(previous.text) : [];
	let oldBlame = previous?.blame.paragraphs ?? [];
	if (oldBlame.length !== oldParagraphs.length) {
		oldParagraphs = [];
		oldBlame = [];
	}

	const result: BlameParagraph[] = new Array(newParagraphs.length);
	const paragraphMatches = matches(oldParagraphs, newParagraphs);
	const copy = (index: number): BlameParagraph => ({
		words: oldBlame[index].words.map((run) => [...run] as WordRuns[number]),
		touched: oldBlame[index].touched.map((touch) => [...touch] as Touch)
	});

	// Paragraphs moved whole: the same text, left out of the common sequence on both sides.
	const movedFrom = new Map<number, number>();
	const movedOld = new Set<number>();
	const leftOver = new Map<string, number[]>();
	paragraphMatches.forEach((target, index) => {
		if (target < 0) leftOver.set(oldParagraphs[index], [...(leftOver.get(oldParagraphs[index]) ?? []), index]);
	});
	const matchedNew = new Set(paragraphMatches.filter((target) => target >= 0));
	newParagraphs.forEach((paragraph, index) => {
		if (matchedNew.has(index)) return;
		const source = leftOver.get(paragraph)?.shift();
		if (source === undefined) return;
		movedFrom.set(index, source);
		movedOld.add(source);
	});

	// Stretches of old and new paragraphs between matched ones.
	const stretch = (oldStart: number, oldEnd: number, newStart: number, newEnd: number): void => {
		for (let index = newStart; index < newEnd; index += 1) if (movedFrom.has(index)) result[index] = copy(movedFrom.get(index)!);
		if (newStart >= newEnd) return;
		const oldOrigins: { paragraph: number; origin: WordOrigin }[] = [];
		const oldWords: string[] = [];
		for (let index = oldStart; index < oldEnd; index += 1) {
			if (movedOld.has(index)) continue;
			const origins = expand(oldBlame[index].words);
			const words = wordsOf(oldParagraphs[index]);
			words.forEach((word, position) => {
				oldWords.push(word);
				oldOrigins.push({ paragraph: index, origin: origins[position] ?? { person: people.index(null), version: label.version } });
			});
		}
		const flatNew: { paragraph: number; position: number }[] = [];
		const flatNewWords: string[] = [];
		for (let index = newStart; index < newEnd; index += 1) {
			if (movedFrom.has(index)) continue;
			newWords[index].forEach((word, position) => {
				flatNew.push({ paragraph: index, position });
				flatNewWords.push(word);
			});
		}
		const found = pairs(oldWords, flatNewWords);
		const inherited = new Map<number, WordOrigin & { from: number }>();
		found.forEach((newIndex, oldIndex) => {
			if (newIndex >= 0) inherited.set(newIndex, { ...oldOrigins[oldIndex].origin, from: oldOrigins[oldIndex].paragraph });
		});
		const oldTexts = new Set(oldParagraphs.slice(oldStart, oldEnd));
		const built = new Map<number, { origins: WordOrigin[]; sources: Set<number>; writers: Set<number> }>();
		for (let index = newStart; index < newEnd; index += 1) if (!movedFrom.has(index)) built.set(index, { origins: [], sources: new Set(), writers: new Set() });
		flatNew.forEach((place, flatIndex) => {
			const into = built.get(place.paragraph)!;
			const kept = inherited.get(flatIndex);
			if (kept) {
				into.origins.push({ person: kept.person, version: kept.version });
				into.sources.add(kept.from);
			} else {
				const person = overlayPerson(place.paragraph, place.position);
				into.origins.push({ person, version: label.version });
				into.writers.add(person);
			}
		});
		for (const [index, { origins, sources, writers }] of built) {
			const touched: Touch[] = [];
			for (const source of sources) for (const [person, from, to] of oldBlame[source].touched) addTouch(touched, person, from, to);
			if (!oldTexts.has(newParagraphs[index])) {
				// Changed here: by whoever wrote its new words, or by the person who saved when words only went.
				if (writers.size === 0) writers.add(labelPerson);
				for (const person of writers) addTouch(touched, person, label.version, label.version);
			}
			result[index] = { words: compress(origins), touched };
		}
	};

	let oldIndex = 0;
	let newIndex = 0;
	for (let index = 0; index <= oldParagraphs.length; index += 1) {
		const target = index < oldParagraphs.length ? paragraphMatches[index] : -1;
		if (index < oldParagraphs.length && target < 0) continue;
		const newEnd = index < oldParagraphs.length ? target : newParagraphs.length;
		stretch(oldIndex, index, newIndex, newEnd);
		if (index < oldParagraphs.length) {
			result[target] = copy(index);
			oldIndex = index + 1;
			newIndex = target + 1;
		}
	}
	return { people: people.list, paragraphs: result };
}

/** A heading of the essay as the page names it: its id, words and level. */
export interface BlameHeading {
	slug: string;
	title: string;
	level: 2 | 3;
}

/** One person's part in a section, from the edit history. */
export interface SectionPart {
	person: string;
	/** Words of theirs still in the section. */
	words: number;
	/** The first and last version those words came from; 0 when none are left. */
	wordsFrom: number;
	wordsTo: number;
	/** Paragraphs of the section they changed. */
	paragraphs: number;
	/** The first and last version they changed one in. */
	changedFrom: number;
	changedTo: number;
}

/** What the edit history says about one section: its words, and who wrote and changed them. */
export interface SectionHistory {
	slug: string;
	title: string;
	level: 2 | 3;
	/** Words in the section now, the heading's and its subsections' included. */
	total: number;
	/** People with words in the section or who changed it, most words first. Text no one is known to have written is left out. */
	parts: SectionPart[];
}

const headingLine = /^(#{2,3})\s+(.+)$/;

/**
 * Each section's and subsection's part of the edit history. `headings` are
 * the essay's headings in order with the ids the page gives them
 * (essaySections); they are matched to the Markdown's "##" and "###"
 * paragraphs in order. A section includes its subsections.
 */
export function sectionHistories(text: string, blame: Blame, headings: BlameHeading[]): SectionHistory[] {
	const paragraphs = paragraphsOf(text);
	if (blame.paragraphs.length !== paragraphs.length) return [];
	const places: { index: number; level: number }[] = [];
	paragraphs.forEach((paragraph, index) => {
		const found = headingLine.exec(paragraph.split('\n')[0]);
		if (found) places.push({ index, level: found[1].length });
	});
	if (places.length !== headings.length || places.some((place, index) => place.level !== headings[index].level)) return [];
	return headings.map((heading, position) => {
		const start = places[position].index;
		const nextPlace = places.slice(position + 1).find((place) => place.level <= heading.level);
		const end = nextPlace?.index ?? paragraphs.length;
		const parts = new Map<number, SectionPart>();
		const partOf = (person: number): SectionPart | undefined => {
			const identifier = blame.people[person];
			if (identifier === null || identifier === undefined) return undefined;
			let part = parts.get(person);
			if (!part) {
				part = { person: identifier, words: 0, wordsFrom: 0, wordsTo: 0, paragraphs: 0, changedFrom: 0, changedTo: 0 };
				parts.set(person, part);
			}
			return part;
		};
		let total = 0;
		for (let index = start; index < end; index += 1) {
			for (const [person, version, count] of blame.paragraphs[index].words) {
				total += count;
				const part = partOf(person);
				if (!part) continue;
				part.words += count;
				part.wordsFrom = part.wordsFrom ? Math.min(part.wordsFrom, version) : version;
				part.wordsTo = Math.max(part.wordsTo, version);
			}
			for (const [person, from, to] of blame.paragraphs[index].touched) {
				const part = partOf(person);
				if (!part) continue;
				part.paragraphs += 1;
				part.changedFrom = part.changedFrom ? Math.min(part.changedFrom, from) : from;
				part.changedTo = Math.max(part.changedTo, to);
			}
		}
		return { ...heading, total, parts: [...parts.values()].sort((first, second) => second.words - first.words || second.paragraphs - first.paragraphs) };
	});
}

/**
 * Who the history says wrote a section, and who edited it. Whoever has the
 * most words still there wrote it, and so did anyone with at least half as
 * many; everyone else who has words there or changed a paragraph edited it.
 */
export function writersAndEditors(history: SectionHistory): { wrote: SectionPart[]; edited: SectionPart[] } {
	const most = history.parts[0]?.words ?? 0;
	const wrote = most > 0 ? history.parts.filter((part) => part.words * 2 >= most) : [];
	const edited = history.parts.filter((part) => !wrote.includes(part) && (part.words > 0 || part.paragraphs > 0));
	return { wrote, edited };
}

/** Where the bucket keeps who typed each word of a version the live room saved (essay-room.ts). */
export function overlayKey(essay: string, number: number): string {
	return `essays/${essay}/versions/${number}.authors.json`;
}

/** An overlay as stored: run-length [person or null, count]. */
export type OverlayRuns = [person: string | null, count: number][];

export function compressOverlay(people: (string | null)[]): OverlayRuns {
	const runs: OverlayRuns = [];
	for (const person of people) {
		const last = runs.at(-1);
		if (last && last[0] === person) last[1] += 1;
		else runs.push([person, 1]);
	}
	return runs;
}

export function expandOverlay(runs: OverlayRuns): (string | null)[] {
	return runs.flatMap(([person, count]) => new Array<string | null>(count).fill(person));
}

/**
 * Who typed each word of a text the live room saves (an overlay for
 * carryForward): the room's text as each person left it, in order, from the
 * text it started from. Words that were already there are null.
 */
export function overlayOf(start: string, steps: { person: string | null; text: string }[], saved: string): (string | null)[] {
	let current = { text: start, blame: freshBlame(start, { person: null, version: 0 }) };
	for (const step of steps) current = { text: step.text, blame: carryForward(current, step.text, { person: step.person, version: 0 }) };
	const final = carryForward(current, saved, { person: null, version: 0 });
	return final.paragraphs.flatMap((paragraph) => expand(paragraph.words).map((origin) => final.people[origin.person] ?? null));
}
