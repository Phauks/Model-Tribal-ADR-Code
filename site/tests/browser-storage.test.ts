import { afterEach, describe, expect, it, vi } from 'vitest';
import { readStored, readStoredJson, writeStored, writeStoredJson } from '#lib/browser-storage.ts';

/** A Storage kept in a Map, as a browser's own. */
function memoryStorage(): Storage {
	const values = new Map<string, string>();
	return {
		get length() {
			return values.size;
		},
		clear: () => values.clear(),
		getItem: (key) => values.get(key) ?? null,
		key: (index) => [...values.keys()][index] ?? null,
		removeItem: (key) => void values.delete(key),
		setItem: (key, value) => void values.set(key, String(value))
	};
}

/** A Storage that refuses everything, as a private window or a full one can. */
function refusingStorage(): Storage {
	const refuse = () => {
		throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
	};
	return { length: 0, clear: refuse, getItem: refuse, key: refuse, removeItem: refuse, setItem: refuse };
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('browser storage', () => {
	it('reads back what it wrote, and forgets a key written as null', () => {
		vi.stubGlobal('localStorage', memoryStorage());
		expect(readStored('layout')).toBeNull();
		expect(writeStored('layout', 'across')).toBe(true);
		expect(readStored('layout')).toBe('across');
		expect(writeStored('layout', null)).toBe(true);
		expect(readStored('layout')).toBeNull();
	});

	it('keeps tab-only values apart from the browser-wide ones', () => {
		vi.stubGlobal('localStorage', memoryStorage());
		vi.stubGlobal('sessionStorage', memoryStorage());
		writeStored('mode', 'editing', 'session');
		expect(readStored('mode', 'session')).toBe('editing');
		expect(readStored('mode')).toBeNull();
	});

	it('gives up quietly when storage throws', () => {
		vi.stubGlobal('localStorage', refusingStorage());
		expect(readStored('layout')).toBeNull();
		expect(writeStored('layout', 'across')).toBe(false);
		expect(writeStored('layout', null)).toBe(false);
		expect(readStoredJson('layout')).toBeNull();
		expect(writeStoredJson('layout', { on: true })).toBe(false);
	});

	it('gives up quietly when reaching storage at all throws', () => {
		const before = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
		Object.defineProperty(globalThis, 'sessionStorage', {
			configurable: true,
			get() {
				throw new DOMException('Access is denied.', 'SecurityError');
			}
		});
		try {
			expect(readStored('mode', 'session')).toBeNull();
			expect(writeStored('mode', 'editing', 'session')).toBe(false);
		} finally {
			if (before) Object.defineProperty(globalThis, 'sessionStorage', before);
			else Reflect.deleteProperty(globalThis, 'sessionStorage');
		}
	});

	it('reads and writes JSON, and reads anything that is not JSON as nothing', () => {
		const storage = memoryStorage();
		vi.stubGlobal('localStorage', storage);
		expect(writeStoredJson('words', ['tribal', 'nation'])).toBe(true);
		expect(storage.getItem('words')).toBe('["tribal","nation"]');
		expect(readStoredJson('words')).toEqual(['tribal', 'nation']);
		storage.setItem('words', '{not json');
		expect(readStoredJson('words')).toBeNull();
		expect(readStoredJson('missing')).toBeNull();
	});

	it('does not write a value JSON cannot hold', () => {
		vi.stubGlobal('localStorage', memoryStorage());
		const circular: Record<string, unknown> = {};
		circular.self = circular;
		expect(writeStoredJson('loop', circular)).toBe(false);
		expect(readStored('loop')).toBeNull();
	});
});
