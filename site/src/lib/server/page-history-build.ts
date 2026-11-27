/**
 * Lists the pages built with the site for Recent changes and page histories
 * (src/lib/server/page-history.ts), with a fingerprint of what each shows
 * readers and the merged changes that last touched it. Runs in Node when the
 * site is built (vite.config.ts, "page-history").
 *
 * Nation pages and stories never keep their earlier wording on the site
 * (Trevor, Nov. 23, 2026): for them the build lists a hash of each part of
 * the page, so a change can name the parts that changed, and no text. For
 * the other pages it lists the text readers see, so two versions can be
 * compared.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { displayName } from '#lib/nation-labels.ts';
import { pageAddressOfFile, type HistoryBuild, type HistoryCommit, type HistoryPage } from '#lib/page-history.ts';
import { marked } from 'marked';
import { isoDate, shownExcerpts, shownFullText, shownTellings, storyIsShown } from '#lib/story-visibility.ts';
import { documentHistories, glossary, nations, readFrontMatterPage, repositoryRoot, storyRecords } from './content.ts';
import { shownRecord } from './followable-build.ts';
import { projectDocumentPage, projectDocuments } from './project-documents.ts';

/** Raise this when the fingerprints or texts below are worked out differently, so the change is not recorded as an edit to every page. */
export const historyFingerprintVersion = 1;

/** A merged change that touched more pages than this is a bulk update. */
export const bulkPageCount = 25;

function hash(value: unknown): string {
	return createHash('sha256')
		.update(typeof value === 'string' ? value : JSON.stringify(value))
		.digest('hex')
		.slice(0, 32);
}

/** The names readers know the parts of a nation's page by, for the keys of its record. */
const nationPartLabels: Record<string, string> = {
	id: 'Page address',
	names: 'Names',
	entity_type: 'Recognition',
	recognition: 'Recognition',
	states: 'Location',
	census_areas: 'Land areas',
	review: 'Review status',
	sensitivity: 'Notes on sensitive material',
	contacts: 'Contacts',
	population: 'Population',
	federal_administration: 'Federal administration',
	jurisdiction: 'Jurisdiction',
	justice_institutions: 'Courts and justice programs',
	governing_documents: 'Governing documents',
	official_images: 'Seal and images',
	tribal_insignia_database_entries: 'Seal and images',
	languages: 'Languages',
	language_programs: 'Languages',
	gaming: 'Gaming',
	memberships: 'Memberships',
	related_entities: 'Related nations',
	part_of: 'Related nations',
	dispute_resolution: 'Dispute resolution',
	government_structure: 'Government',
	documents: 'Document history'
};

const storyPartLabels: Record<string, string> = {
	id: 'Page address',
	title: 'Title',
	titles_in_language: 'Title',
	full_text: 'Story text',
	excerpts: 'Excerpts',
	tellings: 'Tellings',
	protocols: 'Protocols',
	methods: 'Methods and topics',
	topics: 'Methods and topics',
	nations: 'Nations',
	community: 'Nations',
	found_in: 'Where it was published',
	anthology: 'Where it was published',
	access: 'Who may see it',
	sensitivity: 'Who may see it',
	review_status: 'Review status',
	notes: 'Notes',
	length: 'Length',
	kind: 'Kind of story'
};

/** A key such as "usage_note" or "fullText" as words: "Usage note", "Full text". */
export function keyLabel(key: string): string {
	const words = key
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		.replace(/[_-]+/g, ' ')
		.trim()
		.toLowerCase();
	return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A hash of each part of a page, with keys that show in the same part merged under one name. */
export function partHashes(value: Record<string, unknown>, labels: Record<string, string>): Record<string, string> {
	const grouped = new Map<string, Record<string, unknown>>();
	for (const [key, part] of Object.entries(value)) {
		if (part === undefined) continue;
		const label = labels[key] ?? keyLabel(key);
		grouped.set(label, { ...grouped.get(label), [key]: part });
	}
	return Object.fromEntries([...grouped].map(([label, parts]) => [label, hash(parts).slice(0, 10)]));
}

/**
 * A record as readable text, one field to a paragraph, so two versions can be
 * compared paragraph by paragraph (src/lib/essays/compare.ts).
 */
export function recordText(title: string, record: Record<string, unknown>, leaveOut: string[] = []): string {
	const blocks = [`# ${title}`];
	const add = (label: string, value: unknown) => {
		if (value === undefined || value === null || value === '') return;
		if (Array.isArray(value)) {
			if (value.every((item) => typeof item !== 'object' || item === null)) {
				if (value.length > 0) blocks.push(`${label}: ${value.join('; ')}`);
			} else value.forEach((item, index) => add(`${label} ${index + 1}`, item));
		} else if (typeof value === 'object') {
			for (const [key, inner] of Object.entries(value)) add(`${label}, ${keyLabel(key).toLowerCase()}`, inner);
		} else {
			blocks.push(`${label}: ${String(value).replace(/\s*\n\s*/g, ' ').trim()}`);
		}
	};
	for (const [key, value] of Object.entries(record)) {
		if (!leaveOut.includes(key)) add(keyLabel(key), value);
	}
	return blocks.join('\n\n');
}

/** Text with the site's own markup taken out: [[term]] links as their words, [@key] citations dropped. */
export function plainMarkup(text: string): string {
	return text
		.replace(/\s*\[@[^\]]+\]/g, '')
		.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
		.replace(/\[\[([^\]]+)\]\]/g, (_, id: string) => id.replace(/-/g, ' '));
}

const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** A rendered page's HTML as plain text, one paragraph, heading or list item to a block. */
export function htmlText(html: string): string {
	return html
		.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
		.replace(/<sup[^>]*class="[^"]*citation[^"]*"[\s\S]*?<\/sup>/gi, '')
		.replace(/<\/(p|h[1-6]|li|blockquote|tr|dt|dd|figcaption|pre)>|<br\s*\/?>/gi, '\n\n')
		.replace(/<h([1-6])[^>]*>/gi, (_, level: string) => `${'#'.repeat(Number(level))} `)
		.replace(/<li[^>]*>/gi, '- ')
		.replace(/<[^>]+>/g, '')
		.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, name: string) => {
			if (name.startsWith('#x') || name.startsWith('#X')) return String.fromCodePoint(parseInt(name.slice(2), 16));
			if (name.startsWith('#')) return String.fromCodePoint(Number(name.slice(1)));
			return entities[name.toLowerCase()] ?? whole;
		})
		.split(/\n{2,}/)
		.map((block) => block.replace(/[ \t]*\n[ \t]*/g, ' ').replace(/[ \t]{2,}/g, ' ').trim())
		.filter((block) => block && block !== '-')
		.join('\n\n');
}

function textPage(address: string, kind: HistoryPage['kind'], title: string, text: string): HistoryPage {
	return { address, kind, title, fingerprint: hash(text), bytes: Buffer.byteLength(text, 'utf8'), text, commits: [] };
}

/** Every page built with the site that Recent changes follows, without the merged changes yet. */
export function historyPages(builtAt = new Date()): HistoryPage[] {
	const pages: HistoryPage[] = [];

	const histories = documentHistories();
	for (const record of nations()) {
		if (record.example) continue;
		const shown = shownRecord(record) as Record<string, unknown>;
		const documents = histories.filter((history) => history.nations?.includes(record.id));
		const whole = { ...shown, documents: documents.length > 0 ? documents : undefined };
		pages.push({
			address: `/nations/${record.id}`,
			kind: 'nation',
			title: displayName(record.names.official),
			fingerprint: hash(whole),
			parts: partHashes(whole, nationPartLabels),
			commits: []
		});
	}

	// A story shows only the tellings, excerpts and full text it may show
	// today (src/lib/story-visibility.ts), so only those count.
	const today = isoDate(builtAt);
	for (const record of storyRecords()) {
		if (!storyIsShown(record, today)) continue;
		const shown = {
			...record,
			tellings: shownTellings(record, today),
			excerpts: shownExcerpts(record, today),
			full_text: shownFullText(record, today)
		} as unknown as Record<string, unknown>;
		pages.push({
			address: `/stories/${record.id}`,
			kind: 'story',
			title: record.title.replace(/^\[(.*)\]$/, '$1'),
			fingerprint: hash(shown),
			parts: partHashes(shown, storyPartLabels),
			commits: []
		});
	}

	// The entries the glossary publishes: every one not retired (src/lib/server/glossary-entries.ts, publishedGlossary).
	for (const record of glossary().filter((entry) => entry.status !== 'retired' && !entry.redirect_to)) {
		const text = plainMarkup(
			recordText(record.term, record as unknown as Record<string, unknown>, ['id', 'term', 'sources', 'basis', 'status'])
		);
		pages.push(textPage(`/glossary/${record.id}`, 'glossary', record.term, text));
	}

	// Citations such as [@key] become the numbered marks on the page, which are not part of the text compared.
	const acknowledgments = readFrontMatterPage('acknowledgments');
	const body = htmlText(marked.parse(acknowledgments.body.replace(/\s*\[@[^\]]+\]/g, ''), { async: false }));
	pages.push(textPage('/acknowledgments', 'front-matter', acknowledgments.title, `# ${acknowledgments.title}\n\n${body}`));

	for (const document of projectDocuments()) {
		const page = projectDocumentPage(document.address);
		if (!page) continue;
		const body = htmlText(page.html);
		const text = body.startsWith('# ') ? body : `# ${page.title}\n\n${body}`;
		pages.push(textPage(document.address, 'about', page.title, text));
	}

	return pages.sort((first, second) => first.address.localeCompare(second.address));
}

/** The files each page is built from, relative to the repository root, so merged changes can be matched to pages. */
export function pageFiles(): Map<string, string[]> {
	const files = new Map<string, string[]>();
	for (const history of documentHistories()) {
		const file = `content/documents/${history.id.charAt(0)}/${history.id}.yaml`;
		files.set(file, (history.nations ?? []).map((id) => `/nations/${id}`));
	}
	for (const document of projectDocuments()) files.set(document.file, [document.address]);
	files.set('content/front-matter/acknowledgments.md', ['/acknowledgments']);
	return files;
}

/** One merged change from `git log`: when, its title and the files it touched. */
export interface LoggedCommit {
	merged: string;
	title: string;
	files: string[];
}

/** Reads `git log --first-parent --format=%x1e%cI%x09%s --name-only` output. Only squash merges of pull requests count. */
export function parseNamedLog(text: string): LoggedCommit[] {
	const commits: LoggedCommit[] = [];
	for (const chunk of text.split('\x1e')) {
		const [header, ...rest] = chunk.split('\n');
		const [merged, subject] = header.split('\t');
		const match = subject?.match(/^(?:[a-z]+(?:\([^)]*\))?!?:\s*)?(.+?)\s*\(#\d+\)$/);
		if (!match || Number.isNaN(Date.parse(merged))) continue;
		const title = match[1].charAt(0).toUpperCase() + match[1].slice(1);
		commits.push({ merged, title, files: rest.map((line) => line.trim()).filter(Boolean) });
	}
	return commits;
}

/**
 * Adds to each page the newest merged changes that touched its files, at most
 * three, as places in the list it returns, which the build lists once.
 */
export function attachCommits(pages: HistoryPage[], commits: LoggedCommit[], files: Map<string, string[]>): HistoryCommit[] {
	const byAddress = new Map(pages.map((page) => [page.address, page]));
	const listed: HistoryCommit[] = [];
	for (const commit of commits) {
		const touched = new Set<string>();
		for (const file of commit.files) {
			for (const address of files.get(file) ?? [pageAddressOfFile(file)].filter((found): found is string => Boolean(found))) {
				if (byAddress.has(address)) touched.add(address);
			}
		}
		if (touched.size === 0) continue;
		const place = listed.push({ title: commit.title, merged: commit.merged, bulk: touched.size > bulkPageCount }) - 1;
		for (const address of touched) {
			const page = byAddress.get(address)!;
			if (page.commits.length < 3) page.commits.push(place);
		}
	}
	return listed;
}

function loggedCommits(): LoggedCommit[] {
	try {
		const log = execFileSync(
			'git',
			['log', '--first-parent', '-n', '400', '--format=%x1e%cI%x09%s', '--name-only', 'HEAD', '--', 'content', 'docs/charter.md', 'LICENSE.md', 'LICENSES'],
			{ cwd: path.resolve(repositoryRoot), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 }
		);
		return parseNamedLog(log);
	} catch {
		// expected: no git, as in some builds on a computer: changes are recorded without a summary.
		return [];
	}
}

export function historyBuild(builtAt = new Date()): HistoryBuild {
	const pages = historyPages(builtAt);
	const commits = attachCommits(pages, loggedCommits(), pageFiles());
	return {
		builtAt: builtAt.toISOString(),
		buildHash: hash(pages.map((page) => [page.address, page.fingerprint])),
		fingerprintVersion: historyFingerprintVersion,
		commits,
		pages
	};
}
