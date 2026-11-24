/**
 * Shared by the editing box and the workspace's Site text pages
 * (docs/site-text.md).
 */

/** What the editing box knows about one piece of text on the page. */
export interface SiteTextPiece {
	key: string;
	builtIn: string;
	/** For a label in an attribute, its name, such as aria-label. */
	attribute: string | null;
	/** The published words, or null for the built-in words. */
	published: string | null;
	draft: { words: string | null; personName: string | null; createdAt: string } | null;
}

/** The words a piece shows with drafts: the draft, else what is published, else the built-in words. */
export function shownWords(piece: SiteTextPiece): string {
	if (piece.draft) return piece.draft.words ?? piece.builtIn;
	return piece.published ?? piece.builtIn;
}

/**
 * Where a piece of text is, for people: the page address for a page file
 * ("/sponsor"), "Every page under /workspace" for a layout, and the
 * component's name in words for a component ("Site header").
 */
/** A page's address in words: "/workspace/site-text" is "Workspace › Site text", "/" is "Home page". */
export function pageName(path: string): string {
	const segments = path.split(/[?#]/)[0].split('/').filter(Boolean);
	if (segments.length === 0) return 'Home page';
	return segments
		.map((segment) => {
			const words = decodeURIComponent(segment).replace(/^\[\.*([^\]]+)\]$/, 'any $1').replace(/[-_]+/g, ' ');
			return words.charAt(0).toLocaleUpperCase('en-US') + words.slice(1);
		})
		.join(' › ');
}

export function siteTextPlace(file: string): string {
	const route = /^src\/routes(\/.*)?\/\+(page|layout|error)\.svelte$/.exec(file);
	if (route) {
		const path = (route[1] ?? '').replace(/\/\([^)]+\)/g, '') || '/';
		if (route[2] === 'layout') return path === '/' ? 'Every page' : `Every page under ${pageName(path)}`;
		if (route[2] === 'error') return path === '/' ? 'Error page' : `Error page under ${pageName(path)}`;
		return pageName(path);
	}
	const component = /([^/]+)\.svelte$/.exec(file);
	if (!component) return file;
	const words = component[1].replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLocaleLowerCase('en-US');
	return words.charAt(0).toLocaleUpperCase('en-US') + words.slice(1);
}
