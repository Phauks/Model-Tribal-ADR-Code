import { describe, expect, it } from 'vitest';
import { youtubeEmbedAddress, youtubeVideoIdentifier } from '#lib/video-links.ts';

describe('youtubeVideoIdentifier', () => {
	it('reads the usual kinds of YouTube link', () => {
		for (const link of [
			'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
			'youtube.com/watch?v=dQw4w9WgXcQ&t=42s',
			'https://youtu.be/dQw4w9WgXcQ?si=abc',
			'https://m.youtube.com/shorts/dQw4w9WgXcQ',
			'https://www.youtube.com/embed/dQw4w9WgXcQ',
			'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
			'https://www.youtube.com/live/dQw4w9WgXcQ'
		]) {
			expect(youtubeVideoIdentifier(link), link).toBe('dQw4w9WgXcQ');
		}
	});

	it('refuses other sites, playlists and malformed identifiers', () => {
		expect(youtubeVideoIdentifier('https://vimeo.com/123')).toBeUndefined();
		expect(youtubeVideoIdentifier('https://youtube.com.example.org/watch?v=dQw4w9WgXcQ')).toBeUndefined();
		expect(youtubeVideoIdentifier('https://www.youtube.com/playlist?list=PL123')).toBeUndefined();
		expect(youtubeVideoIdentifier('https://youtu.be/short')).toBeUndefined();
		expect(youtubeVideoIdentifier('javascript:alert(1)')).toBeUndefined();
		expect(youtubeVideoIdentifier('')).toBeUndefined();
	});

	it('embeds in privacy-enhanced mode', () => {
		expect(youtubeEmbedAddress('dQw4w9WgXcQ')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
	});
});
