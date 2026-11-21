/**
 * The page's side of offline saving (site/DESIGN.md, section 10): asks the
 * service worker what is saved, to save or remove a collection, and to save
 * the kept collections again after an update. Each request gets its own
 * message channel, so progress and the final status come back to the caller.
 */
import type {
	CollectionIdentifier,
	OfflineStatus,
	WorkerReply,
	WorkerRequest
} from './offline-collections.ts';

export interface Progress {
	collection: CollectionIdentifier;
	done: number;
	total: number;
}

/** The worker controlling this page, if any (none on the first visit, or in development). */
export function controllingWorker(): ServiceWorker | null {
	if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
	return navigator.serviceWorker.controller;
}

function ask(request: WorkerRequest, onProgress?: (progress: Progress) => void): Promise<OfflineStatus> {
	const worker = controllingWorker();
	if (!worker) return Promise.reject(new Error('no-worker'));
	return new Promise((resolve, reject) => {
		const channel = new MessageChannel();
		channel.port1.onmessage = (event: MessageEvent<WorkerReply>) => {
			const reply = event.data;
			if (reply.type === 'progress') onProgress?.(reply);
			else {
				channel.port1.close();
				if (reply.type === 'status') resolve(reply.status);
				else reject(new Error(reply.message));
			}
		};
		worker.postMessage(request, [channel.port2]);
	});
}

export function offlineStatus(): Promise<OfflineStatus> {
	return ask({ type: 'offline-status' });
}

export function saveCollection(
	collection: CollectionIdentifier,
	onProgress?: (progress: Progress) => void
): Promise<OfflineStatus> {
	return ask({ type: 'offline-save', collection }, onProgress);
}

export function removeCollection(collection: CollectionIdentifier): Promise<OfflineStatus> {
	return ask({ type: 'offline-remove', collection });
}

/** Saves the kept collections from this build: after an update, or after an interrupted save. */
export function resumeSaving(onProgress?: (progress: Progress) => void): Promise<OfflineStatus> {
	return ask({ type: 'offline-resume' }, onProgress);
}

export interface StorageUse {
	usedBytes?: number;
	/** Whether the browser has agreed not to clear the site's storage when space runs low. */
	persisted?: boolean;
}

export async function storageUse(): Promise<StorageUse> {
	if (typeof navigator === 'undefined' || !navigator.storage) return {};
	const [estimate, persisted] = await Promise.all([
		navigator.storage.estimate?.().catch(() => undefined),
		navigator.storage.persisted?.().catch(() => undefined)
	]);
	return { usedBytes: estimate?.usage, persisted };
}

/** Asks the browser to keep saved pages when space runs low. Some browsers decide on their own. */
export async function askToKeepStorage(): Promise<boolean> {
	if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
	return navigator.storage.persist().catch(() => false);
}
