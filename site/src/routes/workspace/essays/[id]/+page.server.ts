import { error, fail } from '@sveltejs/kit';
import { atLeast } from '#lib/permissions.ts';
import { essayDateTime } from '#lib/essays/dates.ts';
import {
	SaveConflict,
	essayPath,
	essayRow,
	latestVersion,
	publications,
	publishVersion,
	readVersionText,
	saveVersion,
	setPublicationListed,
	version,
	versions
} from '#lib/server/essays.ts';
import { essayAccess, gitText } from '#lib/server/essay-workspace.ts';
import { syncEssaysFromGitOnce } from '#lib/server/essay-git-sync.ts';
import { renderedVersion } from '#lib/server/essay-pages.ts';
import { formText } from '#lib/server/workspace.ts';
import { checkNow } from '#lib/server/following-run.ts';
import type { Actions, PageServerLoad } from './$types';
import { notifyLiveRoom } from '#lib/server/live-editing.ts';

export const load: PageServerLoad = async (event) => {
	const { identifier, database, bucket, level } = await essayAccess(event, 'comment');
	// Paragraphs git changed that were also edited here wait on this page (the essay page's red label links here).
	const outcome = (await syncEssaysFromGitOnce(database, bucket)).find((candidate) => candidate.identifier === identifier);
	const essay = await essayRow(database, identifier);
	if (!essay) error(404, 'No essay has this address yet.');
	const saved = await versions(database, identifier);
	const published = await publications(database, identifier, false);
	return {
		identifier,
		level,
		canPublish: atLeast(level, 'full'),
		canEdit: atLeast(level, 'contribute'),
		title: saved[0]?.title ?? identifier,
		page: essayPath(identifier, essay.part),
		gitConflict: outcome?.state === 'conflict' ? { conflicts: outcome.conflicts, latestVersion: outcome.latestVersion } : null,
		versions: saved.map((row) => ({
			number: row.number,
			title: row.title,
			note: row.note,
			origin: row.origin,
			basedOn: row.based_on,
			by: row.person_name ?? 'Someone',
			at: essayDateTime(row.created_at),
			bytes: row.bytes,
			published: published.filter((publication) => publication.version_number === row.number).map((publication) => publication.number)
		})),
		publications: published.map((row) => ({
			number: row.number,
			versionNumber: row.version_number,
			listed: row.listed === 1,
			by: row.person_name ?? 'Someone',
			at: essayDateTime(row.published_at)
		}))
	};
};

function versionNumber(form: FormData): number | null {
	const number = Number(formText(form, 'version'));
	return Number.isInteger(number) && number > 0 ? number : null;
}

export const actions: Actions = {
	// Saves the git text as a new version, over paragraphs also edited here (moved from Workspace › Essays, now removed).
	bringIn: async (event) => {
		const { identifier, database, bucket, person } = await essayAccess(event, 'full');
		const text = gitText(identifier);
		if (!text) return fail(400, { problem: 'Git has no essay with this id.' });
		const latest = await latestVersion(database, identifier);
		try {
			const saved = await saveVersion(database, bucket, {
				identifier,
				text,
				basedOn: latest?.number ?? null,
				personIdentifier: person.identifier,
				origin: 'git',
				note: 'From git, chosen over the edits made here'
			});
			if (!saved.unchanged) await notifyLiveRoom(identifier);
			return {
				done: saved.unchanged
					? 'The text is already the same as git.'
					: `Saved the git text as version ${saved.version.number}. Version ${latest?.number} stays in the history.`
			};
		} catch (problem) {
			if (problem instanceof SaveConflict) return fail(409, { problem: problem.message });
			throw problem;
		}
	},
	publish: async (event) => {
		const { identifier, database, bucket, person } = await essayAccess(event, 'full');
		const form = await event.request.formData();
		const number = versionNumber(form);
		const row = number === null ? null : await version(database, identifier, number);
		if (!row) return fail(400, { problem: 'Choose a saved version to publish.' });
		// The same checks the print build makes: every citation and glossary link must point to a record.
		const rendered = await renderedVersion(bucket, row, 'saved');
		if (rendered.problems.length > 0) {
			return fail(400, { problem: `Version ${number} cannot be published yet: ${rendered.problems.join(' ')}` });
		}
		const publication = await publishVersion(database, identifier, row.number, person.identifier);
		// Tell readers who follow the essay (src/lib/server/following-run.ts).
		await checkNow(database);
		return { done: `Published version ${row.number} (publication ${publication}). The page shows it now.` };
	},

	restore: async (event) => {
		const { identifier, database, bucket, person } = await essayAccess(event, 'full');
		const form = await event.request.formData();
		const number = versionNumber(form);
		const row = number === null ? null : await version(database, identifier, number);
		if (!row) return fail(400, { problem: 'Choose a saved version to restore.' });
		const latest = await latestVersion(database, identifier);
		try {
			const saved = await saveVersion(database, bucket, {
				identifier,
				text: await readVersionText(bucket, row),
				basedOn: latest?.number ?? null,
				personIdentifier: person.identifier,
				origin: 'restore',
				note: `Restored from version ${row.number}`
			});
			if (!saved.unchanged) await notifyLiveRoom(identifier);
			return { done: saved.unchanged ? `Version ${row.number} is the same as the newest version.` : `Saved version ${row.number}'s text as version ${saved.version.number}.` };
		} catch (problem) {
			if (problem instanceof SaveConflict) return fail(409, { problem: problem.message });
			throw problem;
		}
	},

	holdBack: async (event) => {
		const { identifier, database, person } = await essayAccess(event, 'full');
		const form = await event.request.formData();
		const number = Number(formText(form, 'publication'));
		const listed = formText(form, 'listed') === 'yes';
		if (!Number.isInteger(number) || number < 1) return fail(400, { problem: 'Choose a publication.' });
		const reason = formText(form, 'reason', 500);
		if (!listed && !reason) return fail(400, { problem: 'Say why the publication is held back, for the activity log.' });
		await setPublicationListed(database, identifier, number, listed, person.identifier, reason);
		await checkNow(database);
		return { done: listed ? `Publication ${number} is listed again.` : `Publication ${number} is held back from readers.` };
	}
};
