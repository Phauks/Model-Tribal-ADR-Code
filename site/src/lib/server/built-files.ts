/**
 * Reads the data the build keeps out of the Worker's code (src/lib/built-files.ts).
 *
 * - While the site is built, and in development, a set is read once from
 *   its file in .svelte-kit/built-data/, which the build writes
 *   (vite.config.ts), so the pages built ahead of time have all of it.
 * - In the Worker, only the files that hold the records asked for are read,
 *   from the static files (the ASSETS binding), and kept in memory for the
 *   next request.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { building, dev } from '$app/env';
import { builtDataFolder, fileNumber, privateFilePath, spreadFilePath, type SpreadFiles } from '../built-files.ts';
import { workerEnvironment } from './environment.ts';

const readWhileBuilding = new Map<string, unknown>();

/** One of the build's data files, while the site is built or in development; undefined in the Worker. */
export function builtDataWhileBuilding<T>(name: string): T | undefined {
	if (!building && !dev) return undefined;
	if (!readWhileBuilding.has(name)) {
		readWhileBuilding.set(name, JSON.parse(readFileSync(path.resolve(process.cwd(), builtDataFolder, `${name}.json`), 'utf8')));
	}
	return readWhileBuilding.get(name) as T;
}

/** One of the site's static files as JSON, read through the ASSETS binding; undefined when the Worker has no such binding. */
export async function readStaticJson<T>(address: string): Promise<T | undefined> {
	const assets = workerEnvironment().ASSETS;
	if (!assets) return undefined;
	const response = await assets.fetch(new URL(address, 'https://assets.invalid').toString());
	if (!response.ok) throw new Error(`Reading ${address} failed: ${response.status}`);
	return (await response.json()) as T;
}

/** A single private file, read once in each copy of the Worker; `empty` when there are no static files to read. */
export function privateFile<T>(name: string, empty: T): () => Promise<T> {
	let read: Promise<T> | undefined;
	return () => {
		const built = builtDataWhileBuilding<T>(name);
		if (built !== undefined) return Promise.resolve(built);
		read ??= readStaticJson<T>(privateFilePath(name))
			.then((value) => value ?? empty)
			.catch((problem: unknown) => {
				read = undefined;
				throw problem;
			});
		return read;
	};
}

export interface SpreadReader<T> {
	/** The records of these keys; a key with no record is left out. */
	recordsFor(keys: Iterable<string>): Promise<Map<string, T>>;
	/** One record, or undefined when there is none. */
	recordOf(key: string): Promise<T | undefined>;
}

/**
 * Reads records spread over files by key. `keptAtMost` files are kept in
 * memory, the least recently used let go first; `readsAtOnce` are read at
 * the same time.
 */
export function spreadReader<T>(options: {
	count: number;
	path: (number: number) => string;
	whileBuilding: () => Record<string, T> | undefined;
	keptAtMost: number;
	readsAtOnce?: number;
}): SpreadReader<T> {
	const { count, keptAtMost, readsAtOnce = 16 } = options;
	const kept = new Map<number, Promise<Record<string, T>>>();

	function file(number: number): Promise<Record<string, T>> {
		let read = kept.get(number);
		if (read) {
			// Most recently used last, so the oldest is the one let go.
			kept.delete(number);
			kept.set(number, read);
			return read;
		}
		read = readStaticJson<Record<string, T>>(options.path(number))
			.then((records) => records ?? {})
			.catch((problem: unknown) => {
				kept.delete(number);
				throw problem;
			});
		if (kept.size >= keptAtMost) kept.delete(kept.keys().next().value as number);
		kept.set(number, read);
		return read;
	}

	async function recordsFor(keys: Iterable<string>): Promise<Map<string, T>> {
		const wanted = [...new Set(keys)];
		const found = new Map<string, T>();
		const all = options.whileBuilding();
		if (all) {
			for (const key of wanted) if (all[key] !== undefined) found.set(key, all[key]);
			return found;
		}
		const numbers = [...new Set(wanted.map((key) => fileNumber(key, count)))];
		const files = new Map<number, Record<string, T>>();
		for (let start = 0; start < numbers.length; start += readsAtOnce) {
			const group = numbers.slice(start, start + readsAtOnce);
			const read = await Promise.all(group.map(file));
			group.forEach((number, index) => files.set(number, read[index]));
		}
		for (const key of wanted) {
			const record = files.get(fileNumber(key, count))?.[key];
			if (record !== undefined) found.set(key, record);
		}
		return found;
	}

	return { recordsFor, recordOf: async (key) => (await recordsFor([key])).get(key) };
}

/** Reads one of the private sets of src/lib/built-files.ts. */
export function privateSpreadReader<T>(set: SpreadFiles, keptAtMost: number): SpreadReader<T> {
	return spreadReader<T>({
		count: set.count,
		path: (number) => spreadFilePath(set, number),
		whileBuilding: () => builtDataWhileBuilding<Record<string, T>>(set.name),
		keptAtMost
	});
}
