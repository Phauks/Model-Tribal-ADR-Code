/**
 * A copy of the editor's text kept in this browser until the site has saved
 * it, so text is not lost when a save cannot reach the site, the sign-in has
 * ended, or the tab closes while a save is on its way. The editor offers it
 * back the next time the essay opens.
 */

export interface LocalDraft {
	text: string;
	/** The saved version the text started from, so bringing it back still catches someone else's newer save. */
	basedOn: number;
	/** When it was kept, as an ISO date. */
	at: string;
}

const key = (identifier: string): string => `essay-draft:${identifier}`;

export function keepLocalDraft(identifier: string, text: string, basedOn: number): void {
	try {
		localStorage.setItem(key(identifier), JSON.stringify({ text, basedOn, at: new Date().toISOString() } satisfies LocalDraft));
	} catch {
		// Storage can be full or blocked; the save itself still goes ahead.
	}
}

export function localDraft(identifier: string): LocalDraft | null {
	try {
		const kept = JSON.parse(localStorage.getItem(key(identifier)) ?? 'null') as Partial<LocalDraft> | null;
		if (!kept || typeof kept.text !== 'string' || typeof kept.basedOn !== 'number' || typeof kept.at !== 'string') return null;
		return { text: kept.text, basedOn: kept.basedOn, at: kept.at };
	} catch {
		return null;
	}
}

/** Forgets the kept copy, but only if it is still the text given (a newer copy stays). */
export function dropLocalDraft(identifier: string, text?: string): void {
	try {
		if (text !== undefined && localDraft(identifier)?.text !== text) return;
		localStorage.removeItem(key(identifier));
	} catch {
		// As above.
	}
}

/** Browsers refuse a keepalive request whose body is over 64 KiB, so only smaller saves use it. */
export const keepaliveLimit = 60_000;

/**
 * Whether a save's response really came from the save endpoint. When the
 * sign-in has ended, the server redirects to the sign-in page, which fetch
 * follows and answers with HTML and status 200.
 */
export function isSaveAnswer(response: Response): boolean {
	return !response.redirected && (response.headers.get('content-type') ?? '').includes('application/json');
}
