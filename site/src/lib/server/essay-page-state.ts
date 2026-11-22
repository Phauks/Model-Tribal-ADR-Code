/**
 * What an essay page shows a person with access to the essay, on top of the
 * published text every reader sees (Trevor, 2026-11-22: edit and review in
 * place, with status shown only to people with access). The public page stays
 * the same for everyone and is cached; the page asks for this afterwards,
 * from /workspace/essays/<id>/page, only when the signed-in hint is set.
 *
 * "With drafts" shows the newest saved version, with each block that differs
 * from the published text marked as a draft change or a new block.
 */
import { atLeast, type AccessLevel } from '../permissions.ts';
import { essayDateTime } from '../essays/dates.ts';
import { lineChanges } from '../essays/merge.ts';
import { renderEssay } from '../essays/render.ts';
import { splitFrontMatter } from '../essays/syntax.ts';
import type { SourceEntry } from './source-uses.ts';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types/index.ts';
import { essayLibrary } from './essay-pages.ts';
import { latestVersion, publications, readVersionText, version as versionRow } from './essays.ts';

export interface EssayPageState {
	identifier: string;
	level: AccessLevel;
	canEdit: boolean;
	canPublish: boolean;
	latest: { number: number; savedAtText: string; by: string; note: string | null };
	/** The version readers see, or null when nothing is published. */
	publishedVersion: number | null;
	/** The newest version, marked against the published text, when it differs. */
	draft: { html: string; sources: SourceEntry[]; changed: number; added: number } | null;
	/** The newest version's file, for the editor. */
	text: string;
	/** Paragraphs git changed that were also edited here, not merged yet (essay-git-sync.ts). */
	gitConflicts: number;
}

export async function essayPageState(
	database: D1Database,
	bucket: R2Bucket,
	identifier: string,
	level: AccessLevel,
	gitConflicts = 0
): Promise<EssayPageState | null> {
	const latest = await latestVersion(database, identifier);
	if (!latest) return null;
	const [listed, named, text] = await Promise.all([
		publications(database, identifier, true),
		versionRow(database, identifier, latest.number),
		readVersionText(bucket, latest)
	]);
	const published = listed[0];
	let draft: EssayPageState['draft'] = null;
	if (!published?.sha256 || published.sha256 !== latest.sha256) {
		const before = published?.object_key ? splitFrontMatter(await readVersionText(bucket, { object_key: published.object_key })).body : '';
		const lines = lineChanges(before, splitFrontMatter(text).body);
		const rendered = renderEssay(text, essayLibrary, { lines });
		draft = {
			html: rendered.html,
			sources: rendered.sources,
			changed: rendered.html.split('class="essay-draft-mark essay-draft-changed"').length - 1,
			added: rendered.html.split('class="essay-draft-mark essay-draft-added"').length - 1
		};
	}
	return {
		identifier,
		level,
		canEdit: atLeast(level, 'contribute'),
		canPublish: atLeast(level, 'full'),
		latest: {
			number: latest.number,
			savedAtText: essayDateTime(latest.created_at),
			by: named?.person_name ?? (latest.origin === 'git' ? 'git' : 'someone'),
			note: latest.note
		},
		publishedVersion: published?.version_number ?? null,
		draft,
		text,
		gitConflicts
	};
}
