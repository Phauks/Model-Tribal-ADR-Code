/**
 * Title 25 of the United States Code as an outline to browse, from the title
 * down to a single section (Trevor chose on Nov. 27, 2026 the design with the
 * outline in the side column, design/title-25-navigation, option A; "we
 * should be able to fully read the name in the left sidebar"):
 *
 * - the Title 25 page at /laws/usc-25: its chapters and how many sections of
 *   each are in force;
 * - a page for every section at /laws/usc-25/<section>, the address the
 *   text's own references ("section 5321 of this title") can link to, with
 *   its status, the Act that enacted it, and the sections before and after
 *   it;
 * - each chapter's contents in the Code's order, under its subchapters and
 *   parts, for the chapter's page (/laws/usc-25-chapter-<n>);
 * - the side column's outline of the chapter being read.
 *
 * Read from content/law/title-25-outline.json, which
 * scripts/law/title_25_outline.py writes from the Code's edition on GovInfo.
 * Built with the site: the Worker draws the section pages from their data
 * (src/lib/server/page-data.ts).
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { error } from '@sveltejs/kit';
import { statusLabels, type CodeTree, type CodeTreeItem, type ContentsGroup, type ContentsRow, type Neighbor, type SectionStatus } from '../code-outline.ts';
import type { PageFamily } from '../site-sections.ts';
import { repositoryRoot, sources } from './content.ts';
import { titleTwentyFiveSectionOf } from './law-records.ts';
import { codeSectionDetails } from './title-25-sections.ts';

interface OutlineRow {
	level: 'chapter' | 'subchapter' | 'part' | 'section';
	number: string;
	heading: string;
	status?: SectionStatus;
	range?: boolean;
	note?: string;
	movedTo?: string;
	page?: number;
}

interface OutlineFile {
	source: string;
	edition: number;
	currentThrough: string | null;
	title: { number: string; heading: string };
	items: OutlineRow[];
}

/** A section as placed in the outline. */
interface PlacedSection extends OutlineRow {
	chapter: Chapter;
	subchapter?: Placed;
	part?: Placed;
	/** Its place among all the title's sections. */
	order: number;
}

interface Placed {
	number: string;
	heading: string;
}

interface Chapter extends Placed {
	/** Each subchapter or part in order, and the sections under it. */
	sections: PlacedSection[];
}

export const titleLink = '/laws/usc-25';

let cache: { file: OutlineFile; chapters: Chapter[]; sections: PlacedSection[]; bySlug: Map<string, PlacedSection> } | undefined;

function outline() {
	if (cache) return cache;
	const where = path.join(repositoryRoot, 'content/law/title-25-outline.json');
	const file: OutlineFile = existsSync(where) ? JSON.parse(readFileSync(where, 'utf8')) : { source: '', edition: 0, currentThrough: null, title: { number: '25', heading: 'Indians' }, items: [] };
	const chapters: Chapter[] = [];
	const sections: PlacedSection[] = [];
	let chapter: Chapter | undefined;
	let subchapter: Placed | undefined;
	let part: Placed | undefined;
	for (const row of file.items) {
		if (row.level === 'chapter') {
			chapter = { number: row.number, heading: row.heading, sections: [] };
			chapters.push(chapter);
			subchapter = part = undefined;
		} else if (row.level === 'subchapter') {
			subchapter = { number: row.number, heading: row.heading };
			part = undefined;
		} else if (row.level === 'part') {
			part = { number: row.number, heading: row.heading };
		} else if (chapter) {
			const placed: PlacedSection = { ...row, chapter, subchapter, part, order: sections.length };
			chapter.sections.push(placed);
			sections.push(placed);
		}
	}
	const bySlug = new Map(sections.filter((section) => !section.range).map((section) => [slugOf(section.number), section]));
	cache = { file, chapters, sections, bySlug };
	return cache;
}

/** "13-1" for § 13–1, "2a" for § 2a: the last part of a section's address. */
function slugOf(number: string): string {
	return number.trim().toLowerCase().replace(/[^0-9a-z]+/g, '-');
}

/** The address of a Title 25 section's page, or nothing when the Code has no such section. */
export function titleTwentyFiveSectionLink(number: string): string | undefined {
	const slug = slugOf(number);
	return outline().bySlug.has(slug) ? `${titleLink}/${slug}` : undefined;
}

/** Every section with a page: each section the Code lists on its own, in force or not. */
export function sectionKeys(): string[] {
	return [...outline().bySlug.keys()];
}

const sectionLabel = (section: OutlineRow) => `${section.range ? '§§' : '§'} ${section.number.replace(/ to /g, '–')}`;
const chapterLink = (chapter: Placed) => `/laws/usc-25-chapter-${chapter.number.toLowerCase()}`;
const groupAnchor = (group: Placed, kind: 'subchapter' | 'part') => `${kind}-${slugOf(group.number)}`;
/** A part's anchor names its subchapter too: Part A recurs in several subchapters. */
const partAnchor = (section: PlacedSection) => `${section.subchapter ? `${groupAnchor(section.subchapter, 'subchapter')}-` : ''}${groupAnchor(section.part!, 'part')}`;
const groupLabel = (group: Placed, kind: 'subchapter' | 'part') => `${kind === 'subchapter' ? 'Subchapter' : 'Part'} ${group.number}`;
const inForce = (section: OutlineRow) => section.status === 'in force';

function movedTo(section: OutlineRow): ContentsRow['movedTo'] {
	if (!section.movedTo) return undefined;
	const local = /^[0-9][0-9a-z-]*$/i.test(section.movedTo);
	return { label: local ? `§ ${section.movedTo}` : section.movedTo, link: local ? titleTwentyFiveSectionLink(section.movedTo) : undefined };
}

// ---- The side column's outline ----

/** The chapter's sections in the outline: subchapters and parts fold, runs of sections no longer in force fold into one row. */
function treeOf(chapter: Chapter, current?: PlacedSection): CodeTreeItem[] {
	const top: CodeTreeItem[] = [];
	let subchapterItem: CodeTreeItem | undefined;
	let partItem: CodeTreeItem | undefined;
	let lastSubchapter: Placed | undefined;
	let lastPart: Placed | undefined;
	for (const section of chapter.sections) {
		if (section.subchapter !== lastSubchapter) {
			lastSubchapter = section.subchapter;
			lastPart = undefined;
			partItem = undefined;
			subchapterItem = section.subchapter
				? { number: groupLabel(section.subchapter, 'subchapter'), label: section.subchapter.heading, link: `${chapterLink(chapter)}#${groupAnchor(section.subchapter, 'subchapter')}`, count: 0, children: [] }
				: undefined;
			if (subchapterItem) top.push(subchapterItem);
		}
		if (section.part !== lastPart) {
			lastPart = section.part;
			partItem = section.part ? { number: groupLabel(section.part, 'part'), label: section.part.heading, link: `${chapterLink(chapter)}#${partAnchor(section)}`, count: 0, children: [] } : undefined;
			if (partItem) (subchapterItem?.children ?? top).push(partItem);
		}
		const list = partItem?.children ?? subchapterItem?.children ?? top;
		const isCurrent = current === section;
		if (inForce(section) || isCurrent) {
			list.push({ number: sectionLabel(section), label: inForce(section) ? section.heading : statusLabels[section.status ?? 'omitted'], link: titleTwentyFiveSectionLink(section.number), current: isCurrent || undefined, gone: !inForce(section) || undefined });
			for (const group of [subchapterItem, partItem]) if (group && inForce(section)) group.count = (group.count ?? 0) + 1;
		} else {
			// A run of sections no longer in force reads as one row: "§§ 212–228 Repealed".
			const last = list.at(-1) as (CodeTreeItem & { run?: PlacedSection[] }) | undefined;
			if (last?.run) {
				last.run.push(section);
			} else {
				list.push({ number: '', label: '', gone: true, link: titleTwentyFiveSectionLink(section.number) ?? `${chapterLink(chapter)}#contents`, run: [section] } as CodeTreeItem & { run: PlacedSection[] });
			}
		}
		if (isCurrent) {
			if (subchapterItem) subchapterItem.open = true;
			if (partItem) partItem.open = true;
		}
	}
	const finish = (items: CodeTreeItem[]): CodeTreeItem[] =>
		items.map((item) => {
			const run = (item as CodeTreeItem & { run?: PlacedSection[] }).run;
			if (run) {
				const first = run[0].number.split(/ to |, /)[0];
				const last = run.at(-1)!.number.split(/ to |, /).at(-1)!;
				const statuses = [...new Set(run.map((section) => statusLabels[section.status ?? 'omitted']))];
				return { number: first === last ? `§ ${first}` : `§§ ${first}–${last}`, label: statuses.join(' or '), link: item.link, gone: true };
			}
			// On a chapter's page every subchapter stands open; on a section's page, only the one holding it.
			return item.children ? { ...item, open: item.open ?? (current ? undefined : true), children: finish(item.children) } : item;
		});
	return finish(top);
}

const findBox = { label: 'Find in Title 25', link: titleLink };

/** The side column on a chapter's page or a section's page: back to Title 25, the chapter's name, its outline. */
function chapterFamily(chapter: Chapter, current?: PlacedSection): PageFamily & { tree: CodeTree } {
	return {
		back: { label: 'Title 25', link: titleLink },
		title: `Chapter ${chapter.number}. ${chapter.heading}`,
		short: current ? `${sectionLabel(current)} · Chapter ${chapter.number}` : `Chapter ${chapter.number}`,
		link: chapterLink(chapter),
		pages: [],
		tree: { find: findBox, items: treeOf(chapter, current) }
	};
}

/** The side column on the Title 25 page: every chapter. */
function titleFamily(): PageFamily & { tree: CodeTree } {
	return {
		title: 'Title 25. Indians',
		short: 'Title 25',
		link: titleLink,
		pages: [],
		tree: {
			find: findBox,
			items: outline().chapters.map((chapter) => ({ number: `Ch. ${chapter.number}`, label: chapter.heading, link: chapterLink(chapter), gone: !chapter.sections.some(inForce) || undefined }))
		}
	};
}

// ---- The Title 25 page ----

export interface TitlePage {
	edition: number;
	currentThrough: string | null;
	source: string;
	chapters: { number: string; heading: string; link: string; inForce: number; notInForce: number; groups: { label: string; heading: string; link: string; inForce: number }[] }[];
	/** Every section in force, for the find box. */
	sections: { number: string; heading: string; link: string; chapter: string }[];
	inForce: number;
	family: PageFamily;
}

export function titlePage(): TitlePage {
	const { file, chapters, sections } = outline();
	return {
		edition: file.edition,
		currentThrough: file.currentThrough,
		source: file.source,
		chapters: chapters.map((chapter) => ({
			number: chapter.number,
			heading: chapter.heading,
			link: chapterLink(chapter),
			inForce: chapter.sections.filter(inForce).length,
			notInForce: chapter.sections.filter((section) => !inForce(section)).length,
			groups: contentsOf(chapter.number)
				.filter((group) => group.label.startsWith('Subchapter'))
				.map((group) => ({ label: group.label, heading: group.heading, link: `${chapterLink(chapter)}#${group.anchor}`, inForce: group.inForce }))
		})),
		sections: sections.filter((section) => inForce(section) && !section.range).map((section) => ({ number: section.number, heading: section.heading, link: titleTwentyFiveSectionLink(section.number)!, chapter: section.chapter.number })),
		inForce: sections.filter(inForce).length,
		family: titleFamily()
	};
}

// ---- A chapter's page ----

/** A chapter's contents under its subchapters and parts, in the Code's order. */
export function contentsOf(chapterNumber: string): ContentsGroup[] {
	const chapter = outline().chapters.find((each) => each.number.toLowerCase() === chapterNumber.toLowerCase());
	if (!chapter) return [];
	const groups: ContentsGroup[] = [{ label: '', heading: '', inForce: 0, rows: [] }];
	let lastSubchapter: Placed | undefined;
	let lastPart: Placed | undefined;
	for (const section of chapter.sections) {
		if (section.subchapter && section.subchapter !== lastSubchapter) {
			groups.push({ label: groupLabel(section.subchapter, 'subchapter'), heading: section.subchapter.heading, anchor: groupAnchor(section.subchapter, 'subchapter'), inForce: 0, rows: [] });
		}
		if (section.part && section.part !== lastPart) {
			groups.push({ label: groupLabel(section.part, 'part'), heading: section.part.heading, anchor: partAnchor(section), inForce: 0, rows: [], part: true });
		}
		lastSubchapter = section.subchapter;
		lastPart = section.part;
		const current = groups.at(-1)!;
		if (inForce(section)) current.inForce++;
		current.rows.push({
			label: sectionLabel(section),
			heading: section.heading,
			link: section.range ? undefined : titleTwentyFiveSectionLink(section.number),
			status: section.status ?? 'in force',
			note: section.note,
			movedTo: movedTo(section)
		});
	}
	// A subchapter's count takes in its parts.
	let subchapterGroup: ContentsGroup | undefined;
	for (const group of groups) {
		if (group.part && subchapterGroup) subchapterGroup.inForce += group.inForce;
		else if (!group.part) subchapterGroup = group.label ? group : undefined;
	}
	return groups.filter((group) => group.label || group.rows.length > 0);
}

export interface ChapterNavigation {
	contents: ContentsGroup[];
	family: PageFamily;
	trail: { label: string; href: string }[];
	previous?: Neighbor;
	next?: Neighbor;
	inForce: number;
	notInForce: number;
}

/** What a chapter's page shows beyond its record: its contents, the side column's outline, the trail, the chapters before and after. */
export function chapterNavigation(key: string): ChapterNavigation | undefined {
	const number = /^usc-25-chapter-([0-9a-z]+)$/.exec(key)?.[1];
	const { chapters } = outline();
	const index = chapters.findIndex((chapter) => chapter.number.toLowerCase() === number);
	if (index < 0) return undefined;
	const chapter = chapters[index];
	const neighbor = (other: Chapter | undefined): Neighbor | undefined => (other ? { number: `Chapter ${other.number}`, heading: other.heading, link: chapterLink(other) } : undefined);
	return {
		contents: contentsOf(chapter.number),
		family: chapterFamily(chapter),
		trail: [{ label: 'U.S. Code, Title 25', href: titleLink }],
		previous: neighbor(chapters[index - 1]),
		next: neighbor(chapters[index + 1]),
		inForce: chapter.sections.filter(inForce).length,
		notInForce: chapter.sections.filter((section) => !inForce(section)).length
	};
}

// ---- A section's page ----

export interface SectionPage {
	slug: string;
	/** "§ 5321. Self-determination contracts", the page's title. */
	name: string;
	/** "§ 5321" */
	number: string;
	heading: string;
	/** "25 U.S.C. § 5321 (2024)" */
	citation: string;
	status: SectionStatus;
	note?: string;
	movedTo?: { label: string; link?: string };
	/** The sections that moved here, such as § 450f for § 5321. */
	movedFrom: { label: string; link?: string }[];
	chapter: { number: string; heading: string; link: string };
	subchapter?: { label: string; heading: string; link: string };
	part?: { label: string; heading: string; link: string };
	act?: { name: string; link?: string };
	/** The page of the chapter's PDF, our saved copy, where the section starts. */
	reading?: string;
	official: string;
	edition: number;
	currentThrough: string | null;
	previous?: Neighbor;
	next?: Neighbor;
	trail: { label: string; href: string }[];
	family: PageFamily;
	/** The records of this section the site kept before every section had a page, such as § 5329(c)'s model agreement. */
	records: string[];
}

/** The nearest section in force before or after, across chapters. */
function neighbor(from: PlacedSection, step: 1 | -1): Neighbor | undefined {
	const { sections } = outline();
	for (let index = from.order + step; index >= 0 && index < sections.length; index += step) {
		const section = sections[index];
		if (inForce(section) && !section.range) return { number: sectionLabel(section), heading: section.heading, link: titleTwentyFiveSectionLink(section.number)! };
	}
	return undefined;
}

/** The records kept for single sections, by the section they are about. */
function sectionRecords(): Map<string, string[]> {
	const found = new Map<string, string[]>();
	for (const record of sources().values()) {
		const section = titleTwentyFiveSectionOf(record);
		if (section) found.set(slugOf(section), [...(found.get(slugOf(section)) ?? []), record.key]);
	}
	return found;
}

let recordsCache: Map<string, string[]> | undefined;

export function sectionPage(slug: string): SectionPage {
	const { file, sections, bySlug } = outline();
	const section = bySlug.get(slug);
	if (!section) error(404, 'Title 25 has no section with this number.');
	recordsCache ??= sectionRecords();
	const details = codeSectionDetails(section.chapter.number.toLowerCase(), section.number);
	const chapter = { number: section.chapter.number, heading: section.chapter.heading, link: chapterLink(section.chapter) };
	const subchapter = section.subchapter ? { label: groupLabel(section.subchapter, 'subchapter'), heading: section.subchapter.heading, link: `${chapter.link}#${groupAnchor(section.subchapter, 'subchapter')}` } : undefined;
	const part = section.part ? { label: groupLabel(section.part, 'part'), heading: section.part.heading, link: `${chapter.link}#${partAnchor(section)}` } : undefined;
	const trail = [
		{ label: 'U.S. Code, Title 25', href: titleLink },
		{ label: `Chapter ${chapter.number}`, href: chapter.link },
		...(subchapter ? [{ label: subchapter.label, href: subchapter.link }] : []),
		...(part ? [{ label: part.label, href: part.link }] : [])
	];
	return {
		slug,
		name: `${sectionLabel(section)}. ${section.heading}`,
		number: sectionLabel(section),
		heading: section.heading,
		citation: `25 U.S.C. § ${section.number} (${file.edition})`,
		status: section.status ?? 'in force',
		note: section.note,
		movedTo: movedTo(section),
		movedFrom: sections.filter((other) => other.movedTo && slugOf(other.movedTo) === slug).map((other) => ({ label: sectionLabel(other), link: titleTwentyFiveSectionLink(other.number) })),
		chapter,
		subchapter,
		part,
		act: details?.act,
		reading: inForce(section) ? details?.link : undefined,
		official: `https://www.govinfo.gov/link/uscode/25/${encodeURIComponent(section.number)}?year=${file.edition}&link-type=html`,
		edition: file.edition,
		currentThrough: file.currentThrough,
		previous: neighbor(section, -1),
		next: neighbor(section, 1),
		trail,
		family: chapterFamily(section.chapter, section),
		records: recordsCache.get(slug) ?? []
	};
}

/** The page of the section a kept record is about, for the record's old address. */
export function sectionPageOfRecord(key: string): string | undefined {
	const record = sources().get(key);
	const section = record ? titleTwentyFiveSectionOf(record) : undefined;
	return section ? titleTwentyFiveSectionLink(section) : undefined;
}
