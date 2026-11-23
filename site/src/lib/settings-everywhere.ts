/**
 * "Use these settings on every device I sign in on" (Settings, This device;
 * site/DESIGN.md, section 6, "Settings and Account"; decision record 0045).
 *
 * Settings stay on the device: the inline script in app.html applies them
 * before the page paints, and they work offline. When a signed-in person
 * turns this on, a copy is also kept with their account
 * (/account/settings, src/lib/server/account-pages.ts):
 *
 * - Turning it on copies this device's settings and theme to the account.
 * - Each later change on any device where the person is signed in is sent
 *   to the account (the settingsSavedEvent from reading-settings.ts).
 * - On another device, after sign-in, the account's copy replaces the
 *   device's own once it is newer than the one this device last saw.
 * - Turning it off deletes the account's copy; every device keeps what it
 *   has.
 *
 * Starred pages, print choices and pages saved for offline stay on each
 * device.
 */
import {
	loadSettings,
	loadTheme,
	saveSettings,
	saveTheme,
	settingsSavedEvent,
	type ReadingSettings,
	type Theme
} from './reading-settings.ts';

export const everywhereStorageKey = 'settings-everywhere';
const checkedStorageKey = 'settings-everywhere-checked';
const address = '/account/settings';
/** How often a signed-in page asks the account for a newer copy. */
const checkEveryMinutes = 10;

interface EverywhereState {
	on: boolean;
	/** When the account's copy was last changed, as far as this device knows. */
	updatedAt: string | undefined;
}

interface AccountCopy {
	on: boolean;
	settings?: ReadingSettings;
	theme?: Theme;
	updatedAt?: string;
}

/** Whether this device last heard that the switch is on. */
export function readEverywhere(): EverywhereState {
	try {
		const stored = JSON.parse(localStorage.getItem(everywhereStorageKey) ?? 'null') as Partial<EverywhereState> | null;
		return { on: stored?.on === true, updatedAt: typeof stored?.updatedAt === 'string' ? stored.updatedAt : undefined };
	} catch {
		return { on: false, updatedAt: undefined };
	}
}

function remember(state: EverywhereState): void {
	try {
		if (state.on) localStorage.setItem(everywhereStorageKey, JSON.stringify(state));
		else localStorage.removeItem(everywhereStorageKey);
	} catch {
		// Storage blocked: the account still holds the copy.
	}
}

/** Forgets the switch on this device, at sign-out. The account keeps its copy. */
export function forgetEverywhere(): void {
	remember({ on: false, updatedAt: undefined });
	try {
		sessionStorage.removeItem(checkedStorageKey);
	} catch {
		// Nothing was kept.
	}
}

let applying = false;
let sendTimer: ReturnType<typeof setTimeout> | undefined;

async function send(): Promise<AccountCopy | undefined> {
	const response = await fetch(address, {
		method: 'PUT',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ settings: loadSettings(), theme: loadTheme() })
	}).catch(() => undefined);
	if (!response?.ok) return undefined;
	const copy = (await response.json()) as AccountCopy;
	remember({ on: true, updatedAt: copy.updatedAt });
	return copy;
}

/** Turns the switch on, copying this device's settings to the account. */
export async function turnEverywhereOn(): Promise<boolean> {
	return (await send()) !== undefined;
}

/** Turns the switch off and deletes the account's copy. */
export async function turnEverywhereOff(): Promise<boolean> {
	const response = await fetch(address, { method: 'DELETE' }).catch(() => undefined);
	if (!response?.ok) return false;
	remember({ on: false, updatedAt: undefined });
	return true;
}

/** Asks the account for its copy and applies it when it is newer than what this device last saw. */
export async function checkAccountCopy(force = false): Promise<EverywhereState> {
	if (!force) {
		try {
			const last = Number(sessionStorage.getItem(checkedStorageKey) ?? '0');
			if (Date.now() - last < checkEveryMinutes * 60 * 1000) return readEverywhere();
			sessionStorage.setItem(checkedStorageKey, String(Date.now()));
		} catch {
			// Without storage it asks each time a page loads, which still works.
		}
	}
	const response = await fetch(address, { headers: { accept: 'application/json' } }).catch(() => undefined);
	if (!response?.ok) return readEverywhere();
	const copy = (await response.json()) as AccountCopy;
	if (!copy.on || !copy.settings || !copy.theme) {
		remember({ on: false, updatedAt: undefined });
		return readEverywhere();
	}
	const known = readEverywhere();
	if (copy.updatedAt !== known.updatedAt) {
		applying = true;
		try {
			saveSettings(copy.settings);
			saveTheme(copy.theme);
		} finally {
			applying = false;
		}
	}
	remember({ on: true, updatedAt: copy.updatedAt });
	return readEverywhere();
}

/**
 * Starts following changes on a signed-in page: checks the account's copy,
 * then sends each change made here, a moment after the last one, so a
 * slider dragged across sizes sends once. Returns a function that stops.
 */
export function followSettingsEverywhere(): () => void {
	void checkAccountCopy();
	const onSaved = () => {
		if (applying || !readEverywhere().on) return;
		clearTimeout(sendTimer);
		sendTimer = setTimeout(() => void send(), 800);
	};
	window.addEventListener(settingsSavedEvent, onSaved);
	return () => window.removeEventListener(settingsSavedEvent, onSaved);
}
