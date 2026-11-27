/**
 * A nation's own pages, listed at the top of the side column on each of them
 * (SiteSidebar.svelte): the nation's name, its page, and its Court
 * opinions where it has any (Trevor chose this on Nov. 27, 2026,
 * design/navigation-models/mockups/C-desktop-nation.png). There is no
 * "‹ Nations" link: the section bar's Nations and the breadcrumbs go there,
 * and the column never repeats the top navigation (Trevor, Nov. 27, 2026).
 * A new page of a nation's own joins the list here.
 */
import type { PageFamily } from './site-sections.ts';

export function nationFamily(identifier: string, name: string, opinionCount: number): PageFamily {
	return {
		title: name,
		pages: [
			{ label: 'Nation Page', link: `/nations/${identifier}` },
			...(opinionCount > 0 ? [{ label: 'Court Opinions', link: `/nations/${identifier}/opinions`, count: opinionCount }] : [])
		]
	};
}
