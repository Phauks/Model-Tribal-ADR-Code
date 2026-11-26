import { fail } from '@sveltejs/kit';
import { atLeast, siteTextSubject } from '#lib/permissions.ts';
import { requireDocumentLevel } from '#lib/server/access.ts';
import { afterResponse, workerEnvironment } from '#lib/server/environment.ts';
import {
	drafts,
	latestPublication,
	latestRebuild,
	pieceStates,
	publications,
	publish,
	requestRebuild,
	saveVersion,
	undoLatestPublication
} from '#lib/server/site-text.ts';
import { builtPublication, catalogByKey, catalogEntries } from '#lib/server/site-text-catalog.ts';
import { entryPlace, siteTextPlace } from '#lib/site-text.ts';
import { formText, requirePerson, storage } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad } from './$types';

// The site's own wording (docs/site-text.md): drafts waiting to be published,
// past publications, and every piece of fixed text to search.
export const prerender = false;

const shownAtOnce = 200;
const filters = ['all', 'edited', 'drafts', 'gone'] as const;
type Filter = (typeof filters)[number];

export const load: PageServerLoad = async (event) => {
	requirePerson(event);
	const { database } = storage(event);
	const access = await requireDocumentLevel(event, database, siteTextSubject, 'comment');
	const catalog = catalogByKey();
	const [states, waiting, recent, latest, rebuild] = await Promise.all([
		pieceStates(database),
		drafts(database),
		publications(database, 20),
		latestPublication(database),
		latestRebuild(database)
	]);

	const query = (event.url.searchParams.get('q') ?? '').trim().toLocaleLowerCase('en-US');
	const requested = event.url.searchParams.get('show') as Filter | null;
	const filter: Filter = requested && filters.includes(requested) ? requested : 'all';

	const rows = [
		...catalogEntries().map((entry) => {
			const state = states.get(entry.key);
			return {
				key: entry.key,
				words: state?.published ?? entry.words,
				builtIn: entry.words,
				place: entryPlace(entry),
				attribute: entry.attribute ?? null,
				edited: state?.published != null,
				draft: state?.draft ? (state.draft.words ?? entry.words) : null,
				gone: false
			};
		}),
		// Published or drafted pieces whose words the code no longer has.
		...[...states.values()]
			.filter((state) => !catalog.has(state.key))
			.map((state) => ({
				key: state.key,
				words: state.published ?? state.draft?.words ?? state.draft?.builtInWords ?? '',
				builtIn: state.draft?.builtInWords ?? '',
				place: state.draft ? siteTextPlace(state.draft.sourceFile) : '',
				attribute: null,
				edited: state.published !== null,
				draft: state.draft?.words ?? null,
				gone: true
			}))
	];
	const matching = rows.filter((row) => {
		if (filter === 'edited' && !row.edited) return false;
		if (filter === 'drafts' && row.draft === null) return false;
		if (filter === 'gone' && !row.gone) return false;
		if (filter !== 'gone' && row.gone && filter !== 'all') return false;
		if (!query) return true;
		return [row.words, row.builtIn, row.place, row.draft ?? ''].some((text) => text.toLocaleLowerCase('en-US').includes(query));
	});

	return {
		level: access.level,
		canPublish: atLeast(access.level, 'full'),
		canEdit: atLeast(access.level, 'contribute'),
		query,
		filter,
		total: matching.length,
		rows: matching.slice(0, shownAtOnce),
		drafts: waiting.map((state) => {
			const entry = catalog.get(state.key);
			const builtIn = entry?.words ?? state.draft?.builtInWords ?? '';
			return {
				key: state.key,
				place: entry ? entryPlace(entry) : siteTextPlace(state.draft?.sourceFile ?? ''),
				page: state.draft?.page ?? null,
				before: state.published ?? builtIn,
				after: state.draft?.words ?? builtIn,
				personName: state.draft?.personName ?? null,
				createdAt: state.draft?.createdAt ?? ''
			};
		}),
		publications: recent,
		latest,
		built: builtPublication,
		rebuild,
		hook: Boolean(workerEnvironment().SITE_REBUILD_HOOK_URL)
	};
};

export const actions: Actions = {
	publish: async (event) => {
		const person = requirePerson(event);
		const { database } = storage(event);
		await requireDocumentLevel(event, database, siteTextSubject, 'full');
		const form = await event.request.formData();
		const keys = form.getAll('key').filter((key): key is string => typeof key === 'string');
		const number = await publish(database, person.identifier, keys.length > 0 ? keys : undefined);
		if (number === null) return fail(400, { problem: 'There is nothing to publish.' });
		afterResponse(requestRebuild(database, workerEnvironment().SITE_REBUILD_HOOK_URL, number, 'published'));
		return { published: number };
	},
	discard: async (event) => {
		const person = requirePerson(event);
		const { database } = storage(event);
		await requireDocumentLevel(event, database, siteTextSubject, 'contribute');
		const form = await event.request.formData();
		const entry = catalogByKey().get(formText(form, 'key', 20) ?? '');
		if (!entry) return fail(409, { problem: 'This text is no longer on the site, so its draft stays in its history.' });
		const state = (await pieceStates(database)).get(entry.key);
		if (!state?.draft) return fail(400, { problem: 'There is no draft to discard.' });
		await saveVersion(database, { entry, words: state.published, page: null, personIdentifier: person.identifier });
		return { discarded: entry.key };
	},
	undo: async (event) => {
		const person = requirePerson(event);
		const { database } = storage(event);
		await requireDocumentLevel(event, database, siteTextSubject, 'full');
		const form = await event.request.formData();
		const expected = Number(formText(form, 'publication', 12));
		if (expected !== (await latestPublication(database))) {
			return fail(409, { problem: 'Someone published since this page opened. Reload it and try again.' });
		}
		const number = await undoLatestPublication(database, person.identifier, catalogByKey());
		if (number === null) return fail(400, { problem: 'Nothing has been published.' });
		afterResponse(requestRebuild(database, workerEnvironment().SITE_REBUILD_HOOK_URL, number, 'published'));
		return { published: number };
	}
};

