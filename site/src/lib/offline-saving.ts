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
import type { DocumentSet, DocumentsStatus } from './offline-documents.ts';

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

/** Asks the worker; the answer is the status, or nothing when the worker says it has resumed saving. */
function ask(request: WorkerRequest, onProgress?: (progress: Progress) => void): Promise<OfflineStatus | undefined> {
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
				else if (reply.type === 'resumed') resolve(undefined);
				else reject(new Error(reply.type === 'failed' ? reply.message : 'unexpected-reply'));
			}
		};
		worker.postMessage(request, [channel.port2]);
	});
}

async function askStatus(request: WorkerRequest, onProgress?: (progress: Progress) => void): Promise<OfflineStatus> {
	const status = await ask(request, onProgress);
	if (!status) throw new Error('unexpected-reply');
	return status;
}

export function offlineStatus(): Promise<OfflineStatus> {
	return askStatus({ type: 'offline-status' });
}

export function saveCollection(
	collection: CollectionIdentifier,
	onProgress?: (progress: Progress) => void
): Promise<OfflineStatus> {
	return askStatus({ type: 'offline-save', collection }, onProgress);
}

export function removeCollection(collection: CollectionIdentifier): Promise<OfflineStatus> {
	return askStatus({ type: 'offline-remove', collection });
}

/**
 * Saves the kept collections from this build: after an update, or after an interrupted save. Asked on every visit, so the worker answers without the status, which would read the list of every built page (src/service-worker/index.ts); a worker from an earlier build answers with it.
 */
export async function resumeSaving(onProgress?: (progress: Progress) => void): Promise<void> {
	await ask({ type: 'offline-resume' }, onProgress);
}

export interface DocumentsProgress {
	set: DocumentSet;
	done: number;
	total: number;
}

function askDocuments(
	request: WorkerRequest,
	onProgress?: (progress: DocumentsProgress) => void
): Promise<DocumentsStatus> {
	const worker = controllingWorker();
	if (!worker) return Promise.reject(new Error('no-worker'));
	return new Promise((resolve, reject) => {
		const channel = new MessageChannel();
		channel.port1.onmessage = (event: MessageEvent<WorkerReply>) => {
			const reply = event.data;
			if (reply.type === 'documents-progress') onProgress?.(reply);
			else if (reply.type === 'documents') {
				channel.port1.close();
				resolve(reply.status);
			} else if (reply.type === 'failed') {
				channel.port1.close();
				reject(new Error(reply.message));
			}
		};
		worker.postMessage(request, [channel.port2]);
	});
}

/** What is saved of these sets of copies, and of every set the reader keeps. */
export function documentsStatus(sets: DocumentSet[] = []): Promise<DocumentsStatus> {
	return askDocuments({ type: 'documents-status', sets });
}

export function saveDocuments(
	set: DocumentSet,
	onProgress?: (progress: DocumentsProgress) => void
): Promise<DocumentsStatus> {
	return askDocuments({ type: 'documents-save', set }, onProgress);
}

export function removeDocuments(set: DocumentSet): Promise<DocumentsStatus> {
	return askDocuments({ type: 'documents-remove', set });
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
