/**
 * The project documents a reader may need on the website, the charter and the
 * licenses, rendered as site pages from the same files in the repository, so
 * a link on the site never sends a reader to GitHub unless it says so (site/
 * DESIGN.md, section 6, "Links stay on the site"; Trevor, Nov. 22, 2026).
 *
 * The website never refers readers to the project's internal documents, such
 * as decision records, the roadmap or the specifications in docs/ (Trevor,
 * Nov. 22, 2026). So, as a document is rendered:
 *   - text between <!-- repository-only --> and <!-- /repository-only -->
 *     is left out. On GitHub the markers are invisible and the text shows;
 *     use them around a cross-reference to an internal document;
 *   - a link to another document shown here goes to that document's page,
 *     keeping its anchor, and a file name used as the link's words, such as
 *     "LICENSES/MIT.txt", becomes that page's title;
 *   - a link to any other file in the repository becomes plain words, with
 *     no link;
 *   - a link to another website stays, and one to github.com is followed
 *     by "(GitHub)".
 *
 * Every page is prerendered, so this runs only at build time, in Node.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Marked, type Tokens } from 'marked';
import markedFootnote from 'marked-footnote';
import { gfmHeadingId } from 'marked-gfm-heading-id';
import { repositoryLink } from '#lib';
import { escapeHtml } from '../escape-html.ts';
import { repositoryRoot } from './content.ts';

export interface ProjectDocument {
	/** The file, relative to the repository root, such as "docs/charter.md". */
	file: string;
	/** The page on the site, such as "/charter". */
	address: string;
}

/** The full names of the license texts in LICENSES/, which carry no heading of their own. */
const licenseTitles: Record<string, string> = {
	'CC0-1.0': 'Creative Commons CC0 1.0 Universal',
	'CC-BY-4.0': 'Creative Commons Attribution 4.0 International',
	'CC-BY-SA-3.0': 'Creative Commons Attribution-ShareAlike 3.0 Unported',
	MIT: 'MIT License',
	'OFL-1.1': 'SIL Open Font License 1.1',
	Lucide: 'Lucide License (ISC License, and MIT License for icons from Feather)',
	Octicons: 'Primer Octicons License (MIT License)'
};

let documentCache: ProjectDocument[] | undefined;

/** Every project document the site shows: the charter, LICENSE.md and each text in LICENSES/. */
export function projectDocuments(): ProjectDocument[] {
	if (!documentCache) {
		const licenseFolder = path.join(repositoryRoot, 'LICENSES');
		const licenseTexts = existsSync(licenseFolder)
			? readdirSync(licenseFolder)
					.filter((name) => name.endsWith('.txt'))
					.sort()
			: [];
		documentCache = [
			{ file: 'docs/charter.md', address: '/charter' },
			{ file: 'LICENSE.md', address: '/licenses' },
			...licenseTexts.map((name) => ({
				file: `LICENSES/${name}`,
				address: `/licenses/${path.posix.basename(name, '.txt').toLowerCase()}`
			}))
		];
	}
	return documentCache;
}

export function documentAt(address: string): ProjectDocument | undefined {
	return projectDocuments().find((document) => document.address === address);
}

/** The page on the site for a repository file, if the site shows it. */
export function addressOfFile(file: string): string | undefined {
	return projectDocuments().find((document) => document.file === file)?.address;
}

const repositoryFilePrefix = new RegExp(
	`^${repositoryLink.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/(?:blob|tree)/main/`,
	'i'
);

export type ResolvedLink =
	| { kind: 'page'; href: string; file: string }
	| { kind: 'web'; href: string; toGithub: boolean }
	| { kind: 'unshown-file'; file: string };

/**
 * Where a link written in a document leads on the site. `from` is the
 * document's own file, against which relative links are resolved.
 */
export function resolveDocumentLink(href: string, from: string): ResolvedLink {
	const hashAt = href.indexOf('#');
	const target = hashAt === -1 ? href : href.slice(0, hashAt);
	const anchor = hashAt === -1 ? '' : href.slice(hashAt);
	let file: string;
	if (target === '') {
		return { kind: 'web', href, toGithub: false };
	} else if (repositoryFilePrefix.test(target)) {
		file = decodeURI(target.replace(repositoryFilePrefix, ''));
	} else if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('//')) {
		return { kind: 'web', href, toGithub: /^https?:\/\/(www\.)?github\.com\//i.test(target) };
	} else if (target.startsWith('/')) {
		return { kind: 'web', href, toGithub: false };
	} else {
		file = path.posix.normalize(path.posix.join(path.posix.dirname(from), decodeURI(target)));
	}
	const address = addressOfFile(file);
	if (address) return { kind: 'page', href: address + anchor, file };
	return { kind: 'unshown-file', file: file.replace(/\/$/, '') };
}

const repositoryOnly = /<!--\s*repository-only\s*-->[\s\S]*?<!--\s*\/repository-only\s*-->/g;

/** The document's text as the website shows it, without the parts marked repository-only. */
export function withoutRepositoryOnlyText(markdown: string): string {
	return markdown.replace(repositoryOnly, '');
}

export interface RenderedDocument {
	title: string;
	html: string;
}

function titleOf(document: ProjectDocument): string {
	if (document.file.endsWith('.txt')) {
		const name = path.posix.basename(document.file, '.txt');
		return licenseTitles[name] ?? name;
	}
	const text = readFileSync(path.join(repositoryRoot, document.file), 'utf8');
	const heading = /^#\s+(.+)$/m.exec(text);
	return heading ? heading[1].replace(/[*_`]/g, '').trim() : path.posix.basename(document.file, '.md');
}

function documentRenderer(from: string): Marked {
	const renderer = new Marked({ gfm: true });
	renderer.use(gfmHeadingId(), markedFootnote());
	renderer.use({
		renderer: {
			link(this: { parser: { parseInline(tokens: Tokens.Generic[]): string } }, token: Tokens.Link) {
				const text = this.parser.parseInline(token.tokens);
				const resolved = resolveDocumentLink(token.href, from);
				const title = token.title ? ` title="${escapeHtml(token.title)}"` : '';
				if (resolved.kind === 'unshown-file') return text;
				if (resolved.kind === 'page') {
					const target = documentAt(resolved.href.split('#')[0]);
					const shown =
						target && /^[\w./-]+\.(md|txt)$/.test(token.text.trim()) ? escapeHtml(titleOf(target)) : text;
					return `<a href="${escapeHtml(resolved.href)}"${title}>${shown}</a>`;
				}
				if (!resolved.toGithub) return `<a href="${escapeHtml(resolved.href)}"${title}>${text}</a>`;
				return `<a href="${escapeHtml(resolved.href)}"${title}>${text} <span class="github-note">(GitHub)</span></a>`;
			}
		}
	});
	return renderer;
}

/**
 * A footnote cited more than once gets a back link for each use, shown as
 * "↩2", "↩3". Its accessible name must include the number it shows (WCAG
 * 2.5.3, label in name), so "Back to reference x" becomes "Back to reference
 * x, use 2".
 */
export function withNumberedBackLinks(html: string): string {
	return html.replace(
		/aria-label="(Back to reference [^"]+)">↩<sup>(\d+)<\/sup>/g,
		(_whole, label: string, use: string) => `aria-label="${label}, use ${use}">↩<sup>${use}</sup>`
	);
}

/**
 * Wraps each table in a box that scrolls sideways on its own, as essays do
 * (src/lib/essays/render.ts), so a wide table never widens the page. The box
 * can take focus, so keyboard readers can scroll it too.
 */
export function withScrollingTables(html: string): string {
	return html
		.replace(/<table>/g, '<div class="table-scroll" tabindex="0"><table>')
		.replace(/<\/table>/g, '</table></div>');
}

/**
 * A license text with its hard line breaks inside paragraphs taken out, so it
 * wraps to the column it sits in, beside At a glance on a license's page,
 * rather than breaking twice. Blank lines, indented lines, list items, lines in
 * capitals that read as headings and a new sentence after a full stop keep
 * their own line.
 */
export function unwrapLines(text: string): string {
	return text.replace(/([^\n])\n(?![\s\n]|\d+[.)]|[-*•(]|[A-Z][A-Z ]+:?$)/gm, (whole, last: string, offset: number) => {
		const next = text.charAt(offset + 2);
		return /[.:;]/.test(last) && /[A-Z]/.test(next) ? whole : `${last} `;
	});
}

/** A project document as a title and HTML, as the website shows it. */
export function renderProjectDocument(document: ProjectDocument): RenderedDocument {
	const text = readFileSync(path.join(repositoryRoot, document.file), 'utf8').normalize('NFC');
	const title = titleOf(document);
	if (document.file.endsWith('.txt')) {
		return { title, html: `<pre class="license-text">${escapeHtml(unwrapLines(text.trim()))}</pre>` };
	}
	const heading = /^#\s+(.+)$/m.exec(text);
	const body = heading ? text.slice(0, heading.index) + text.slice(heading.index + heading[0].length) : text;
	const html = documentRenderer(document.file).parse(withoutRepositoryOnlyText(body), { async: false }) as string;
	return { title, html: withScrollingTables(withNumberedBackLinks(html)) };
}

/** What a project document's page needs, for the address it is shown at. */
export function projectDocumentPage(address: string) {
	const document = documentAt(address);
	if (!document) return undefined;
	const { title, html } = renderProjectDocument(document);
	return {
		title,
		html,
		file: document.file,
		sourceLink: `${repositoryLink}/blob/main/${document.file}`,
		historyLink: `${repositoryLink}/commits/main/${document.file}`
	};
}

/**
 * The material a license text covers, from the "Material" column of the
 * table in LICENSE.md whose "Full text" links to it, for the license's info
 * page (site/DESIGN.md, "Info pages").
 */
export function licenseMaterials(file: string): string[] {
	const table = withoutRepositoryOnlyText(readFileSync(path.join(repositoryRoot, 'LICENSE.md'), 'utf8'));
	return table
		.split('\n')
		.filter((line) => line.startsWith('|') && line.includes(`(${file})`))
		.map((line) => line.split('|')[1].trim().replace(/`/g, ''));
}
