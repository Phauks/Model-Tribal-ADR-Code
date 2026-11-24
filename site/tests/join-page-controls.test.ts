import { describe, expect, it } from 'vitest';
import { joinPageControls } from '../src/lib/join-page-controls.ts';
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
