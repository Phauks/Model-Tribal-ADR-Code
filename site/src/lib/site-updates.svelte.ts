/**
 * Updates for readers who keep the site on their device (site/DESIGN.md,
 * section 10, "Updates"). The sequence:
 *
 * 1. Detect. The browser checks the service worker script on every
 *    navigation, and SvelteKit checks the build version when the tab
 *    regains focus and on data responses (updated.current). When SvelteKit
 *    sees a new build, the page asks the browser to check the worker now.
 * 2. Install. The new worker saves the new build's scripts and core pages in
 *    its own cache, then waits. The reader keeps reading the old edition.
 * 3. Ask. The page fetches /edition.json from the network and shows what the
 *    update brings, with "Update now", "What changed" and "Later".
 * 4. Apply. "Update now" tells the waiting worker to take over; the page
 *    reloads once it does. "Later" hides the notice for this visit; the
 *    browser applies the update on its own once every tab of the site has
 *    been closed.
 * 5. Save again. On the first page load under the new worker, the page asks
 *    it to save the collections the reader keeps, from the new build.
 */
import { updated } from '$app/state';
import { controllingWorker, resumeSaving, type Progress } from './offline-saving.ts';

export interface Edition {
	build: string;
	content: string;
	site: string;
	print: string;
}

const dismissedKey = 'update-dismissed';

class SiteUpdates {
	/** A new version is installed and waiting for the reader. */
	waiting = $state(false);
	/** What the waiting update brings, when it could be read. */
	available = $state<Edition | undefined>();
	/** The reader chose "Later" during this visit. */
	dismissed = $state(false);
	checking = $state(false);
	lastChecked = $state<Date | undefined>();
	/** Progress while kept collections are saved again from the new build. */
	resaving = $state<Progress | undefined>();

	#registration: ServiceWorkerRegistration | undefined;
	#reloadWhenReplaced = false;
	#started = false;

	/** Called once, when the first page has loaded in the browser. */
	async start(): Promise<void> {
		if (this.#started || !('serviceWorker' in navigator)) return;
		this.#started = true;
		try {
			this.dismissed = sessionStorage.getItem(dismissedKey) === 'yes';
		} catch {
			// Storage blocked: the notice shows again on each page.
		}
		navigator.serviceWorker.addEventListener('controllerchange', () => {
			if (this.#reloadWhenReplaced) location.reload();
		});
		const registration = await navigator.serviceWorker.ready;
		this.#registration = registration;
		if (registration.waiting && controllingWorker()) void this.#found();
		registration.addEventListener('updatefound', () => this.#watch(registration.installing));
		if (navigator.onLine && controllingWorker()) void this.#resume();
	}

	#watch(worker: ServiceWorker | null): void {
		worker?.addEventListener('statechange', () => {
			// A worker installed while another controls the page is an update.
			if (worker.state === 'installed' && controllingWorker()) void this.#found();
		});
	}

	async #found(): Promise<void> {
		this.waiting = true;
		try {
			const response = await fetch('/edition.json', { cache: 'no-store' });
			if (response.ok) this.available = (await response.json()) as Edition;
		} catch {
			// Offline again: the notice still offers the update, without version numbers.
		}
	}

	async #resume(): Promise<void> {
		try {
			await resumeSaving((progress) => {
				this.resaving = progress.done < progress.total ? progress : undefined;
			});
		} catch {
			// Offline, or a save was cut short: it continues on a later visit.
		} finally {
			this.resaving = undefined;
		}
	}

	/** Called when SvelteKit has seen a new build: have the browser fetch the new worker now. */
	newBuildSeen(): void {
		void this.#registration?.update().catch(() => undefined);
	}

	async check(): Promise<void> {
		if (this.checking) return;
		this.checking = true;
		try {
			await updated.check();
			const registration = this.#registration ?? (await navigator.serviceWorker?.getRegistration());
			await registration?.update();
			if (registration?.installing) this.#watch(registration.installing);
			if (registration?.waiting && controllingWorker()) await this.#found();
		} catch {
			// Offline: nothing to check against.
		} finally {
			this.lastChecked = new Date();
			this.checking = false;
		}
	}

	apply(): void {
		const waiting = this.#registration?.waiting;
		if (!waiting) {
			location.reload();
			return;
		}
		this.#reloadWhenReplaced = true;
		waiting.postMessage({ type: 'skip-waiting' });
	}

	later(): void {
		this.dismissed = true;
		try {
			sessionStorage.setItem(dismissedKey, 'yes');
		} catch {
			// Storage blocked: hidden until the next page load only.
		}
	}
}

export const siteUpdates = new SiteUpdates();
