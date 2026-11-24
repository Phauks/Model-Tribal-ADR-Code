import { fail } from '@sveltejs/kit';
import { formText, requirePermission, storage } from '#lib/server/workspace.ts';
import { readCaptureLink, readWaybackMarks, readWaybackProgress, saveItYourselfLink, setWaybackMark, type MarkKind } from '#lib/server/wayback.ts';
import type { Actions, PageServerLoad } from './$types';

// Links the Wayback Worker could not save (site/WAYBACK.md, "Links that
// fail"): open each one, save it from your own browser, mark what happened, or
// send a copy of the file.
export const prerender = false;

const mostTries = 3;
const kinds: MarkKind[] = ['saved-by-hand', 'failed-by-hand', 'file-sent'];

export const load: PageServerLoad = async (event) => {
	requirePermission(event, 'check-services');
	const { bucket } = storage(event);
	const [progress, marks] = await Promise.all([readWaybackProgress(bucket), readWaybackMarks(bucket)]);
	const rows = Object.entries(progress?.records ?? {})
		.filter(([key, entry]) => (!entry.capture && entry.problem) || marks[key])
		.map(([key, entry]) => ({
			key,
			link: entry.link,
			saveLink: saveItYourselfLink(entry.link),
			uploadLink: `/uploads/send?${new URLSearchParams({ description: `A copy of ${entry.link} for source record ${key}`, published: entry.link })}`,
			problem: entry.problem ?? null,
			tries: entry.tries ?? 0,
			gaveUp: (entry.tries ?? 0) >= mostTries,
			failedAt: entry.failed ?? null,
			mark: marks[key] ?? null
		}))
		.sort((a, b) => (b.failedAt ?? '').localeCompare(a.failedAt ?? ''));
	return { connected: progress !== null, lastRun: progress?.lastRun ?? null, rows, mostTries };
};

export const actions: Actions = {
	mark: async (event) => {
		const person = requirePermission(event, 'check-services');
		const { bucket } = storage(event);
		const form = await event.request.formData();
		const key = formText(form, 'key', 300);
		const kind = formText(form, 'kind', 40) as MarkKind | null;
		const progress = await readWaybackProgress(bucket);
		const entry = key ? progress?.records[key] : undefined;
		if (!key || !entry || !kind || !kinds.includes(kind)) return fail(400, { key, problem: 'That link is not on the Worker’s list.' });
		let capture;
		if (kind === 'saved-by-hand') {
			const read = readCaptureLink(formText(form, 'capture', 2000) ?? '', entry.link);
			if ('problem' in read) return fail(400, { key, problem: read.problem });
			capture = read.capture;
		}
		await setWaybackMark(bucket, key, { kind, at: new Date().toISOString(), by: person.displayName || person.email, link: entry.link, capture });
		return { key, done: true };
	},
	clear: async (event) => {
		requirePermission(event, 'check-services');
		const { bucket } = storage(event);
		const key = formText(await event.request.formData(), 'key', 300);
		if (!key) return fail(400, { key, problem: 'Choose a link.' });
		await setWaybackMark(bucket, key, null);
		return { key, done: true };
	}
};
