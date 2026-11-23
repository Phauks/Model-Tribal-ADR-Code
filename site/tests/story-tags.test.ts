import { describe, expect, it, vi } from 'vitest';
import { storyTags } from '#lib/server/stories.ts';
import { storyTagPage } from '#lib/server/story-tag-pages.ts';

vi.mock('virtual:source-citations', () => ({ sourceCitations: {} }));

describe('the pages a story’s method and topic badges open', () => {
	it('lists each method with its stories, linked from the badge', () => {
		const tags = storyTags('methods');
		expect(tags.length).toBeGreaterThan(0);
		for (const tag of tags) {
			expect(tag.link).toBe(`/stories/methods/${tag.id}`);
			expect(tag.stories.length).toBeGreaterThan(0);
		}
	});

	it('lists each topic once per story', () => {
		for (const tag of storyTags('topics')) {
			const ids = tag.stories.map((story) => story.id);
			expect(new Set(ids).size).toBe(ids.length);
		}
	});

	it('refuses a topic no story has', () => {
		expect(() => storyTagPage('topics', 'no-such-topic')).toThrow();
	});
});
