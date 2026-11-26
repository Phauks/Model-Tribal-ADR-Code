import { describe, expect, it } from 'vitest';
import { joinFallbacks, joinPageControls } from '../src/lib/join-page-controls.ts';
import type { PageControls, PageMode } from '../src/lib/page-editing.svelte.ts';

function controls(modes: PageMode[], extra: Partial<PageControls> = {}): PageControls & { mode: PageMode } {
	const made = {
		modes,
		mode: 'reading' as PageMode,
		setMode(chosen: PageMode) {
			made.mode = chosen;
		},
		...extra
	};
	return made;
}

describe('joinPageControls', () => {
	it('adds the site text’s Editing to a page that only offers reading and commenting', () => {
		const essay = controls(['reading', 'commenting'], { history: { title: 'Essay history', href: '/essay' } });
		const siteText = controls(['reading', 'editing'], {
			history: { title: 'Site text history', href: '/workspace/site-text' },
			publish: { title: 'Publish 1 change', count: 1, onclick: () => {} }
		});
		const joined = joinPageControls(essay, siteText);
		expect(joined.modes).toEqual(['reading', 'commenting', 'editing']);
		expect(joined.history?.href).toBe('/essay');
		joined.setMode?.('editing');
		expect(siteText.mode).toBe('editing');
		expect(essay.mode).toBe('reading');
		expect(joined.mode).toBe('editing');
		expect(joined.history?.href).toBe('/workspace/site-text');
		expect(joined.publish?.title).toBe('Publish 1 change');
		joined.setMode?.('commenting');
		expect(siteText.mode).toBe('reading');
		expect(essay.mode).toBe('commenting');
		expect(joined.mode).toBe('commenting');
	});

	it('turns on both editors when the page has its own', () => {
		const essay = controls(['reading', 'commenting', 'editing'], { history: { title: 'Essay history', href: '/essay' } });
		const siteText = controls(['reading', 'editing']);
		const joined = joinPageControls(essay, siteText);
		joined.setMode?.('editing');
		expect(essay.mode).toBe('editing');
		expect(siteText.mode).toBe('editing');
		expect(joined.history?.href).toBe('/essay');
	});

	it('keeps a nation page’s links and offers the site text’s modes', () => {
		const nation: PageControls = { modes: [], links: [{ icon: 'team', href: '/team', title: 'Team' }] };
		const siteText = controls(['reading', 'editing']);
		const joined = joinPageControls(nation, siteText);
		expect(joined.modes).toEqual(['reading', 'editing']);
		expect(joined.links).toHaveLength(1);
		joined.setMode?.('editing');
		expect(joined.mode).toBe('editing');
	});
});

describe('joinFallbacks and page comments', () => {
	it('joins the site text’s Editing and the page’s Commenting into one choice of three', () => {
		const siteText = controls(['reading', 'editing'], { history: { title: 'Site text history', href: '/workspace/site-text' } });
		const comments = controls(['reading', 'commenting'], { openComments: 2 });
		const joined = joinFallbacks([siteText, comments]);
		expect(joined.modes).toEqual(['reading', 'commenting', 'editing']);
		expect(joined.openComments).toBe(2);
		joined.setMode?.('commenting');
		expect(comments.mode).toBe('commenting');
		expect(siteText.mode).toBe('reading');
		expect(joined.mode).toBe('commenting');
		joined.setMode?.('editing');
		expect(comments.mode).toBe('reading');
		expect(joined.mode).toBe('editing');
		expect(joined.history?.href).toBe('/workspace/site-text');
	});

	it('leaves Commenting to a page with comments of its own, such as an essay', () => {
		const essay = controls(['reading', 'commenting', 'editing']);
		const comments = controls(['reading', 'commenting'], { openComments: 5 });
		const joined = joinPageControls(essay, comments);
		joined.setMode?.('commenting');
		expect(essay.mode).toBe('commenting');
		expect(comments.mode).toBe('reading');
		expect(joined.openComments).toBeUndefined();
	});

	it('gives Commenting to the page’s comments where the page has none of its own', () => {
		const nation = controls([], { links: [{ title: 'Edit', href: '/edit', icon: 'edit' }] });
		const comments = controls(['reading', 'commenting'], { openComments: 1 });
		const joined = joinPageControls(nation, comments);
		expect(joined.modes).toEqual(['reading', 'commenting']);
		joined.setMode?.('commenting');
		expect(comments.mode).toBe('commenting');
		expect(joined.mode).toBe('commenting');
		expect(joined.openComments).toBe(1);
	});
});
