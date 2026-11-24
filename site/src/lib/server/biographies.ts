/**
 * Pages about Native people in the cases and in nations' histories
 * (content/biographies/, src/routes/biographies/[person]; Trevor, Nov. 24,
 * 2026: "profiles for native Americans who are involved in this litigation or
 * leaders as well, especially notable leaders"). Every fact comes from the
 * record with its source and the place in it; a fact without one is never
 * shown. Runs at build time only.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import type { CitationMark } from '../citation-marks.ts';
import type { InfoName, InfoPicture } from '../info-page.ts';
import { displayName } from '../nation-labels.ts';
import { casePreviewList } from './case-previews.ts';
import { nations, repositoryRoot } from './content.ts';
import type { FactGroup } from './justice-pages.ts';
import { SourceUses, type SourceEntry } from './source-uses.ts';

interface Cited {
	source: string;
	where?: string;
}

export interface BiographyRecord {
	key: string;
	name: string;
	lead: string;
	living: boolean;
	names?: ({ name: string; note?: string } & Cited)[];
	nations?: ({ nation: string; named_as?: string; note?: string } & Cited)[];
	cases?: { case: string; role: string; result?: string; where?: string }[];
	events?: ({ when: string; text: string } & Cited)[];
	/** A public domain picture, kept at site/static/biographies/portraits/<file>. */
	portrait?: {
		file: string;
		title: string;
		credit: string;
		page: string;
		basis: string;
		alt: string;
		width: number;
		height: number;
		sha256: string;
	};
	/** A living person's own picture, which the person or the family published for this use. */
	portrait_released?: boolean;
	checked: string;
}

export interface BiographyCase {
	key: string;
	name: string;
	citation: string;
	link: string;
	decided: string;
	court: string;
	role: string;
	result?: string;
	citations: CitationMark[];
}

export interface BiographyEvent {
	when: string;
	text: string;
	citations: CitationMark[];
}

export interface BiographyPage {
	key: string;
	name: string;
	lead: string;
	names: InfoName[];
	picture?: InfoPicture;
	glance: FactGroup[];
	nations: { id: string; name: string }[];
	cases: BiographyCase[];
	events: BiographyEvent[];
	sources: SourceEntry[];
}

const folder = path.join(repositoryRoot, 'content/biographies');
let cache: BiographyRecord[] | undefined;

export function biographies(): BiographyRecord[] {
	if (!cache) {
		cache = existsSync(folder)
			? readdirSync(folder)
					.filter((name) => name.endsWith('.yaml'))
					.sort()
					.map((name) => checked(name, parse(readFileSync(path.join(folder, name), 'utf8').normalize('NFC')) as BiographyRecord))
			: [];
	}
	return cache;
}

const portraitFolder = path.join(repositoryRoot, 'site/static/biographies/portraits');

/**
 * Holds a record to the rules Trevor approved on Nov. 24, 2026
 * (docs/biographies.md): a living person's page gives the public role only,
 * so no life events and no picture unless the person or the family released
 * one; and a picture's file must be the one its hash names.
 */
export function checked(file: string, record: BiographyRecord): BiographyRecord {
	const where = `content/biographies/${file}`;
	if (`${record.key}.yaml` !== file) throw new Error(`${where}: key must match the file name`);
	if (record.living && (record.events?.length ?? 0) > 0) throw new Error(`${where}: a living person's page gives the public role only, with no life events`);
	if (record.living && record.portrait && !record.portrait_released) throw new Error(`${where}: a living person's picture needs portrait_released`);
	if (record.portrait) {
		const image = path.join(portraitFolder, record.portrait.file);
		if (!existsSync(image)) throw new Error(`${where}: no picture at site/static/biographies/portraits/${record.portrait.file}`);
		const hash = createHash('sha256').update(readFileSync(image)).digest('hex');
		if (hash !== record.portrait.sha256) throw new Error(`${where}: the picture's SHA-256 is ${hash}, not the one the record gives`);
	}
	return record;
}

export const biographyPath = (key: string) => `/biographies/${key}`;

/** The people with a page who appear in a case, for the case's page. */
export function peopleInCase(caseKey: string): { name: string; link: string; role: string }[] {
	return biographies().flatMap((person) =>
		(person.cases ?? [])
			.filter((entry) => entry.case === caseKey)
			.map((entry) => ({
				name: person.name,
				link: biographyPath(person.key),
				role: entry.role
			}))
	);
}

/** The people with a page who belong to a nation, for the nation's page. */
export function peopleOfNation(nationId: string): { name: string; link: string; lead: string; cases: number }[] {
	return biographies()
		.filter((person) => (person.nations ?? []).some((entry) => entry.nation === nationId))
		.map((person) => ({
			name: person.name,
			link: biographyPath(person.key),
			lead: person.lead,
			cases: person.cases?.length ?? 0
		}));
}

export function biographyPage(key: string): BiographyPage | null {
	const person = biographies().find((candidate) => candidate.key === key);
	if (!person) return null;
	const uses = new SourceUses();
	const cite = (fact: Cited, section: string, text: string, marks: CitationMark[] = []): CitationMark[] => {
		uses.cite(fact.source, { section, text, where: fact.where }, marks);
		return marks;
	};

	uses.part('Name');
	const names: InfoName[] = (person.names ?? []).map((entry) => ({
		name: entry.name,
		note: entry.note,
		citations: cite(entry, 'Name', entry.name)
	}));

	uses.part('At a glance');
	const nationNames = new Map(nations().map((nation) => [nation.id, displayName(nation.names.official)]));
	const glance: FactGroup[] = [];
	const nationItems = (person.nations ?? []).map((entry) => ({
		text: nationNames.get(entry.nation) ?? entry.nation,
		link: nationNames.has(entry.nation) ? `/nations/${entry.nation}` : undefined,
		detail: [entry.named_as ? `Named as “${entry.named_as}.”` : '', entry.note ?? ''].filter(Boolean).join(' '),
		citations: cite(entry, 'Nation', entry.named_as ?? entry.nation)
	}));
	if (nationItems.length > 0)
		glance.push({
			field: 'nation',
			label: nationItems.length === 1 ? 'Nation' : 'Nations',
			items: nationItems
		});

	const previews = new Map(casePreviewList().cases.map((preview) => [preview.id, preview]));
	const cases: BiographyCase[] = [];
	for (const entry of person.cases ?? []) {
		const preview = previews.get(entry.case);
		if (!preview) throw new Error(`content/biographies/${key}.yaml names the case "${entry.case}", which has no record`);
		cases.push({
			key: entry.case,
			name: preview.name,
			citation: preview.citation,
			link: preview.link,
			decided: preview.decided,
			court: preview.court,
			role: entry.role,
			result: entry.result,
			citations: cite({ source: entry.case, where: entry.where }, 'Cases', `${entry.role}${entry.result ? `. ${entry.result}` : ''}`)
		});
	}
	if (cases.length > 0) {
		glance.push({
			field: 'cases',
			label: cases.length === 1 ? 'Case' : 'Cases',
			items: cases.map((item) => ({
				text: item.name,
				link: item.link,
				detail: item.role
			}))
		});
	}

	uses.part('Life and events');
	const events = (person.events ?? []).map((entry) => ({
		when: entry.when,
		text: entry.text,
		citations: cite(entry, 'Life and events', entry.text)
	}));

	const picture: InfoPicture | undefined = person.portrait
		? {
				src: `/biographies/portraits/${person.portrait.file}`,
				alt: person.portrait.alt,
				credit: person.portrait.credit,
				original: person.portrait.page,
				width: person.portrait.width,
				height: person.portrait.height
			}
		: undefined;

	return {
		key,
		name: person.name,
		lead: person.lead,
		names,
		picture,
		glance,
		nations: (person.nations ?? []).map((entry) => ({
			id: entry.nation,
			name: nationNames.get(entry.nation) ?? entry.nation
		})),
		cases,
		events,
		sources: uses.list
	};
}
