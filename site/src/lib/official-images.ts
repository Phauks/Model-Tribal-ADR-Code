/**
 * Which of a nation's official images (seal, emblem, flag or logo) the site
 * may show. The rule is set out in docs/official-images.md: reuse is assumed
 * unless a signal says otherwise, and the record's reuse status already
 * follows from its signals (scripts/validate_records.py checks that). This
 * file only decides which statuses mean "show".
 */

/** The parts of a record's official_images entry the site reads. */
export interface OfficialImageRecord {
	kind: string;
	alternative_text?: string;
	image_link: string;
	media_type?: string;
	sha256: string;
	private_copy?: string;
	source?: string;
	reuse: {
		status: string;
		permission?: { scope?: string[] };
	};
}

/**
 * Shown: no restriction found; conditions that the website meets (the page
 * credits the nation and says it does not endorse the project); or permission
 * the nation granted for the web. Restricted, unchecked, refused and withdrawn
 * images are never shown.
 */
export function imageMayBeShown(image: OfficialImageRecord): boolean {
	switch (image.reuse?.status) {
		case 'no-restriction-found':
		case 'conditions-apply':
			return true;
		case 'permission-granted': {
			const scope = image.reuse.permission?.scope;
			return !scope || scope.includes('web');
		}
		default:
			return false;
	}
}

/** One image the Worker may serve, listed at build time (vite.config.ts). */
export interface ServableImage {
	/** The nation's record id; the image's address is /nations/<nation>/image. */
	nation: string;
	/** Key of the copy in the private sourceDocuments bucket. */
	key: string;
	/** Where the nation's website publishes the image. */
	link: string;
	mediaType: string;
	/** SHA-256 of the reviewed copy, in hexadecimal. */
	sha256: string;
}

/** The address the site serves a nation's image from. */
export function imagePath(nation: string): string {
	return `/nations/${nation}/image`;
}
