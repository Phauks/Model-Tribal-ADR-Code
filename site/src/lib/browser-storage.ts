/**
 * Choices remembered in this browser, in localStorage or, for the tab only, sessionStorage. Storage can be blocked, full or missing, as in a private window or on the server, so every read and write here gives up quietly: a read finds nothing, and a write is not kept, so the choice lasts for this page only.
 */

/** Where a value is kept: "local" for this browser, "session" for this tab until it closes. */
export type StorageArea = 'local' | 'session';

function storageFor(area: StorageArea): Storage {
	return area === 'session' ? sessionStorage : localStorage;
}

/** The value kept under the key, or null when there is none or storage is off. */
export function readStored(key: string, area: StorageArea = 'local'): string | null {
	try {
		return storageFor(area).getItem(key);
	} catch {
		return null;
	}
}

/** Keeps the value under the key, or forgets the key when the value is null. Returns false when storage refused. */
export function writeStored(key: string, value: string | null, area: StorageArea = 'local'): boolean {
	try {
		if (value === null) storageFor(area).removeItem(key);
		else storageFor(area).setItem(key, value);
		return true;
	} catch {
		return false;
	}
}

/** The value kept under the key as JSON, or null when there is none, it is not JSON, or storage is off. The caller checks its shape. */
export function readStoredJson(key: string, area: StorageArea = 'local'): unknown {
	const text = readStored(key, area);
	if (text === null) return null;
	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
}

/** Keeps the value under the key as JSON. Returns false when storage refused. */
export function writeStoredJson(key: string, value: unknown, area: StorageArea = 'local'): boolean {
	let text: string;
	try {
		text = JSON.stringify(value);
	} catch {
		return false;
	}
	return writeStored(key, text, area);
}
