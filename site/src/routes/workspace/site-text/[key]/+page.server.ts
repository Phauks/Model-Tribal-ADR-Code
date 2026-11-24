import { error, fail } from '@sveltejs/kit';
import { atLeast, siteTextSubject } from '#lib/permissions.ts';
import { requireDocumentLevel } from '#lib/server/access.ts';
import { history, pieceStates, saveVersion, SiteTextProblem } from '#lib/server/site-text.ts';
import { catalogByKey } from '#lib/server/site-text-catalog.ts';
import { siteTextPlace } from '#lib/site-text.ts';
import { formText, requirePerson, storage } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad } from './$types';

// One piece of site text: its built-in words, what is published, a draft,
// and every version (docs/site-text.md).
export const prerender = false;

export const load: PageServerLoad = async (event) => {
	requirePerson(event);
	const { database } = storage(event);
	const access = await requireDocumentLevel(event, database, siteTextSubject, 'comment');
	const key = event.params.key;
	const entry = catalogByKey().get(key);
	const versions = await history(database, key);
	if (!entry && versions.length === 0) error(404, 'There is no such piece of site text.');
	const state = (await pieceStates(database)).get(key);
	const builtIn = entry?.words ?? versions[0]?.builtInWords ?? '';
	return {
		key,
		builtIn,
		place: siteTextPlace(entry?.file ?? versions[0]?.sourceFile ?? ''),
		file: entry ? `${entry.file}, line ${entry.line}` : null,
		attribute: entry?.attribute ?? null,
		gone: !entry,
		published: state?.published ?? null,
		draft: state?.draft ? (state.draft.words ?? builtIn) : null,
		versions,
		canEdit: atLeast(access.level, 'contribute') && Boolean(entry)
	};
};

export const actions: Actions = {
	save: async (event) => {
		const person = requirePerson(event);
		const { database } = storage(event);
		await requireDocumentLevel(event, database, siteTextSubject, 'contribute');
		const entry = catalogByKey().get(event.params.key);
		if (!entry) return fail(409, { problem: 'This text is no longer on the site.' });
		const form = await event.request.formData();
		const reset = formText(form, 'reset', 5) === 'yes';
		try {
			await saveVersion(database, { entry, words: reset ? null : (formText(form, 'words', 4000) ?? ''), page: null, personIdentifier: person.identifier });
		} catch (problem) {
			if (problem instanceof SiteTextProblem) return fail(problem.status, { problem: problem.message });
			throw problem;
		}
		return { saved: true };
	}
};
