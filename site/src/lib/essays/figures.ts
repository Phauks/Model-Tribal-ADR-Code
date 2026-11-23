/**
 * Essay figures: a picture, a video or a sound recording set between an
 * essay's paragraphs (Trevor, Nov. 23, 2026: files kept in the project's own
 * bucket, not a video service, with YouTube links as a second way to show a
 * video, and sound recordings with a transcript).
 *
 * A figure's file is sent from the editor through the upload path
 * (docs/uploads.md) and served at /files/<reference>/<name>. The caption,
 * the description read aloud in place of a picture, the credit and the
 * transcript are written in the essay itself, so they keep the essay's
 * version history and show up in drafts like any other change.
 *
 * Shared by the website (render.ts), the editor and the tests.
 */
import { isUploadReference } from '../uploads.ts';
import { youtubeVideoIdentifier, youtubeWatchAddress } from '../video-links.ts';

export const figureKinds = ['picture', 'video', 'sound'] as const;
export type FigureKind = (typeof figureKinds)[number];

export const figureKindLabels: Record<FigureKind, string> = {
	picture: 'Picture',
	video: 'Video',
	sound: 'Sound recording'
};

/**
 * The labeled parts of a figure, besides its caption: the description of a
 * picture or video for people who cannot see it (the image's alternative
 * text), who made it, and what is said in a video or recording.
 */
export const figureParts = {
	description: 'Description',
	credit: 'Credit',
	transcript: 'Transcript'
} as const;
export type FigurePart = keyof typeof figureParts;
export const figurePartOrder: FigurePart[] = ['description', 'credit', 'transcript'];

/** A figure as the editor's dialog hands it over, with its text as Markdown. */
export interface NewFigure {
	kind: FigureKind;
	address: string;
	caption: string;
	description: string;
	credit: string;
	transcript: string;
}

/** Where a figure's file is: a file sent from the editor, or a YouTube video. */
export type FigureSource =
	| { kind: 'file'; reference: string; address: string }
	| { kind: 'youtube'; identifier: string; address: string };

const filePattern = /^\/files\/([^/\s]+)\/([^/\s]+)$/;

/**
 * Reads a figure's address. A picture or a sound recording must be a file
 * sent from the editor; a video can also be a YouTube link. Anything else
 * is refused, so an essay never shows a file from an unknown place.
 */
export function figureSource(kind: FigureKind, address: string): FigureSource | undefined {
	const file = filePattern.exec(address);
	if (file && isUploadReference(file[1])) return { kind: 'file', reference: file[1], address };
	if (kind !== 'video') return undefined;
	const identifier = youtubeVideoIdentifier(address);
	return identifier ? { kind: 'youtube', identifier, address: youtubeWatchAddress(identifier) } : undefined;
}

/** The address a figure's file is served at, with its name made safe for one line of Markdown. */
export function figureFileAddress(reference: string, fileName: string): string {
	const name = encodeURIComponent(fileName.trim() || 'file').replace(/[()']/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
	return `/files/${reference}/${name}`;
}

/** The kind of figure a file's media type suggests, before the server checks the file itself. */
export function figureKindFor(mediaType: string): FigureKind | undefined {
	if (mediaType.startsWith('image/')) return 'picture';
	if (mediaType.startsWith('video/')) return 'video';
	if (mediaType.startsWith('audio/')) return 'sound';
	return undefined;
}

/**
 * The request form, filled in to ask that a figure be taken down (the same
 * removal path as nation pictures and stories).
 */
export function figureRemovalLink(source: FigureSource): string {
	const record = source.kind === 'file' ? `uploads/${source.reference}` : `videos/youtube-${source.identifier}`;
	return `/requests?${new URLSearchParams({ kind: 'remove', record }).toString().replaceAll('%2F', '/')}`;
}
