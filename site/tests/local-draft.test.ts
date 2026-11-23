import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dropLocalDraft, isSaveAnswer, keepaliveLimit, keepLocalDraft, localDraft } from '../src/lib/essays/local-draft.ts';

describe('the copy of unsaved text kept in the browser', () => {
	beforeEach(() => {
		const stored = new Map<string, string>();
		vi.stubGlobal('localStorage', {
			getItem: (key: string) => stored.get(key) ?? null,
			setItem: (key: string, value: string) => void stored.set(key, value),
			removeItem: (key: string) => void stored.delete(key)
		});
	});
	afterEach(() => vi.unstubAllGlobals());

	it('keeps the text with the version it started from', () => {
		keepLocalDraft('timeline', 'First words.', 12);
		expect(localDraft('timeline')).toMatchObject({ text: 'First words.', basedOn: 12 });
		expect(localDraft('another-essay')).toBeNull();
	});

	it('forgets it once saved, but not a newer copy', () => {
		keepLocalDraft('timeline', 'Newer words.', 12);
		dropLocalDraft('timeline', 'Older words.');
		expect(localDraft('timeline')?.text).toBe('Newer words.');
		dropLocalDraft('timeline', 'Newer words.');
		expect(localDraft('timeline')).toBeNull();
	});

	it('works without storage', () => {
		vi.stubGlobal('localStorage', undefined);
		expect(() => keepLocalDraft('timeline', 'Words.', 1)).not.toThrow();
		expect(localDraft('timeline')).toBeNull();
	});
});

describe('reading a save answer', () => {
	it('takes only a JSON answer that was not redirected', () => {
		expect(isSaveAnswer(new Response('{"number":3}', { headers: { 'Content-Type': 'application/json' } }))).toBe(true);
		// The sign-in page, after fetch followed the redirect for an ended sign-in.
		expect(isSaveAnswer(new Response('<!doctype html>', { headers: { 'Content-Type': 'text/html' } }))).toBe(false);
		const redirected = new Response('{}', { headers: { 'Content-Type': 'application/json' } });
		Object.defineProperty(redirected, 'redirected', { value: true });
		expect(isSaveAnswer(redirected)).toBe(false);
	});

	it('keeps keepalive saves under the browsers’ 64 KiB limit', () => {
		expect(keepaliveLimit).toBeLessThan(64 * 1024);
	});
});
