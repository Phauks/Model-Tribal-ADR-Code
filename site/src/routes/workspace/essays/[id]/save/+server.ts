/**
 * Saves the editor's text as a new version (contribute access or above).
 * Saving the same text again with a note names the newest version instead.
 * Answers 409 with the newest version's number and text when someone saved
 * after the writer started, so the editor can show both.
 */
import { error, json } from '@sveltejs/kit';
import { SaveConflict, latestVersion, nameVersion, readVersionText, saveVersion } from '#lib/server/essays.ts';
import { essayAccess } from '#lib/server/essay-workspace.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const POST: RequestHandler = async (event) => {
	const { identifier, database, bucket, person } = await essayAccess(event, 'contribute');
	const body = (await event.request.json().catch(() => null)) as { text?: unknown; basedOn?: unknown; note?: unknown } | null;
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
			note
		});
		// Naming the version just saved: the text is the same, so the note goes on it.
		if (saved.unchanged && note && note !== saved.version.note) await nameVersion(database, identifier, saved.version.number, note);
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
