/**
 * Downloading several search results at once (Trevor asked on Nov. 27, 2026, and approved the third
 * mockup the same day: design/search-download/revision-3). A reader ticks results on the search
 * page, opens Download above the results, chooses what the .zip holds and how it is laid out, and
 * the Worker puts it together (src/routes/search/download/+server.ts).
 *
 * Only copies this site may share go in as files: works of the United States government and nations'
 * own documents (src/lib/public-copies.ts). Anything else is listed by its citation and link. The
 * plan of the .zip is worked out here, the same way for the preview the search page draws and for the
 * file the Worker writes, so the two always agree.
 *
 * Shared by the search page and the Worker, so it must stay plain.
 */
import { resultGroupLabels, resultGroups, type ResultGroup } from './search-everything.ts';
import { verifyPowerShellName, verifyShellName } from './zip-verifiers.ts';

/** The file a result can be downloaded as: its size in bytes and its address on this site (/copies/…). */
export type SearchFile = [bytes: number, path: string];

/**
 * Each result's file by the result's link (/search/files.json), for the results that have one. A
 * result that is the copy's own page (/copies/view/a/b.pdf) gives only the size, since the file's
 * address is the page's without "view" (/copies/a/b.pdf): about 49,000 results by Nov. 27, 2026,
 * which takes the file from 5.6 MB to 4.1 MB.
 */
export type SearchFiles = Record<string, number | SearchFile>;

const copyPagePrefix = '/copies/view/';

/** A result's file from the list, or undefined when it has none. */
export function fileOf(files: SearchFiles | undefined, link: string): SearchFile | undefined {
	const value = files?.[link];
	if (value === undefined) return undefined;
	if (typeof value === 'number') return link.startsWith(copyPagePrefix) ? [value, `/copies/${link.slice(copyPagePrefix.length)}`] : undefined;
	return value;
}

/** A file as the list keeps it: the size alone when the link is the copy's own page. */
export function listedFile(link: string, file: SearchFile): number | SearchFile {
	return link.startsWith(copyPagePrefix) && `/copies/${link.slice(copyPagePrefix.length)}` === file[1] ? file[0] : file;
}

/** The most results one download takes. */
export const selectionLimit = 500;

export const citationFormats = ['txt', 'ris', 'bib'] as const;
export type CitationFormat = (typeof citationFormats)[number];

export const folderChoices = ['kind', 'nation', 'none'] as const;
export type FolderChoice = (typeof folderChoices)[number];

export const nameChoices = ['title', 'publisher'] as const;
export type NameChoice = (typeof nameChoices)[number];

/** What the reader chose to put in the .zip and how to lay it out. */
export interface SelectionOptions {
	files: boolean;
	citations: boolean;
	list: boolean;
	sums: boolean;
	/** verify.sh and verify.ps1, which check the files against SHA256SUMS.txt, so they need it. */
	verify: boolean;
	readme: boolean;
	format: CitationFormat;
	folders: FolderChoice;
	names: NameChoice;
	/** The .zip's name without ".zip"; empty for the name the page suggests. */
	name: string;
}

export const defaultSelectionOptions: SelectionOptions = {
	files: true,
	citations: true,
	list: true,
	sums: true,
	verify: true,
	readme: true,
	format: 'txt',
	folders: 'kind',
	names: 'title',
	name: ''
};

/** Only the citations, which Cite opens the options with. */
export const citationsOnlyOptions: Partial<SelectionOptions> = { files: false, citations: true, list: false, sums: false, verify: false, readme: false };

const pick = <Choice extends string>(choices: readonly Choice[], value: unknown, fallback: Choice): Choice =>
	choices.includes(value as Choice) ? (value as Choice) : fallback;

/** Options from anywhere (the request, the reader's saved choices), each one checked; anything unknown takes the default. */
export function readSelectionOptions(value: unknown): SelectionOptions {
	const given = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
	const flag = (key: keyof SelectionOptions) => (typeof given[key] === 'boolean' ? (given[key] as boolean) : (defaultSelectionOptions[key] as boolean));
	const options: SelectionOptions = {
		files: flag('files'),
		citations: flag('citations'),
		list: flag('list'),
		sums: flag('sums'),
		verify: flag('verify'),
		readme: flag('readme'),
		format: pick(citationFormats, given.format, defaultSelectionOptions.format),
		folders: pick(folderChoices, given.folders, defaultSelectionOptions.folders),
		names: pick(nameChoices, given.names, defaultSelectionOptions.names),
		name: typeof given.name === 'string' ? zipStem(given.name) : ''
	};
	// The scripts check the files against SHA256SUMS.txt, and the list has nothing to check without files.
	if (!options.files) options.sums = false;
	if (!options.sums) options.verify = false;
	return options;
}

/** A name safe inside a .zip file on every system (the Worker's ZIP downloads use the same rule, src/lib/server/zip-stream.ts). */
export function safeFileName(name: string, longest = 150): string {
	return name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').replace(/^\.+/, '').replace(/\s+/g, ' ').trim().slice(0, longest).trim() || 'file';
}

/** The .zip's name as the reader typed it, without ".zip" and safe to save. */
export function zipStem(name: string): string {
	const stem = name.trim().replace(/\.zip$/i, '');
	return stem ? safeFileName(stem, 120) : '';
}

/** The name the page suggests: the words searched and the day, such as "navajo-search-2026-11-27". */
export function suggestedZipName(query: string, day: string): string {
	const words = query
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLocaleLowerCase('en-US')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 60)
		.replace(/-+$/, '');
	return `${words ? `${words}-` : ''}search-${day}`;
}

/** The parts of a result the plan needs. */
export interface SelectedItem {
	title: string;
	group: ResultGroup;
	/** The nation it belongs to, by name, for folders by nation. */
	nation?: string;
	file?: SearchFile;
}

export const citationFileNames: Record<CitationFormat, string> = { txt: 'citations.txt', ris: 'citations.ris', bib: 'citations.bib' };
export const selectionListName = 'selection.csv';
export const sumsName = 'SHA256SUMS.txt';
export const readmeName = 'README.txt';

/** The folder for files that belong to no one nation, when folders go by nation. */
export const noNationFolder = 'Other documents';
/** The one folder, when the reader chose no folders by kind or nation. */
export const oneFolder = 'documents';

/** A file's own extension from its address, such as ".pdf"; empty when it has none. */
export function extensionOf(path: string): string {
	const last = path.split(/[?#]/)[0].split('/').at(-1) ?? '';
	const dot = last.lastIndexOf('.');
	return dot > 0 ? last.slice(dot).toLowerCase() : '';
}

/** The file's name as its publisher gave it: the last part of its address on this site, which keeps the name it was published under. */
export function publisherName(path: string): string {
	const last = path.split(/[?#]/)[0].split('/').at(-1) ?? '';
	try {
		return decodeURIComponent(last);
	} catch {
		return last;
	}
}

function folderOf(item: SelectedItem, folders: FolderChoice): string {
	if (folders === 'none') return oneFolder;
	if (folders === 'nation') return safeFileName(item.nation || noNationFolder, 80);
	return safeFileName(resultGroupLabels[item.group] ?? 'Other', 80);
}

/**
 * Where each selected result's file goes inside the .zip, in the order given, or undefined for a
 * result with no file. Two files that would share a name are told apart with "(2)", "(3)".
 */
export function filePaths(items: readonly SelectedItem[], options: Pick<SelectionOptions, 'folders' | 'names'>): (string | undefined)[] {
	const used = new Set<string>();
	return items.map((item) => {
		if (!item.file) return undefined;
		const folder = folderOf(item, options.folders);
		const extension = extensionOf(item.file[1]);
		const base =
			options.names === 'publisher'
				? safeFileName(publisherName(item.file[1]))
				: `${safeFileName(item.title.replace(/\.+$/, ''), 140 - extension.length)}${extension}`;
		const dot = base.length - extensionOf(base).length;
		let name = `${folder}/${base}`;
		for (let number = 2; used.has(name.toLowerCase()); number += 1) name = `${folder}/${base.slice(0, dot)} (${number})${base.slice(dot)}`;
		used.add(name.toLowerCase());
		return name;
	});
}

/** One line of the .zip's contents, as the preview lists it. */
export interface PlannedEntry {
	name: string;
	/** A folder holds the entries that follow it until the next folder. */
	folder?: boolean;
	/** The bytes of a file, or how many files a folder holds, or how many citations a list holds. */
	bytes?: number;
	count?: number;
}

/** What the .zip will hold, in its order: the notes and lists first, then each folder with its files. */
export function plannedEntries(items: readonly SelectedItem[], options: SelectionOptions): PlannedEntry[] {
	const entries: PlannedEntry[] = [];
	const withFiles = options.files ? items.filter((item) => item.file) : [];
	if (options.readme) entries.push({ name: readmeName });
	if (options.citations) entries.push({ name: citationFileNames[options.format], count: items.length });
	if (options.list) entries.push({ name: selectionListName });
	if (options.sums && withFiles.length > 0) entries.push({ name: sumsName });
	if (options.verify && withFiles.length > 0) entries.push({ name: verifyShellName }, { name: verifyPowerShellName });
	const paths = filePaths(withFiles, options);
	const folders = new Map<string, PlannedEntry[]>();
	paths.forEach((path, index) => {
		if (!path) return;
		const slash = path.lastIndexOf('/');
		const folder = path.slice(0, slash);
		folders.set(folder, [...(folders.get(folder) ?? []), { name: path.slice(slash + 1), bytes: withFiles[index].file?.[0] }]);
	});
	for (const [folder, files] of [...folders].sort(([first], [second]) => first.localeCompare(second, 'en', { sensitivity: 'base' }))) {
		entries.push({ name: `${folder}/`, folder: true, count: files.length }, ...files);
	}
	return entries;
}

/** Whether the download is one list of citations, which comes as that file alone rather than a .zip. */
export function citationsAlone(options: SelectionOptions): boolean {
	return options.citations && !options.files && !options.list && !options.readme;
}

/** "1.7 MB", "974 KB": sizes as the search page tags them, in powers of 1,000 as the copies' pages give them. */
export function sizeText(bytes: number): string {
	if (bytes < 1000) return `${bytes} B`;
	if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} KB`;
	if (bytes < 1_000_000_000) return `${(bytes / 1_000_000).toFixed(bytes < 10_000_000 ? 1 : 0)} MB`;
	return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
}

/** What the reader sends to the Worker: each result's link, and its title and group as the page lists it. */
export interface SelectionRequest {
	items: { link: string; title: string; group: ResultGroup; nation?: string }[];
	options: SelectionOptions;
	/** The words searched, which the README gives. */
	query: string;
}

/** A request from the form the search page sends, each part checked; undefined when it holds nothing usable. */
export function readSelectionRequest(text: string): SelectionRequest | undefined {
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch {
		return undefined;
	}
	if (!value || typeof value !== 'object') return undefined;
	const given = value as { items?: unknown; options?: unknown; query?: unknown };
	if (!Array.isArray(given.items)) return undefined;
	const seen = new Set<string>();
	const items: SelectionRequest['items'] = [];
	for (const item of given.items.slice(0, selectionLimit)) {
		if (!item || typeof item !== 'object') continue;
		const { link, title, group, nation } = item as Record<string, unknown>;
		if (typeof link !== 'string' || !link || link.length > 2000 || seen.has(link)) continue;
		if (!link.startsWith('/') && !/^https?:\/\//.test(link)) continue;
		if (typeof group !== 'string' || !resultGroups.includes(group as ResultGroup)) continue;
		seen.add(link);
		items.push({
			link,
			title: typeof title === 'string' && title.trim() ? title.trim().slice(0, 500) : link,
			group: group as ResultGroup,
			...(typeof nation === 'string' && nation.trim() ? { nation: nation.trim().slice(0, 200) } : {})
		});
	}
	if (items.length === 0) return undefined;
	return { items, options: readSelectionOptions(given.options), query: typeof given.query === 'string' ? given.query.slice(0, 200) : '' };
}
