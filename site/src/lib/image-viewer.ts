/**
 * The image viewer, after Wikipedia's Media Viewer (Trevor, Nov. 23, 2026:
 * "allow clicking an image, like the tribal seal, on the nation page, to
 * open the file larger, like how wikipedia does it"). See site/DESIGN.md,
 * section 6, "Image viewer".
 *
 * A picture that opens larger is a link to its own file, with the class
 * `image-viewer-link`, wrapped around the <img>:
 *
 *   <a class="image-viewer-link" href="/nations/navajo-nation/image" data-viewer-title="Seal">
 *     <img src="/nations/navajo-nation/image" alt="Seal of Navajo Nation">
 *   </a>
 *
 * Without scripts, or with a modified click (a new tab), the link opens the
 * file itself, as Wikipedia's image links open the file's page. With scripts,
 * ImageViewer.svelte catches the click anywhere on the site and shows the
 * picture large over the dimmed page, with its caption, credit and links.
 *
 * What the viewer shows comes from the link's data attributes, which
 * `imageViewerAttributes` writes, and from the <figcaption> of the <figure>
 * the link sits in, so a caption already on the page is never written twice.
 * The pages that build HTML as text (essays, nations' own pictures) use
 * `imageViewerAttributeText`.
 */
import { escapeHtml } from './escape-html.ts';

/** The class every picture link that opens in the viewer carries. */
export const imageViewerLinkClass = 'image-viewer-link';

/** What a page can tell the viewer about a picture, besides its file and description. */
export interface ImageViewerDetails {
	/** A short name, such as "Seal of Navajo Nation". Without one the description is used. */
	title?: string;
	/** Who made or published the picture and on what terms (the credit line and license). */
	credit?: string;
	/** Where the picture is published, such as the nation's own website. */
	original?: string;
	/** The picture's entry in the page's References list, such as "#source-1". */
	source?: string;
}

/** One picture as the viewer shows it. */
export interface ImageViewerItem extends ImageViewerDetails {
	/** The address of the full file, the link's own address. */
	file: string;
	/** The description read aloud in place of the picture (its alternative text). */
	description: string;
	/** The caption under the picture on the page, as HTML, without its links to remove it. */
	captionHtml: string;
}

const dataNames: Record<keyof ImageViewerDetails, string> = {
	title: 'data-viewer-title',
	credit: 'data-viewer-credit',
	original: 'data-viewer-original',
	source: 'data-viewer-source'
};

/**
 * The attributes of a picture's link, for a Svelte page to spread onto the
 * <a>: its class, the words a screen reader hears, and the details the viewer
 * shows. `description` is the picture's alternative text.
 */
export function imageViewerAttributes(description: string, details: ImageViewerDetails = {}): Record<string, string> {
	const attributes: Record<string, string> = {
		class: imageViewerLinkClass,
		'aria-label': imageViewerLinkLabel(description || details.title || ''),
		title: 'Open larger',
		// The file is not a page, so the site's own page loading leaves the link alone.
		'data-sveltekit-reload': ''
	};
	for (const [key, name] of Object.entries(dataNames) as [keyof ImageViewerDetails, string][]) {
		const value = details[key]?.trim();
		if (value) attributes[name] = value;
	}
	return attributes;
}

/** The same attributes written out for HTML built as text, each value escaped. */
export function imageViewerAttributeText(description: string, details: ImageViewerDetails = {}): string {
	return Object.entries(imageViewerAttributes(description, details))
		.map(([name, value]) => ` ${name}="${escapeHtml(value)}"`)
		.join('');
}

/** What a screen reader hears on the link: what the picture shows, then what the link does. */
export function imageViewerLinkLabel(description: string): string {
	const shown = description.trim();
	return shown ? `${shown} (open larger)` : 'Open the picture larger';
}

/** The picture link a click landed in, if the click should open the viewer. */
export function imageViewerLinkFrom(target: EventTarget | null): HTMLAnchorElement | undefined {
	const found = (target as Element | null)?.closest?.(`a.${imageViewerLinkClass}`);
	return found instanceof HTMLAnchorElement && found.querySelector('img') ? found : undefined;
}

/** Every picture on the page that opens in the viewer, in reading order, so the viewer can step between them. */
export function imageViewerLinksIn(root: ParentNode): HTMLAnchorElement[] {
	return [...root.querySelectorAll<HTMLAnchorElement>(`a.${imageViewerLinkClass}`)].filter((link) => link.querySelector('img'));
}

/** Reads what the viewer shows for one picture link. */
export function readImageViewerItem(link: HTMLAnchorElement): ImageViewerItem {
	const image = link.querySelector('img');
	const item: ImageViewerItem = {
		file: link.href,
		description: image?.getAttribute('alt')?.trim() ?? '',
		captionHtml: captionHtml(link)
	};
	for (const [key, name] of Object.entries(dataNames) as [keyof ImageViewerDetails, string][]) {
		const value = link.getAttribute(name)?.trim();
		if (value) item[key] = value;
	}
	return item;
}

/**
 * A copy of the caption under the picture, without the link to ask for its
 * removal (Request a Change is always at hand, Trevor, Nov. 23, 2026) and
 * without ids, which must stay unique on the page.
 */
function captionHtml(link: HTMLAnchorElement): string {
	const caption = link.closest('figure')?.querySelector('figcaption');
	if (!caption) return '';
	const copy = caption.cloneNode(true) as HTMLElement;
	for (const removal of copy.querySelectorAll('.essay-figure-removal')) removal.remove();
	for (const element of copy.querySelectorAll('[id]')) element.removeAttribute('id');
	return copy.innerHTML.trim();
}

/** The heading the viewer gives a picture: its title, else its description, else a plain word. */
export function imageViewerTitle(item: Pick<ImageViewerItem, 'title' | 'description'>): string {
	return item.title || item.description || 'Picture';
}

/** The place of the picture shown next, going round from the last to the first. */
export function stepIndex(index: number, step: number, count: number): number {
	if (count <= 0) return 0;
	return (((index + step) % count) + count) % count;
}

/**
 * Which way a finger swiped across the picture, if it was a swipe: a move
 * mostly sideways of at least `least` pixels. Swiping left shows the next
 * picture, as on a phone's photo app.
 */
export function swipeStep(across: number, down: number, least = 48): -1 | 0 | 1 {
	if (Math.abs(across) < least || Math.abs(across) < Math.abs(down) * 1.5) return 0;
	return across < 0 ? 1 : -1;
}

/** The website a picture's original comes from, to name it on the link ("navajo-nsn.gov"). */
export function originalHost(address: string): string | undefined {
	if (!URL.canParse(address)) return undefined;
	const host = new URL(address).hostname;
	return host.replace(/^www\./, '') || undefined;
}

const extensions: Record<string, string> = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/gif': 'gif',
	'image/webp': 'webp',
	'image/avif': 'avif',
	'image/svg+xml': 'svg'
};

/**
 * The name a downloaded picture is saved under: its title in lowercase words
 * joined by hyphens ("seal-of-navajo-nation.png"), with the extension its
 * media type calls for, or else the one its address ends in. Addresses such
 * as /nations/<id>/image end in no extension, so the title gives the name.
 */
export function downloadName(title: string, file: string, mediaType = ''): string {
	const base =
		title
			.normalize('NFKD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 80)
			.replace(/-+$/, '') || 'picture';
	const fromType = extensions[mediaType.split(';')[0].trim().toLowerCase()];
	const path = URL.canParse(file, 'https://example.org') ? new URL(file, 'https://example.org').pathname : '';
	const fromAddress = /\.([a-z0-9]{2,5})$/i.exec(path)?.[1]?.toLowerCase();
	const extension = fromType ?? fromAddress;
	return extension ? `${base}.${extension}` : base;
}
