/**
 * The pages a story's method and topic badges open: every story tagged with
 * that method or topic, and for a method, the provisions in nations' laws
 * that use it (Trevor, Nov. 23, 2026).
 */
import { error } from '@sveltejs/kit';
import { recourseLink } from '../recourse.ts';
import { recourseMethodLabel, recourseRows } from './recourse.ts';
import { storyTags, type StoryTagKind } from './stories.ts';

export function storyTagEntries(kind: StoryTagKind): string[] {
	return storyTags(kind).map((tag) => tag.id);
}

export function storyTagPage(kind: StoryTagKind, id: string) {
	const tag = storyTags(kind).find((candidate) => candidate.id === id);
	if (!tag) error(404, `No story has this ${kind === 'methods' ? 'method' : 'topic'}.`);
	let provisions: { count: number; link: string } | undefined;
	if (kind === 'methods') {
		const label = recourseMethodLabel(id);
		const count = recourseRows().filter((row) => row.method === label).length;
		if (count > 0) provisions = { count, link: recourseLink('method', label) };
	}
	return { kind, tag, provisions };
}
