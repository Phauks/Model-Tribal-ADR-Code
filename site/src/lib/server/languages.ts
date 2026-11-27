/**
 * The language pages (/languages/<tag>) and language family pages
 * (/languages/families/<slug>), approved by Trevor on Nov. 27, 2026 (mockup
 * v2; research/analyses/2026-11-27-language-resources.md, approach A).
 *
 * They read the registry in content/languages/, one file for each language
 * tag the nation records use, which scripts/languages/build_registry.py writes
 * from Glottolog 5.4 and the ISO 639-3 tables. The nations on a language's page
 * are the nations whose records name it; nothing about a nation is kept in
 * the registry, so the page always agrees with the nation pages.
 *
 * Every fact cites the source record its registry entry names. Endangerment
 * figures are not shown: they wait for the Indigenous advisory council.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { nations, repositoryRoot, type CitedFact, type NationRecord } from './content.ts';
import { displayName } from '../nation-labels.ts';
import { SourceUses, type CitationMark, type SourceEntry } from './source-uses.ts';
import type { InfoName } from '../info-page.ts';
import type { NationMapData } from '../presence-map.ts';

interface Cited {
	source: string;
}

export interface LanguageWork extends Cited {
	glottolog_reference: string;
	title: string;
	kinds: ('grammar' | 'dictionary')[];
	author?: string;
	year?: number;
	publisher?: string;
	pages?: number;
	most_extensive_description?: boolean;
}

export interface LanguageRecord {
	tag: string;
	name: string;
	iso_639_3: Cited & { code: string; reference_name: string; scope: 'individual' | 'macrolanguage'; retired_code?: { code: string; effective: string; remedy: string } };
	glottolog: Cited & { glottocode: string; level: 'language' | 'family' | 'dialect' };
	family: (Cited & { name: string; glottocode: string }) | null;
	own_names?: (Cited & { name: string; language: string })[];
	iso_names?: (Cited & { name: string })[];
	endangered_languages_project?: Cited & { link: string };
	alaska_native_language_center?: Cited & { link: string };
	dialects: (Cited & { name: string; glottocode: string })[];
	works: LanguageWork[];
	retrieved: string;
}

/** A nation's own language program, as its record names it (schemas/tribe.schema.json, language_programs). */
export type LanguageProgramFact = CitedFact & { name: string; link: string; run_by?: string };

const folder = path.join(repositoryRoot, 'content/languages');
let cache: LanguageRecord[] | undefined;

/** Every language in the registry, by name. */
export function languages(): LanguageRecord[] {
	if (!cache) {
		cache = existsSync(folder)
			? readdirSync(folder)
					.filter((name) => name.endsWith('.yaml'))
					.map((name) => {
						const record = parse(readFileSync(path.join(folder, name), 'utf8').normalize('NFC')) as LanguageRecord;
						if (`${record.tag}.yaml` !== name) throw new Error(`content/languages/${name}: tag must match the file name`);
						return record;
					})
					.sort((first, second) => first.name.localeCompare(second.name, 'en'))
			: [];
	}
	return cache;
}

let byTag: Map<string, LanguageRecord> | undefined;

export function languageFor(tag: string | undefined): LanguageRecord | undefined {
	byTag ??= new Map(languages().map((language) => [language.tag, language]));
	return tag ? byTag.get(tag) : undefined;
}

/** The address of a language's page, when the registry has the tag. */
export function languagePath(tag: string | undefined): string | undefined {
	return languageFor(tag) ? `/languages/${tag}` : undefined;
}

export const familySlug = (name: string) =>
	name
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');

export const familyPath = (name: string) => `/languages/families/${familySlug(name)}`;

/** The families with a page: every Glottolog family a language in the registry belongs to. */
export function languageFamilies(): { slug: string; name: string; glottocode: string; source: string; members: LanguageRecord[] }[] {
	const families = new Map<string, { slug: string; name: string; glottocode: string; source: string; members: LanguageRecord[] }>();
	for (const language of languages()) {
		if (!language.family) continue;
		const slug = familySlug(language.family.name);
		const family = families.get(slug) ?? { slug, name: language.family.name, glottocode: language.family.glottocode, source: language.family.source, members: [] };
		family.members.push(language);
		families.set(slug, family);
	}
	return [...families.values()].sort((first, second) => first.name.localeCompare(second.name, 'en'));
}

/** The records that name the language, with each language fact that names it. */
function namingRecords(tag: string): { record: NationRecord; facts: (CitedFact & { name?: string })[] }[] {
	return nations().flatMap((record) => {
		const facts = (record.languages ?? []).filter((fact) => fact.language_tag === tag && typeof fact.name === 'string');
		return facts.length > 0 ? [{ record, facts }] : [];
	});
}

let nationCounts: Map<string, number> | undefined;

/** How many nations' records name each language. */
export function nationCount(tag: string): number {
	if (!nationCounts) {
		nationCounts = new Map();
		for (const record of nations()) {
			for (const tag of new Set((record.languages ?? []).map((fact) => fact.language_tag).filter((value): value is string => typeof value === 'string'))) {
				nationCounts.set(tag, (nationCounts.get(tag) ?? 0) + 1);
			}
		}
	}
	return nationCounts.get(tag) ?? 0;
}

const isoLink = (code: string) => `https://iso639-3.sil.org/code/${code}`;
export const glottologLink = (glottocode: string) => `https://glottolog.org/resource/languoid/id/${glottocode}`;
export const glottologReferenceLink = (reference: string) => `https://glottolog.org/resource/reference/id/${reference}`;

interface FactItem {
	text: string;
	link?: string;
	citations?: CitationMark[];
}

interface FactGroup {
	field: string;
	label: string;
	items: FactItem[];
}

export interface LanguageNationRow {
	key: string;
	id: string;
	nation: string;
	name: string;
	program?: { name: string; link: string; citations: CitationMark[] };
	citations: CitationMark[];
}

export interface LanguagePage {
	tag: string;
	title: string;
	names: InfoName[];
	glance: FactGroup[];
	rows: LanguageNationRow[];
	count: number;
	map?: NationMapData;
	/** "Dialects", or for an entry Glottolog files as a family (Ojibwa), "Languages in this group". */
	dialectsHeading: string;
	dialects: { name: string; glottocode: string; citations: CitationMark[] }[];
	/** Not `family`: the layout's data uses that name for the sidebar's page family. */
	languageFamily?: { name: string; href: string };
	related: { tag: string; name: string; nations: number }[];
	works: (LanguageWork & { kind: string; citations: CitationMark[] })[];
	sources: SourceEntry[];
}

const kindLabel = (kinds: LanguageWork['kinds']) =>
	kinds.length > 1 ? 'Grammar and dictionary' : kinds[0] === 'dictionary' ? 'Dictionary' : 'Grammar';

/**
 * A language's page. The map is drawn by `drawMap` (language-map.ts), passed
 * in by the route, since the map's shapes are a Vite module that the
 * collections registry, which also reads this file, cannot load.
 */
export function languagePage(tag: string, drawMap?: (records: NationRecord[], sources: SourceUses) => NationMapData | undefined): LanguagePage | undefined {
	const language = languageFor(tag);
	if (!language) return undefined;
	const uses = new SourceUses();
	const mark = (source: string, section: string, text: string, marks: CitationMark[] = []) => {
		uses.cite(source, { section, text }, marks);
		return marks;
	};
	const named = namingRecords(tag);

	// Other names, under the title: the language's own name, then the names
	// the nations' records give, then the standard's names (mockup v2).
	uses.part('Other names');
	const names: InfoName[] = [];
	for (const own of language.own_names ?? []) names.push({ name: own.name, language: own.language, note: 'own name', citations: mark(own.source, 'Other names', own.name) });
	const recordNames = new Map<string, CitationMark[]>();
	for (const { facts } of named) {
		for (const fact of facts) {
			const name = String(fact.name);
			if (name === language.name || names.some((other) => other.name === name)) continue;
			const marks = recordNames.get(name) ?? [];
			uses.citeFact(fact, 'Other names', name, marks);
			recordNames.set(name, marks);
		}
	}
	for (const [name, citations] of recordNames) names.push({ name, citations });
	for (const other of language.iso_names ?? []) {
		if (other.name === language.name || recordNames.has(other.name) || names.some((existing) => existing.name === other.name)) continue;
		names.push({ name: other.name, citations: mark(other.source, 'Other names', other.name) });
	}

	uses.part('Key facts');
	const iso = language.iso_639_3;
	const glance: FactGroup[] = [
		{ field: 'iso', label: 'ISO 639-3', items: [{ text: iso.code, link: isoLink(iso.code), citations: mark(iso.source, 'ISO 639-3', iso.retired_code ? `${iso.code} (replaces ${iso.retired_code.code}, retired ${iso.retired_code.effective})` : iso.code) }] },
		{ field: 'glottolog', label: 'Glottolog', items: [{ text: language.glottolog.glottocode, link: glottologLink(language.glottolog.glottocode), citations: mark(language.glottolog.source, 'Glottolog', language.glottolog.glottocode) }] },
		{
			field: 'family',
			label: 'Language family',
			items: [
				language.family
					? { text: language.family.name, link: familyPath(language.family.name), citations: mark(language.family.source, 'Language family', language.family.name) }
					: { text: 'Isolate', citations: mark(language.glottolog.source, 'Language family', 'Isolate') }
			]
		}
	];
	if (language.alaska_native_language_center) {
		const center = language.alaska_native_language_center;
		glance.push({ field: 'language-center', label: 'Language center', items: [{ text: 'Alaska Native Language Center', link: center.link, citations: mark(center.source, 'Language center', 'Alaska Native Language Center') }] });
	}
	if (language.endangered_languages_project) {
		const project = language.endangered_languages_project;
		glance.push({ field: 'endangered-languages-project', label: 'Endangered Languages Project', items: [{ text: language.name, link: project.link, citations: mark(project.source, 'Endangered Languages Project', language.name) }] });
	}

	uses.part('Nations that name this language');
	const rows: LanguageNationRow[] = [];
	for (const { record, facts } of named) {
		const nation = displayName(record.names.official);
		const programFact: LanguageProgramFact | undefined = record.language_programs?.[0];
		const program = programFact ? { name: programFact.name, link: programFact.link, citations: [] as CitationMark[] } : undefined;
		if (program && programFact) uses.citeFact(programFact, 'Nations that name this language', `${nation}: ${programFact.name}`, program.citations);
		// One row for each name a record gives; a record that gives the same name in two facts (two community rows of one source) has one row with both markers.
		const byName = new Map<string, LanguageNationRow>();
		for (const fact of facts) {
			const name = String(fact.name);
			const row = byName.get(name) ?? { key: `${record.id}|${name}`, id: record.id, nation, name, program, citations: [] };
			uses.citeFact(fact, 'Nations that name this language', `${nation}: ${name}`, row.citations);
			byName.set(name, row);
		}
		rows.push(...byName.values());
	}
	rows.sort((first, second) => first.nation.localeCompare(second.nation, 'en'));
	const count = named.length;
	glance.push({ field: 'nations', label: 'Nations', items: [{ text: String(count) }] });

	uses.part('Map');
	const map = drawMap?.(
		named.map(({ record }) => record),
		uses
	);

	uses.part('Dialects');
	const dialectsHeading = language.glottolog.level === 'family' ? 'Languages in this group' : 'Dialects';
	const dialects = language.dialects.map((dialect) => ({ name: dialect.name, glottocode: dialect.glottocode, citations: mark(dialect.source, dialectsHeading, dialect.name) }));

	uses.part('Related languages');
	const related = language.family
		? languages()
				.filter((other) => other.tag !== tag && other.family?.glottocode === language.family!.glottocode)
				.map((other) => {
					// Cited in References without a marker in the table, as mocked.
					uses.add(other.family!.source, { section: 'Related languages', text: other.name });
					return { tag: other.tag, name: other.name, nations: nationCount(other.tag) };
				})
		: [];

	uses.part('Grammars and dictionaries');
	const works = language.works.map((work) => ({ ...work, kind: kindLabel(work.kinds), citations: mark(work.source, 'Grammars and dictionaries', work.title) }));

	return {
		tag,
		title: language.name,
		names,
		glance,
		rows,
		count,
		map,
		dialectsHeading,
		dialects,
		languageFamily: language.family ? { name: language.family.name, href: familyPath(language.family.name) } : undefined,
		related,
		works,
		sources: uses.list
	};
}

export interface FamilyPage {
	slug: string;
	title: string;
	glance: FactGroup[];
	rows: { tag: string; name: string; code: string; nations: number; citations: CitationMark[] }[];
	sources: SourceEntry[];
}

export function familyPage(slug: string): FamilyPage | undefined {
	const family = languageFamilies().find((candidate) => candidate.slug === slug);
	if (!family) return undefined;
	const uses = new SourceUses();
	const mark = (section: string, text: string) => {
		const marks: CitationMark[] = [];
		uses.cite(family.source, { section, text }, marks);
		return marks;
	};
	uses.part('Key facts');
	const tags = new Set(family.members.map((member) => member.tag));
	const nationTotal = nations().filter((record) => (record.languages ?? []).some((fact) => typeof fact.language_tag === 'string' && tags.has(fact.language_tag))).length;
	const glance: FactGroup[] = [
		{ field: 'glottolog', label: 'Glottolog', items: [{ text: family.glottocode, link: glottologLink(family.glottocode), citations: mark('Glottolog', family.glottocode) }] },
		{ field: 'languages', label: 'Languages on this site', items: [{ text: String(family.members.length) }] },
		{ field: 'nations', label: 'Nations', items: [{ text: String(nationTotal) }] }
	];
	uses.part('Languages');
	const rows = family.members.map((member) => ({ tag: member.tag, name: member.name, code: member.iso_639_3.code, nations: nationCount(member.tag), citations: mark('Languages', member.name) }));
	return { slug, title: `${family.name} languages`, glance, rows, sources: uses.list };
}

export interface LanguageIndexRow {
	tag: string;
	name: string;
	code: string;
	family?: { name: string; href: string };
	nations: number;
}

/** The list at /languages: every language in the registry. */
export function languageIndex(): LanguageIndexRow[] {
	return languages().map((language) => ({
		tag: language.tag,
		name: language.name,
		code: language.iso_639_3.code,
		family: language.family ? { name: language.family.name, href: familyPath(language.family.name) } : undefined,
		nations: nationCount(language.tag)
	}));
}
