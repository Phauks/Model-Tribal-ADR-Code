/**
 * The messages the page and the service worker exchange about saving for
 * offline reading (site/DESIGN.md, section 10), and the collections a device
 * kept before the outline of src/lib/offline-choices.ts replaced them, which
 * the worker reads once to carry a reader's choice over. Shared by src/service-worker/index.ts and
 * src/lib/offline-saving.ts, so it must not use the page or the worker's
 * own globals.
 */

import type { ChoiceChange, ChoicesStatus, PageChoice } from './offline-choices.ts';
import type { DocumentSet, DocumentsStatus } from './offline-documents.ts';

export type CollectionIdentifier = 'nations' | 'cases' | 'stories' | 'glossary' | 'other';

export interface Collection {
	id: CollectionIdentifier;
	label: string;
	hint: string;
}

export const collections: Collection[] = [
	{
		id: 'nations',
		label: 'Nation profiles',
		hint: 'A page for each nation, the list of nations, the drawn maps, the tables, the charts and Find recourse'
	},
	{ id: 'cases', label: 'Cases and biographies', hint: 'Each court case, each Supreme Court case and each biography' },
	{ id: 'stories', label: 'Stories', hint: 'Each story in full, with its credit and source' },
	{ id: 'glossary', label: 'Glossary', hint: 'Every glossary entry' },
	{
		id: 'other',
		label: 'Other pages',
		hint: 'Every page not listed above, such as the home page, help, forms, the changelog and the about pages'
	}
];

/** The page a file belongs to: "/nations/x/__data.json" belongs to "/nations/x". */
export function pageOf(path: string): string {
	if (path === '/__data.json') return '/';
	return path.endsWith('/__data.json') ? path.slice(0, -'/__data.json'.length) : path;
}

function under(path: string, section: string): boolean {
	return path === section || path.startsWith(`${section}/`);
}

/**
 * The sections in "Cases and biographies". They were once part of "Other pages", which grew from a few dozen pages to
 * nearly 2,000 when they were added, so a reader who had kept "Other pages" was sent all of them (Nov. 24, 2026). A large
 * new section gets a collection of its own here rather than falling into "Other pages".
 */
const casesSections = ['/cases', '/supreme-court', '/biographies', '/courts'];

/** Which collection a page or one of its data files belongs to. */
export function collectionOf(path: string): CollectionIdentifier {
	const page = pageOf(path);
	if (under(page, '/nations')) return 'nations';
	if (casesSections.some((section) => under(page, section))) return 'cases';
	if (under(page, '/stories')) return 'stories';
	if (under(page, '/glossary')) return 'glossary';
	return 'other';
}

export type WorkerRequest =
	| { type: 'skip-waiting' }
	| { type: 'documents-status'; sets: DocumentSet[] }
	| { type: 'documents-save'; set: DocumentSet }
	| { type: 'documents-remove'; set: DocumentSet }
	/** What is saved, for the Read offline page and Settings (src/lib/offline-choices.ts). */
	| { type: 'choices-status' }
	/** The reader's ticks: the worker answers with the status at once, then progress while it saves. */
	| { type: 'choices-apply'; changes: ChoiceChange[] }
	| { type: 'choices-clear-read' }
	/** Forgets every choice and deletes every saved page and copy (Settings > Your data). */
	| { type: 'choices-clear' }
	| { type: 'page-choice'; path: string }
	| { type: 'offline-resume' };

export type WorkerReply =
	| { type: 'choices'; status: ChoicesStatus }
	| { type: 'choices-progress'; done: number; total: number }
	| { type: 'page-choice'; choice: PageChoice }
	| { type: 'cleared' }
	/** The chosen pages were saved again after an update (offline-resume); the page needs no status then. */
	| { type: 'resumed' }
	| { type: 'documents'; status: DocumentsStatus }
	| { type: 'documents-progress'; set: DocumentSet; done: number; total: number }
	| { type: 'failed'; message: string };

/** The time a build was made, from the build version "<site version>+<milliseconds>". */
export function buildTime(version: string): Date | undefined {
	const milliseconds = Number(version.split('+')[1]);
	return Number.isFinite(milliseconds) && milliseconds > 0 ? new Date(milliseconds) : undefined;
}

export function formatBytes(bytes: number): string {
	if (bytes < 1000 * 1000) return `${Math.max(1, Math.round(bytes / 1000))} KB`;
	if (bytes < 1000 * 1000 * 1000) return `${(bytes / (1000 * 1000)).toFixed(1)} MB`;
	return `${(bytes / (1000 * 1000 * 1000)).toFixed(1)} GB`;
}
