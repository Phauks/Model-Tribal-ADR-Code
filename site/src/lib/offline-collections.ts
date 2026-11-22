/**
 * The parts of the site a reader can save for offline reading in one step
 * (site/DESIGN.md, section 10), and the messages the page and the service
 * worker exchange about them. Shared by src/service-worker/index.ts and
 * src/lib/offline-saving.ts, so it must not use the page or the worker's
 * own globals.
 */

export type CollectionIdentifier = 'nations' | 'glossary' | 'other';

export interface Collection {
	id: CollectionIdentifier;
	label: string;
	hint: string;
}

export const collections: Collection[] = [
	{
		id: 'nations',
		label: 'Nation profiles',
		hint: 'A page for each nation, the list of nations and the maps'
	},
	{ id: 'glossary', label: 'Glossary', hint: 'Every glossary entry' },
	{
		id: 'other',
		label: 'Other pages',
		hint: 'The home page, stories, changelog, downloads and help pages'
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

/** Which collection a page or one of its data files belongs to. */
export function collectionOf(path: string): CollectionIdentifier {
	const page = pageOf(path);
	if (under(page, '/nations')) return 'nations';
	if (under(page, '/glossary')) return 'glossary';
	return 'other';
}

export interface CollectionStatus {
	id: CollectionIdentifier;
	/** Pages in this build. */
	total: number;
	/** Pages saved on this device. */
	saved: number;
	/** Bytes the saved pages take, counted from the saved files. */
	bytes: number;
	/** The reader asked to keep the whole collection, so updates save it again. */
	kept: boolean;
}

export interface OfflineStatus {
	/** The build the saved copies come from, for example "0.0.1+1795229308081". */
	version: string;
	collections: CollectionStatus[];
}

export type WorkerRequest =
	| { type: 'skip-waiting' }
	| { type: 'offline-status' }
	| { type: 'offline-save'; collection: CollectionIdentifier }
	| { type: 'offline-remove'; collection: CollectionIdentifier }
	| { type: 'offline-resume' };

export type WorkerReply =
	| { type: 'status'; status: OfflineStatus }
	| { type: 'progress'; collection: CollectionIdentifier; done: number; total: number }
	| { type: 'failed'; message: string };

/** The time a build was made, from the build version "<site version>+<milliseconds>". */
export function buildTime(version: string): Date | undefined {
	const milliseconds = Number(version.split('+')[1]);
	return Number.isFinite(milliseconds) && milliseconds > 0 ? new Date(milliseconds) : undefined;
}

export function formatBytes(bytes: number): string {
	if (bytes < 1000 * 1000) return `${Math.max(1, Math.round(bytes / 1000))} KB`;
	return `${(bytes / (1000 * 1000)).toFixed(1)} MB`;
}
