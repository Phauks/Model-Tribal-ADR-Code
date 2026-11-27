/**
 * Pages about Native people in the cases and in nations' histories
 * (content/biographies/, src/routes/biographies/[person]; Trevor, Nov. 24,
 * 2026: "profiles for native Americans who are involved in this litigation or
 * leaders as well, especially notable leaders"), and about the people who
 * signed treaties with them for the United States (Trevor chose to add them
 * to Biographies on Nov. 26, 2026). Every fact comes from the
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
import { copyPagePath } from '../public-copies.ts';
import { casePreviewList } from './case-previews.ts';
import { nations, repositoryRoot, sources } from './content.ts';
import type { FactGroup } from './justice-pages.ts';
import { isLawRecord, recordName } from './law-records.ts';
import { SourceUses, type SourceEntry } from './source-uses.ts';
import { justicePath, peopleFile, presidentPath } from './supreme-court-people.ts';
import type { Stub } from '../stubs.ts';
import { savedCopyFor } from './markdown.ts';

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
	/** The treaty the event names, linked to its page: `text` holds `link.text` once. */
	link?: { text: string; href: string };
	citations: CitationMark[];
}

/** A treaty the person signed, with its page on this site and the copy of its text the site keeps. */
export interface BiographyTreaty {
	key: string;
	/** The treaty's name, as its page heads it: "Treaty with the Cheyenne and Arapaho (1867)". */
	name: string;
	/** Its first page in the Statutes at Large: "15 Stat. 593". */
	citation?: string;
	link: string;
	signed: string;
	/** The people the treaty prints the person as signing for: "Cheyennes". */
	signedFor?: string;
	/** The title the treaty prints beside the person's name: "chief". */
	listedAs?: string;
	/** The page of the copy of the treaty's text that the site keeps, and its format. */
	document?: { href: string; format: string };
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
	treaties: BiographyTreaty[];
	events: BiographyEvent[];
	sources: SourceEntry[];
	/** Set when the page holds only the treaties the person signed: a stub (src/lib/stubs.ts). */
	stub?: Stub;
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
export function peopleOfNation(nationIdentifier: string): { name: string; link: string; lead: string; cases: number }[] {
	return biographies()
		.filter((person) => (person.nations ?? []).some((entry) => entry.nation === nationIdentifier))
		.map((person) => ({
			name: person.name,
			link: biographyPath(person.key),
			lead: person.lead,
			cases: person.cases?.length ?? 0
		}));
}

/**
 * A treaty signing as scripts/biographies/make_treaty_records.py writes it:
 * "Signed the Treaty with the Cheyenne and Arapaho, 1867, for the Cheyennes,
 * listed as chief." Gives the treaty's name as the sentence prints it, and the
 * people and title the treaty prints beside the person's name.
 */
const signing = /^Signed the (.+?, \d{4}(?:, [A-Z][a-z]{2,4}\.? \d{1,2})?), for (?:the )*(.+?)(?:, listed as (.+?))?\.?$/;

export function treatySigning(text: string): { treaty: string; signedFor: string; listedAs?: string } | undefined {
	const match = signing.exec(text);
	return match ? { treaty: match[1], signedFor: match[2], listedAs: match[3] } : undefined;
}

/** The treaty a fact cites, when its source is a treaty with a page at /laws/<key>. */
function treatyRecord(key: string) {
	const record = sources().get(key);
	return record && isLawRecord(record) && (record.citation as { type?: string }).type === 'treaty' ? record : undefined;
}

let signers: Map<string, { name: string; link: string; detail?: string }[]> | undefined;

/** The people with a page who signed a treaty, for the treaty's page, with whom the treaty prints them as signing for. */
export function signersOfTreaty(treatyKey: string): { name: string; link: string; detail?: string }[] {
	if (!signers) {
		signers = new Map();
		for (const person of biographies()) {
			const seen = new Set<string>();
			for (const event of person.events ?? []) {
				const signed = treatySigning(event.text);
				if (!signed || seen.has(event.source)) continue;
				seen.add(event.source);
				const list = signers.get(event.source) ?? [];
				list.push({
					name: person.name,
					link: biographyPath(person.key),
					detail: `${signed.signedFor}${signed.listedAs ? `, listed as ${signed.listedAs}` : ''}`
				});
				signers.set(event.source, list);
			}
		}
	}
	return signers.get(treatyKey) ?? [];
}

// Built once, not for each of the thousand biography pages.
let nationDisplayNames: Map<string, string> | undefined;
let casePreviewsById: Map<string, ReturnType<typeof casePreviewList>['cases'][number]> | undefined;

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

	uses.part('Key facts');
	const nationNames = (nationDisplayNames ??= new Map(nations().map((nation) => [nation.id, displayName(nation.names.official)])));
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

	const previews = (casePreviewsById ??= new Map(casePreviewList().cases.map((preview) => [preview.id, preview])));
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

	// Every treaty the person signed (Trevor, Nov. 24, 2026: "we say this man
	// signed treaties. We should link to those treaty pages or documents"):
	// its page at /laws/<key> and the copy of its text the site keeps.
	uses.part('Treaties');
	const treaties: BiographyTreaty[] = [];
	const treatyLinks = new Map<string, string>();
	for (const entry of person.events ?? []) {
		const record = treatyRecord(entry.source);
		if (!record || treatyLinks.has(entry.source)) continue;
		const signed = treatySigning(entry.text);
		const copy = savedCopyFor(record);
		const link = `/laws/${entry.source}`;
		treatyLinks.set(entry.source, link);
		treaties.push({
			key: entry.source,
			name: recordName(entry.source).name,
			citation: /\d+ Stat\. \d+/.exec(record.citation.title ?? '')?.[0],
			link,
			signed: entry.when,
			signedFor: signed?.signedFor,
			listedAs: signed?.listedAs,
			document: copy ? { href: copyPagePath(copy), format: copy.mediaType === 'application/pdf' ? 'PDF' : copy.mediaType === 'text/html' ? 'HTML' : 'File' } : undefined,
			citations: cite(entry, 'Treaties', entry.text)
		});
	}
	if (treaties.length > 0) {
		glance.push({
			field: 'treaties',
			label: treaties.length === 1 ? 'Treaty signed' : 'Treaties signed',
			items: treaties.map((item) => ({ text: item.name, link: item.link }))
		});
	}

	// A treaty commissioner who also has a President's or Justice's page, such as Andrew Jackson.
	const forUnitedStates = treaties.length > 0 && treaties.every((item) => item.signedFor === 'United States');
	if (forUnitedStates) {
		const people = peopleFile();
		const president = people.presidents.find((candidate) => candidate.name === person.name);
		const justice = people.justices.find((candidate) => candidate.name === person.name);
		if (president) glance.push({ field: 'office', label: 'President', items: [{ text: `President of the United States, ${president.years.map(([from, to]) => `${from}–${to}`).join(', ')}`, link: presidentPath(president) }] });
		if (justice) glance.push({ field: 'office', label: 'Justice', items: [{ text: 'Justice of the Supreme Court', link: justicePath(justice) }] });
	}

	uses.part('Life and events');
	const events: BiographyEvent[] = (person.events ?? []).map((entry) => {
		const href = treatyLinks.get(entry.source);
		const named = href ? treatySigning(entry.text)?.treaty : undefined;
		return {
			when: entry.when,
			text: entry.text,
			link: href && named ? { text: named, href } : undefined,
			// A signing repeats a row of Treaties, so its marker points at the same entry in References.
			citations: href ? [uses.again(entry.source, { section: 'Life and events', text: entry.text, where: entry.where })] : cite(entry, 'Life and events', entry.text)
		};
	});

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
		treaties,
		events,
		sources: uses.list,
		// Nothing but treaty signings: no cases, no picture, no other life events.
		stub:
			cases.length === 0 && !person.portrait && events.length > 0 && events.every((event) => event.link !== undefined)
				? { kind: 'person', record: `biographies/${key}` }
				: undefined
	};
}
