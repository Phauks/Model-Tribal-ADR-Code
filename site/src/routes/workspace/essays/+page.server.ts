import { fail, redirect } from '@sveltejs/kit';
import { atLeast } from '#lib/permissions.ts';
import { requireDocumentLevel } from '#lib/server/access.ts';
import { essayDateTime } from '#lib/essays/dates.ts';
import {
	SaveConflict,
	essayParts,
	essayPartLabels,
	essayPath,
	isEssayIdentifier,
	latestVersion,
	listEssays,
	saveVersion,
	type EssayPart
} from '#lib/server/essays.ts';
import { canStartEssays, gitText, levelOn } from '#lib/server/essay-workspace.ts';
import { syncEssaysFromGitOnce } from '#lib/server/essay-git-sync.ts';
import { formText, requirePerson, storage } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const person = requirePerson(event);
	const { database, bucket } = storage(event);
	// Text merged in git is saved here by itself (src/lib/server/essay-git-sync.ts);
	// only paragraphs changed both here and in git wait for a person.
	const outcomes = await syncEssaysFromGitOnce(database, bucket, true);
	const summaries = await listEssays(database);
	const levels = new Map(
		await Promise.all(summaries.map(async (summary) => [summary.identifier, await levelOn(database, person, summary.identifier)] as const))
	);
	const canStart = await canStartEssays(database, person);
	const gitConflicts = [];
	for (const outcome of outcomes) {
		if (outcome.state !== 'conflict') continue;
		const level = levels.get(outcome.identifier) ?? (await levelOn(database, person, outcome.identifier));
		if (atLeast(level, 'full')) gitConflicts.push({ identifier: outcome.identifier, conflicts: outcome.conflicts, latestVersion: outcome.latestVersion });
	}
	const fromGit = outcomes.flatMap((outcome) =>
		(outcome.state === 'saved' || outcome.state === 'merged') && atLeast(levels.get(outcome.identifier) ?? 'no-access', 'comment')
			? [{ identifier: outcome.identifier, version: outcome.version, merged: outcome.state === 'merged' }]
			: []
	);
	return {
		essays: summaries
			.filter((summary) => atLeast(levels.get(summary.identifier) ?? 'no-access', 'comment'))
			.map((summary) => ({
				identifier: summary.identifier,
				title: summary.title,
				part: essayPartLabels[summary.part],
				level: levels.get(summary.identifier)!,
				latestVersion: summary.latestVersion,
				latestSavedAt: summary.latestSavedAt ? essayDateTime(summary.latestSavedAt) : null,
				published: summary.published
					? { versionNumber: summary.published.versionNumber, at: essayDateTime(summary.published.publishedAt), link: essayPath(summary.identifier, summary.part) }
					: null
			})),
		gitConflicts,
		fromGit,
		canStart,
		parts: essayParts.map((part) => ({ value: part, label: essayPartLabels[part] }))
	};
};

export const actions: Actions = {
	bringIn: async (event) => {
		const person = requirePerson(event);
		const { database, bucket } = storage(event);
		const form = await event.request.formData();
		const identifier = formText(form, 'essay') ?? '';
		const text = gitText(identifier);
		if (!text) return fail(400, { problem: 'Git has no essay with this id.' });
		await requireDocumentLevel(event, database, { kind: 'essay', identifier }, 'full');
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
			return {
				done: saved.unchanged
					? `${identifier} is already the same as git.`
					: `Saved the git text of ${identifier} as version ${saved.version.number}. Version ${latest?.number} stays in its history.`
			};
		} catch (problem) {
			if (problem instanceof SaveConflict) return fail(409, { problem: problem.message });
			throw problem;
		}
	},

	start: async (event) => {
		const person = requirePerson(event);
		const { database, bucket } = storage(event);
		if (!(await canStartEssays(database, person))) {
			event.locals.refused = 'needs full access to every essay to start one';
			return fail(403, { problem: 'Only someone with full access to every essay can start a new one.' });
		}
		const form = await event.request.formData();
		const title = formText(form, 'title', 300);
		const part = formText(form, 'part') as EssayPart | null;
		const identifier = (formText(form, 'identifier', 120) ?? '').toLowerCase();
		if (!title) return fail(400, { problem: 'Give the essay a title.' });
		if (!part || !essayParts.includes(part)) return fail(400, { problem: 'Choose where the essay goes.' });
		const fullIdentifier = part === 'foundations' && !identifier.startsWith('i-') ? `i-${identifier}` : identifier;
		if (!isEssayIdentifier(fullIdentifier)) {
			return fail(400, { problem: 'The address uses lower-case letters, numbers and hyphens, such as "why-consent-matters".' });
		}
		if (await latestVersion(database, fullIdentifier)) return fail(400, { problem: 'An essay with this address exists already.' });
		const frontMatter = [`title: ${JSON.stringify(title)}`, part === 'foundations' ? 'part: i' : '', 'status: draft'].filter(Boolean).join('\n');
		await saveVersion(database, bucket, {
			identifier: fullIdentifier,
			text: `---\n${frontMatter}\n---\n\n# ${title}\n\n`,
			basedOn: null,
			personIdentifier: person.identifier,
			origin: 'editor',
			part,
			note: 'Started'
		});
		redirect(303, `/workspace/essays/${fullIdentifier}/edit`);
	}
};
