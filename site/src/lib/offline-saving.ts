/**
 * The page's side of offline saving (site/DESIGN.md, section 10): asks the
 * service worker what is saved, to apply the reader's choices (src/lib/offline-choices.ts),
 * and to save the chosen pages again after an update. Each request gets its own
 * message channel, so progress and the answer come back to the caller.
 */
import type { WorkerReply, WorkerRequest } from './offline-collections.ts';
import type { ChoiceChange, ChoicesStatus, PageChoice } from './offline-choices.ts';
import type { DocumentSet, DocumentsStatus } from './offline-documents.ts';

export interface Progress {
	done: number;
	total: number;
}

/** The worker controlling this page, if any (none on the first visit, or in development). */
export function controllingWorker(): ServiceWorker | null {
	if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
	return navigator.serviceWorker.controller;
}

/** Asks the worker; the first answer that is not progress settles it. */
function ask(request: WorkerRequest, onProgress?: (progress: Progress) => void): Promise<WorkerReply> {
	const worker = controllingWorker();
	if (!worker) return Promise.reject(new Error('no-worker'));
	return new Promise((resolve, reject) => {
		const channel = new MessageChannel();
		channel.port1.onmessage = (event: MessageEvent<WorkerReply>) => {
			const reply = event.data;
			if (reply.type === 'choices-progress') {
				onProgress?.(reply);
				return;
			}
			channel.port1.close();
			if (reply.type === 'failed') reject(new Error(reply.message));
			else resolve(reply);
		};
		worker.postMessage(request, [channel.port2]);
	});
}

async function askStatus(request: WorkerRequest): Promise<ChoicesStatus> {
	const reply = await ask(request);
	if (reply.type !== 'choices') throw new Error('unexpected-reply');
	return reply.status;
}

export function choicesStatus(): Promise<ChoicesStatus> {
	return askStatus({ type: 'choices-status' });
}

/**
 * Applies the reader's ticks. The worker answers at once with what is chosen now; while it saves, progress comes to
 * `onProgress`, and the status once it is done to `onDone`, or a problem to `onFailed`.
 */
export function applyChoices(
	changes: ChoiceChange[],
	callbacks: { onProgress?: (progress: Progress) => void; onDone?: (status: ChoicesStatus) => void; onFailed?: (message: string) => void } = {}
): Promise<ChoicesStatus> {
	const worker = controllingWorker();
	if (!worker) return Promise.reject(new Error('no-worker'));
	return new Promise((resolve, reject) => {
		const channel = new MessageChannel();
		let first = true;
		channel.port1.onmessage = (event: MessageEvent<WorkerReply>) => {
			const reply = event.data;
			if (reply.type === 'choices-progress') callbacks.onProgress?.(reply);
			else if (reply.type === 'choices') {
				if (first) {
					first = false;
					resolve(reply.status);
				} else {
					channel.port1.close();
					callbacks.onDone?.(reply.status);
				}
			} else if (reply.type === 'failed') {
				channel.port1.close();
				if (first) reject(new Error(reply.message));
				else callbacks.onFailed?.(reply.message);
			}
		};
		worker.postMessage({ type: 'choices-apply', changes } satisfies WorkerRequest, [channel.port2]);
	});
}

export function clearReadPages(): Promise<ChoicesStatus> {
	return askStatus({ type: 'choices-clear-read' });
}

/** Forgets every choice and deletes every saved page and copy. */
export async function clearEverything(): Promise<void> {
	await ask({ type: 'choices-clear' });
}

/** Whether the page at this address is chosen and saved. */
export async function pageChoice(path: string): Promise<PageChoice> {
	const reply = await ask({ type: 'page-choice', path });
	if (reply.type !== 'page-choice') throw new Error('unexpected-reply');
	return reply.choice;
}

/**
 * After an update, or after an interrupted save: saves again the saved pages that changed, a few pages new to what the reader chose, and the rest of a save the reader started. Many new pages wait for the reader (src/service-worker/index.ts, automaticTopUp). Asked on every visit, so the worker answers without the status, which reads every list of the catalog.
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
		navigator.storage.estimate?.().catch(() => /* expected: a browser that cannot estimate its storage shows no figure. */ undefined),
		navigator.storage.persisted?.().catch(() => /* expected: a browser that cannot say whether storage is kept shows no figure. */ undefined)
	]);
	return { usedBytes: estimate?.usage, persisted };
}

/** Asks the browser to keep saved pages when space runs low. Some browsers decide on their own. */
export async function askToKeepStorage(): Promise<boolean> {
	if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
	return navigator.storage.persist().catch(() => /* expected: the browser declined; the storage line shows the browser's answer. */ false);
}
