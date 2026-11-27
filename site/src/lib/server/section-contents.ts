/**
 * The pages a page belongs with, for the side column (SiteSidebar.svelte).
 * Trevor chose on Nov. 27, 2026 to keep the side column to where the reader
 * is (design/navigation-models, model C): the pages of the section, or of the
 * family a page belongs to, then the page's own headings. A nation's pages
 * give their family themselves (src/routes/nations/[id]); the essays of
 * Foundations and of Essays are read from the database, so the root layout
 * sends them with each of their pages and nothing loads afterwards.
 */
import type { PageFamily } from '#lib/site-sections.ts';

/** The sections whose essays are read from the database, with the name their pages use. */
const essayParts = { foundations: 'Foundations', essays: 'Essays' } as const;
type EssayPart = keyof typeof essayParts;

/** The family of essays a path belongs to, if any. */
export function familyOf(path: string): EssayPart | undefined {
	const part = path.split('/')[1];
	return Object.hasOwn(essayParts, part) ? (part as EssayPart) : undefined;
}

/** The essays of a part, in their order, for the side column. */
export async function familyContents(part: EssayPart): Promise<PageFamily | undefined> {
	const contents = await sectionContents(part);
	if (!contents) return undefined;
	return { title: essayParts[part], link: `/${part}`, pages: contents.pages.map(({ children: _children, ...item }) => item) };
}

/** The essays of Foundations or Essays, as the essay index lists them. */
export async function sectionContents(section: string): Promise<{ pages: PageFamily['pages'] } | undefined> {
	if (!Object.hasOwn(essayParts, section)) return undefined;
	// Loaded only here, so pages outside the essays do not load the essay pages.
	const { essayIndex } = await import('./essay-pages.ts');
	const index = await essayIndex(section as EssayPart);
	return { pages: index.outline.items };
}
