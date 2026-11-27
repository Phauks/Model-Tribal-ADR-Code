/**
 * Sends a figure's file from the essay editor through the shared upload path
 * (docs/uploads.md): start the upload, send it in pieces of at most 10 MB
 * (under the Workers request size limit), then finish it. An essay figure
 * skips the review queue, since publishing the essay is its review, and is
 * filed with the essay at once.
 */
import { figureFileAddress } from './figures.ts';

/** How far a file has got, for the dialog's progress bar. */
export interface SendProgress {
	sentBytes: number;
	totalBytes: number;
}

async function answer<T>(response: Response, fallback: string): Promise<T> {
	const body = (await response.json().catch(() => /* expected: an answer that is not JSON throws below with the fallback message, which the dialog shows. */ null)) as (T & { message?: string }) | null;
	if (!response.ok) throw new Error(body?.message || fallback);
	if (!body) throw new Error(fallback);
	return body;
}

/** Sends a file and answers the address the figure shows it from. */
export async function sendFigureFile(
	file: File,
	essay: string,
	onProgress: (progress: SendProgress) => void,
	signal?: AbortSignal
): Promise<string> {
	const headers = { 'content-type': 'application/json' };
	const started = await answer<{ reference: string; pieceBytes: number; pieceCount: number; received: number[] }>(
		await fetch('/uploads/pieces', {
			method: 'POST',
			headers,
			body: JSON.stringify({ fileName: file.name, sizeBytes: file.size, wayIn: 'essay-figure', essay }),
			signal
		}),
		'The file could not be started. Try again.'
	);
	let sentBytes = 0;
	onProgress({ sentBytes, totalBytes: file.size });
	for (let number = 1; number <= started.pieceCount; number += 1) {
		const piece = file.slice((number - 1) * started.pieceBytes, number * started.pieceBytes);
		// A refused file answers 422 with the reason, such as a file that is not a picture, video or recording.
		const response = await fetch(`/uploads/pieces/${started.reference}/${number}`, { method: 'PUT', body: piece, signal });
		const outcome = (await response.json().catch(() => /* expected: an answer that is not JSON throws below with the fallback message, which the dialog shows. */ null)) as { accepted?: boolean; reason?: string; message?: string } | null;
		if (!response.ok || !outcome?.accepted) {
			throw new Error(outcome?.reason || outcome?.message || 'A piece of the file did not arrive. Try again.');
		}
		sentBytes += piece.size;
		onProgress({ sentBytes, totalBytes: file.size });
	}
	await answer<{ status: string }>(
		await fetch(`/uploads/pieces/${started.reference}/finish`, { method: 'POST', signal }),
		'The file arrived but could not be finished. Try again.'
	);
	return figureFileAddress(started.reference, file.name);
}
