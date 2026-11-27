/**
 * The pages about the site, such as the About page, edited on the website
 * like the essays (content/about/README.md, docs/editing.md). Readers see
 * the newest published version, rendered by the Worker as an essay page is.
 * Until a page is first published, or when the database cannot be read, the
 * page shows the text git held when the site was built, so the page is
 * never missing.
 */
import { error } from '@sveltejs/kit';
import { essaysInGit } from 'virtual:essay-library';
import { renderWithCitations } from './essay-citations.ts';
import { essayLibrary, essayPage } from './essay-pages.ts';
import { aboutPageAddresses } from './essays.ts';
import { frontMatterField, splitFrontMatter } from '../essays/syntax.ts';

export async function aboutPage(identifier: string) {
	const path = aboutPageAddresses[identifier];
	const gitText = essaysInGit[identifier];
	if (!path || !gitText) error(404, 'No page has this address.');
	const description = frontMatterField(splitFrontMatter(gitText).frontMatter, 'description')?.trim() || undefined;
	try {
		const page = await essayPage('about', identifier);
		// A page with a draft but no publication yet shows the git text, not
		// the essays' "Not published yet", so readers never see an empty page.
		if (!('unpublished' in page && page.unpublished)) return { ...page, description };
	} catch (problem) {
		// Not published yet (404), no database here (503), or the migration
		// that adds this part is still to be applied: show the git text.
		const status = (problem as { status?: number }).status;
		if (status !== 404 && status !== 503) console.error(`Could not read the published ${identifier} page`, problem);
	}
	const rendered = await renderWithCitations(gitText, essayLibrary);
	return {
		identifier,
		part: 'about' as const,
		path,
		title: rendered.title,
		html: rendered.html,
		sources: rendered.sources,
		headings: rendered.headings,
		publication: undefined,
		isNewest: true,
		newest: undefined,
		publicationCount: 0,
		outline: { title: rendered.title, items: rendered.headings },
		description
	};
}
