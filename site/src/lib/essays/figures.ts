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
 * A chart is a figure too: a bar chart drawn from a small table written in
 * the essay, so its numbers stay as they were when the essay was written
 * (the data views plan: essay blocks are "frozen as of a date" by default).
 * The table's first column names each bar and its second gives the number.
 *
 * Shared by the website (render.ts), the editor and the tests.
 */
import { isUploadReference } from '../uploads.ts';
import { youtubeVideoIdentifier, youtubeWatchAddress } from '../video-links.ts';
import { essayBlocks } from './syntax.ts';

export const figureKinds = ['picture', 'video', 'sound', 'chart'] as const;
export type FigureKind = (typeof figureKinds)[number];

export const figureKindLabels: Record<FigureKind, string> = {
	picture: 'Picture',
	video: 'Video',
	sound: 'Sound recording',
	chart: 'Chart'
};

/** A figure's kind and address from the words after its opening colons ("figure picture /files/…", "figure chart"). */
export function readFigureInfo(info: string): { kind: FigureKind; address: string } {
	const [, kind, address, chart] = essayBlocks.figure.exec(info.trim()) ?? [];
	if (chart) return { kind: 'chart', address: '' };
	return { kind: (kind ?? 'picture') as FigureKind, address: address ?? '' };
}

/** The words after a figure's opening colons, the reverse of readFigureInfo. */
export function figureInfo(kind: FigureKind, address: string): string {
	return figureHasFile(kind) ? `figure ${kind} ${address}` : `figure ${kind}`;
}

/** Kinds shown from a file or a link; a chart is drawn from its own table. */
export function figureHasFile(kind: FigureKind): boolean {
	return kind !== 'chart';
}

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

/** The parts each kind of figure can take: a chart's bars are already read aloud, and only sound and video have words to transcribe. */
export const figurePartsFor: Record<FigureKind, FigurePart[]> = {
	picture: ['description', 'credit'],
	video: ['description', 'credit', 'transcript'],
	sound: ['description', 'credit', 'transcript'],
	chart: ['credit']
};

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
	if (!figureHasFile(kind)) return undefined;
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

/** One bar of a chart, with its number as written in the table ("1,234", "45%"). */
export interface ChartBarText {
	label: string;
	value: number;
	shown: string;
}

/** A chart's bars read from its table's rows (the header row first), or what is wrong with the table. */
export function chartFromRows(rows: string[][]): { labelHeader: string; valueHeader: string; bars: ChartBarText[] } | { problem: string } {
	const [header, ...body] = rows;
	if (!header || header.length < 2 || body.length === 0) {
		return { problem: 'A chart needs a table with a header row, at least one row of data, and two columns: a name, then a number.' };
	}
	const bars: ChartBarText[] = [];
	for (const row of body) {
		const shown = (row[1] ?? '').trim();
		const value = Number(shown.replace(/[,\s]/g, '').replace(/%$/, ''));
		if (shown === '' || !Number.isFinite(value) || value < 0) {
			return { problem: `A chart's second column must hold numbers of zero or more; "${shown || '(empty)'}" in the row "${row[0] ?? ''}" is not one.` };
		}
		bars.push({ label: (row[0] ?? '').trim(), value, shown });
	}
	return { labelHeader: header[0].trim(), valueHeader: header[1].trim(), bars };
}
