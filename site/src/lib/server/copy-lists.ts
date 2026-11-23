/**
 * Splits the copies this site serves (src/lib/public-copies.ts) into short
 * lists, so no page has to hold thousands of rows: federal statutes, Federal
 * Register documents, other federal documents, and nations' documents by the
 * first letter of the nation's name.
 */
import { displayName } from '../nation-labels.ts';
import { copyPath, fileSize, mediaLabel, removalRequestPath, type PublicCopy } from '../public-copies.ts';
import type { DocumentFile, DocumentSetList, DocumentSetSummary } from '../offline-documents.ts';
import { formatCaptureDate } from './markdown.ts';
import { nations, publicCopies } from './content.ts';

export interface CopyGroup {
	/** The list's address below /copies/list/. */
	slug: string;
	title: string;
	count: number;
}

export interface CopyRow {
	key: string;
	title: string;
	kind: string;
	nations: string[];
	path: string;
	original: string;
	captured: string;
	capturedText: string;
	size: string;
	bytes: number;
	sha256: string;
	removal: string;
}

const federalGroups: Record<string, string> = {
	statutes: 'Federal statutes and Public Laws',
	'federal-register': 'Federal Register documents',
	'other-federal': 'Other federal documents'
};

function nationNames(): Map<string, string> {
	return new Map(nations().map((record) => [record.id, displayName(record.names.official)]));
}

/** The nations a copy belongs to, by name. */
function namesOf(copy: PublicCopy, names: Map<string, string>): string[] {
	const ids = copy.nations.length > 0 ? copy.nations : copy.topic === 'constitutions' ? [copy.key.split('/')[1]] : [];
	return ids.flatMap((id) => {
		const name = names.get(id);
		return name ? [name] : [];
	});
}

function groupOf(copy: PublicCopy, names: Map<string, string>): string {
	if (copy.topic === 'constitutions' || copy.topic === 'tribal-law') {
		const [first] = namesOf(copy, names);
		const letter = first?.normalize('NFD').charAt(0).toLowerCase() ?? '';
		return /^[a-z]$/.test(letter) ? letter : 'other-nations';
	}
	const file = copy.key.split('/').at(-1) ?? '';
	if (copy.topic === 'govinfo' && /^(STATUTE|PLAW)-/.test(file)) return 'statutes';
	if (copy.topic === 'tile.loc.gov') return 'statutes';
	if (copy.topic === 'govinfo' && /^FR-/.test(copy.key.split('/')[1] ?? '')) return 'federal-register';
	return 'other-federal';
}

function groupTitle(slug: string): string {
	if (federalGroups[slug]) return federalGroups[slug];
	if (slug === 'other-nations') return 'Nations’ documents, other names';
	return `Nations’ documents: ${slug.toUpperCase()}`;
}

function row(copy: PublicCopy, names: Map<string, string>): CopyRow {
	return {
		key: copy.key,
		title: copy.title,
		kind: mediaLabel(copy.mediaType),
		nations: namesOf(copy, names),
		path: copyPath(copy),
		original: copy.links.at(-1) ?? copy.links[0],
		captured: copy.captured,
		capturedText: copy.captured ? formatCaptureDate(copy.captured) : '',
		size: fileSize(copy.bytes),
		bytes: copy.bytes,
		sha256: copy.sha256,
		removal: removalRequestPath(copy)
	};
}

/** Every list, federal ones first, then nations by letter. */
export function copyGroups(): CopyGroup[] {
	const names = nationNames();
	const counts = new Map<string, number>();
	for (const copy of publicCopies()) {
		const slug = groupOf(copy, names);
		counts.set(slug, (counts.get(slug) ?? 0) + 1);
	}
	const order = (slug: string) => (federalGroups[slug] ? Object.keys(federalGroups).indexOf(slug) : slug === 'other-nations' ? 1000 : 10 + slug.charCodeAt(0));
	return [...counts]
		.sort(([first], [second]) => order(first) - order(second))
		.map(([slug, count]) => ({ slug, title: groupTitle(slug), count }));
}

/** The rows of one list. */
export function copyRows(slug: string): CopyRow[] {
	const names = nationNames();
	return publicCopies()
		.filter((copy) => groupOf(copy, names) === slug)
		.map((copy) => row(copy, names));
}

/** Every copy, for the downloadable list. */
export function allCopyRows(): CopyRow[] {
	const names = nationNames();
	return publicCopies().map((copy) => row(copy, names));
}

export { groupTitle };

/**
 * The copies a reader can save for offline reading, by set (src/lib/offline-documents.ts): the
 * United States documents as one set, and each nation's constitutions and laws as its own. A
 * document that belongs to several nations is in each of their sets.
 */
let offlineSetCache: { federal: DocumentSetList; nations: Map<string, DocumentSetList> } | undefined;

export function offlineSets(): { federal: DocumentSetList; nations: Map<string, DocumentSetList> } {
	offlineSetCache ??= buildOfflineSets();
	return offlineSetCache;
}

function buildOfflineSets(): { federal: DocumentSetList; nations: Map<string, DocumentSetList> } {
	const names = nationNames();
	const federal: DocumentFile[] = [];
	const byNation = new Map<string, DocumentFile[]>();
	for (const copy of publicCopies()) {
		const file: DocumentFile = [copyPath(copy), copy.bytes, copy.sha256.slice(0, 16)];
		if (copy.topic !== 'constitutions' && copy.topic !== 'tribal-law') {
			federal.push(file);
			continue;
		}
		const ids = copy.nations.length > 0 ? copy.nations : copy.topic === 'constitutions' ? [copy.key.split('/')[1]] : [];
		for (const id of ids) {
			if (!id || !names.has(id)) continue;
			byNation.set(id, [...(byNation.get(id) ?? []), file]);
		}
	}
	const nationLists = new Map(
		[...byNation].sort(([first], [second]) => first.localeCompare(second)).map(([id, files]) => [id, { title: names.get(id) ?? id, files }])
	);
	return { federal: { title: 'United States laws and government documents', files: federal }, nations: nationLists };
}

/** The short list of every set, for the Data section in Settings. */
export function offlineSetSummary(): DocumentSetSummary {
	const { federal, nations: nationLists } = offlineSets();
	const sum = (files: DocumentFile[]) => files.reduce((total, [, bytes]) => total + bytes, 0);
	return {
		federal: { title: federal.title, count: federal.files.length, bytes: sum(federal.files) },
		nations: Object.fromEntries(
			[...nationLists].map(([id, list]) => [id, { title: list.title, count: list.files.length, bytes: sum(list.files) }])
		)
	};
}
