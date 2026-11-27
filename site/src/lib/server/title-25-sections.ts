/**
 * The sections of Title 25 of the United States Code and of the Code of
 * Federal Regulations, for the chapter and part pages at /laws/<key> and for
 * the pages of the Acts that enacted them (Trevor asked on Nov. 26, 2026 for
 * full coverage of federal Indian statutes and regulations). Read from
 * content/law/title-25-sections.json, which scripts/law/title_25_acts.py
 * writes from the Code's 2024 edition on GovInfo and the eCFR.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { copyPath } from '../public-copies.ts';
import { repositoryRoot, sources } from './content.ts';
import { recordName, recordPageLink } from './law-records.ts';
import { savedCopyFor } from './markdown.ts';

interface CodeSectionRow {
	number: string;
	heading: string;
	inForce: boolean;
	/** The record of the Act that enacted it. */
	act?: string;
	credit?: string;
	/** Its page in the chapter's PDF. */
	page?: number;
}

interface SectionsFile {
	codeEdition: number;
	code: Record<string, CodeSectionRow[]>;
	regulations: Record<string, { number: string; heading: string }[]>;
}

/** One section as a row of a list. */
export interface SectionRow {
	/** "§ 5304" */
	label: string;
	heading: string;
	/** Its anchor on the chapter's or part's page: "sec-5304". */
	anchor: string;
	/** Where to read it: the page of our copy of the chapter, or the eCFR. */
	link?: string;
	inForce: boolean;
	act?: { name: string; link?: string };
}

export interface SectionList {
	/** "code" for a chapter of the United States Code, "regulations" for a part of the C.F.R. */
	kind: 'code' | 'regulations';
	inForce: SectionRow[];
	/** Repealed, transferred, omitted or renumbered: listed apart. */
	notInForce: SectionRow[];
}

let cache: SectionsFile | undefined;

function sectionsFile(): SectionsFile {
	if (cache) return cache;
	const file = path.join(repositoryRoot, 'content/law/title-25-sections.json');
	cache = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as SectionsFile) : { codeEdition: 0, code: {}, regulations: {} };
	return cache;
}

/** A section's own page (code-outline.ts), or its chapter's list for a run of sections the Code lists together. */
const sectionLink = (chapter: string, number: string) =>
	/ to |,/.test(number) ? `/laws/usc-25-chapter-${chapter}#contents` : `/laws/usc-25/${number.trim().toLowerCase().replace(/[^0-9a-z]+/g, '-')}`;

const anchorOf = (number: string) => `sec-${number.replace(/[^0-9A-Za-z.-]+/g, '-').replace(/\./g, '-').toLowerCase()}`;

function actOf(key: string | undefined): SectionRow['act'] {
	if (!key || !sources().has(key)) return undefined;
	return { name: recordName(key).name, link: recordPageLink(key) };
}

function codeRows(chapter: string): SectionRow[] {
	const record = sources().get(`usc-25-chapter-${chapter}`);
	const copy = savedCopyFor(record);
	return (sectionsFile().code[chapter] ?? []).map((row) => ({
		label: `§ ${row.number}`,
		heading: row.heading,
		anchor: anchorOf(row.number),
		link: copy && row.inForce ? `${copyPath(copy)}${row.page ? `#page=${row.page}` : ''}` : undefined,
		inForce: row.inForce,
		act: actOf(row.act)
	}));
}

/** What the section list knows of one section of the Code: where our copy of its chapter has it, and the Act that enacted it. */
export function codeSectionDetails(chapter: string, number: string): { link?: string; act?: SectionRow['act'] } | undefined {
	const row = codeRows(chapter).find((each) => each.label === `§ ${number}`);
	return row ? { link: row.link, act: row.act } : undefined;
}

/** The sections of a Title 25 chapter's or part's record, or nothing for any other record. */
export function sectionsOf(key: string): SectionList | undefined {
	const chapter = /^usc-25-chapter-([0-9a-z]+)$/.exec(key)?.[1];
	if (chapter) {
		const rows = codeRows(chapter);
		return rows.length > 0 ? { kind: 'code', inForce: rows.filter((row) => row.inForce), notInForce: rows.filter((row) => !row.inForce) } : undefined;
	}
	const part = /^cfr-25-part-(\d+)(?:-|$)/.exec(key)?.[1];
	const rows = part ? sectionsFile().regulations[part] : undefined;
	if (!rows || rows.length === 0) return undefined;
	return {
		kind: 'regulations',
		inForce: rows.map((row) => ({ label: `§ ${row.number}`, heading: row.heading, anchor: anchorOf(row.number), link: `https://www.ecfr.gov/current/title-25/section-${row.number}`, inForce: true })),
		notInForce: []
	};
}

/** The record of each Title 25 part: the part's own record where an older one has a longer key. */
function partRecordKeys(): Map<string, string> {
	const keys = new Map<string, string>();
	for (const key of sources().keys()) {
		const part = /^cfr-25-part-(\d+)(?:-|$)/.exec(key)?.[1];
		if (part && (!keys.has(part) || key.length > (keys.get(part) ?? '').length)) keys.set(part, key);
	}
	return keys;
}

/** The sections of the Code's Title 25 an Act enacted, each linking to its place on its chapter's page. */
export function sectionsEnactedBy(key: string): { label: string; heading: string; link: string; inForce: boolean }[] {
	const found = [];
	for (const [chapter, rows] of Object.entries(sectionsFile().code)) {
		for (const row of rows) {
			if (row.act === key) found.push({ label: `25 U.S.C. § ${row.number}`, heading: row.heading, link: sectionLink(chapter, row.number), inForce: row.inForce });
		}
	}
	return found;
}

/** Every section, for the Statistics page: the Code's sections in force and the regulations' sections. */
export function allSections(kind: 'code' | 'regulations'): { citation: string; title: string; href: string; detail: string }[] {
	const file = sectionsFile();
	if (kind === 'code') {
		return Object.entries(file.code).flatMap(([chapter, rows]) =>
			rows
				.filter((row) => row.inForce)
				.map((row) => ({ citation: `25 U.S.C. § ${row.number}`, title: row.heading, href: sectionLink(chapter, row.number), detail: `Chapter ${chapter.toUpperCase()}` }))
		);
	}
	const parts = partRecordKeys();
	return Object.entries(file.regulations).flatMap(([part, rows]) =>
		rows.map((row) => ({
			citation: `25 C.F.R. § ${row.number}`,
			title: row.heading,
			href: parts.has(part) ? `/laws/${parts.get(part)}#${anchorOf(row.number)}` : `https://www.ecfr.gov/current/title-25/section-${row.number}`,
			detail: `Part ${part}`
		}))
	);
}
