/**
 * Saves the editor's text as a new version (contribute access or above).
 * Saved versions never change, so naming the text as it stands ("Name this
 * version") saves it again as a new version with that note.
 * Answers 409 with the newest version's number and text when someone saved
 * after the writer started, so the editor can show both.
 */
import { error, json } from '@sveltejs/kit';
import { SaveConflict, latestVersion, readVersionText, saveVersion } from '#lib/server/essays.ts';
import { essayAccess } from '#lib/server/essay-workspace.ts';
import { notifyLiveRoom } from '#lib/server/live-editing.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const POST: RequestHandler = async (event) => {
	const { identifier, database, bucket, person } = await essayAccess(event, 'contribute', { forData: true });
	const body = (await event.request.json().catch(() => null)) as { text?: unknown; basedOn?: unknown; note?: unknown; name?: unknown } | null;
	if (!body || typeof body.text !== 'string') error(400, 'Send the text to save.');
	const basedOn = typeof body.basedOn === 'number' ? body.basedOn : null;
	const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 500) : null;
	try {
		const saved = await saveVersion(database, bucket, {
			identifier,
			text: body.text,
			basedOn,
			personIdentifier: person.identifier,
			origin: 'editor',
			note,
			evenIfUnchanged: body.name === true && note !== null
		});
		// A version saved here (a named version) reaches people editing live at once.
		if (!saved.unchanged) await notifyLiveRoom(identifier);
		return json({ number: saved.version.number, unchanged: saved.unchanged, title: saved.version.title });
	} catch (problem) {
		if (problem instanceof SaveConflict) {
			const latest = await latestVersion(database, identifier);
			return json(
				{
					problem: problem.message,
					latest: latest?.number ?? null,
					latestText: latest ? await readVersionText(bucket, latest) : ''
				},
				{ status: 409 }
			);
		}
		if (problem instanceof Error && /too long|essay id/.test(problem.message)) error(400, problem.message);
		throw problem;
	}
};
