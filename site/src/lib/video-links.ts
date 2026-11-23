/**
 * YouTube links as a video source (decision record 0038). Trevor said on
 * Nov. 23, 2026 the project "might just end up with YouTube linking", so an
 * upload can be a YouTube link in place of a file, and the essay editor's
 * Video block can show one.
 *
 * Videos are embedded from youtube-nocookie.com, YouTube's privacy-enhanced
 * mode, which does not store cookies for a viewer until they play the video
 * (YouTube Help, "Embed videos & playlists", "Turn on privacy-enhanced mode").
 */

const identifierPattern = /^[A-Za-z0-9_-]{11}$/;

const youtubeHosts = new Set([
	'youtube.com',
	'www.youtube.com',
	'm.youtube.com',
	'music.youtube.com',
	'youtube-nocookie.com',
	'www.youtube-nocookie.com',
	'youtu.be'
]);

/**
 * The video's 11-character identifier from a YouTube link, or undefined when
 * the text is not a link to one YouTube video. Accepts watch, short, embed,
 * live and shorts links, with or without "https://".
 */
export function youtubeVideoIdentifier(link: string): string | undefined {
	const text = link.trim();
	if (text === '') return undefined;
	const withScheme = /^[a-z]+:\/\//i.test(text) ? text : `https://${text}`;
	if (!URL.canParse(withScheme)) return undefined;
	const address = new URL(withScheme);
	if (address.protocol !== 'https:' && address.protocol !== 'http:') return undefined;
	const host = address.hostname.toLowerCase();
	if (!youtubeHosts.has(host)) return undefined;
	const parts = address.pathname.split('/').filter(Boolean);
	let candidate: string | undefined;
	if (host === 'youtu.be') candidate = parts[0];
	else if (parts[0] === 'watch') candidate = address.searchParams.get('v') ?? undefined;
	else if (['embed', 'live', 'shorts', 'v'].includes(parts[0] ?? '')) candidate = parts[1];
	return candidate && identifierPattern.test(candidate) ? candidate : undefined;
}

/** The ordinary page for a video, for links and for print. */
export function youtubeWatchAddress(identifier: string): string {
	return `https://www.youtube.com/watch?v=${identifier}`;
}

/** The privacy-enhanced embed address, for an iframe. */
export function youtubeEmbedAddress(identifier: string): string {
	return `https://www.youtube-nocookie.com/embed/${identifier}`;
}

/** YouTube's still frame for a video, for a poster before the viewer presses play, and for print. */
export function youtubePosterAddress(identifier: string): string {
	return `https://i.ytimg.com/vi/${identifier}/hqdefault.jpg`;
}
