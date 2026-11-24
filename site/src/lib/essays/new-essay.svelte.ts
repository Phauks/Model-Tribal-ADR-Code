/**
 * Where the "New essay" button shows: beside the section's name in the
 * sidebar (essay-editor-mockups/4 and v2-1) and beside the heading of the
 * section's page, for someone with full access to every essay. The section's
 * index page and each essay page set it once they know the person may start
 * one (EssayIndex.svelte, EssayArticle.svelte); the sidebar shows the button
 * only in that section (SiteSidebar.svelte).
 */
export interface NewEssayPlace {
	/** The section's address, such as /essays. */
	sectionLink: string;
	/** The part a new essay goes in: foundations, essays or back-matter. */
	part: string;
}

export const newEssayPlace = $state<{ current: NewEssayPlace | null }>({ current: null });

/** The section page for each part an essay can be started in. */
export const partSections: Record<string, string> = { foundations: '/foundations', essays: '/essays', 'back-matter': '/back-matter' };
