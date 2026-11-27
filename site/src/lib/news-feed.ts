/**
 * The News feed in Atom (RFC 4287), so readers can follow News in a feed
 * reader (src/routes/news/feed.xml). Each entry carries the post's summary
 * and its whole text, with xml:base set to the post's address so links
 * inside it, such as a citation's "#source-1", resolve against the post.
 */
import { escapeHtml } from './escape-html.ts';

export interface FeedPost {
	identifier: string;
	title: string;
	link: string;
	summary: string;
	postedAt: string;
	updatedAt: string;
	html: string;
	author: { name: string } | null;
}

/** Atom wants full date-times; D1 rows already hold ISO 8601 ones. */
function atomDate(value: string): string {
	return new Date(value).toISOString();
}

export function atomFeed({ site, posts, builtAt }: { site: string; posts: FeedPost[]; builtAt: string }): string {
	const address = site.replace(/\/+$/, '');
	const updated = posts.reduce((latest, post) => (post.updatedAt > latest ? post.updatedAt : latest), posts[0]?.updatedAt ?? builtAt);
	const entries = posts.map((post) => {
		const page = `${address}${post.link}`;
		return [
			'\t<entry>',
			`\t\t<id>${escapeHtml(page)}</id>`,
			`\t\t<title>${escapeHtml(post.title)}</title>`,
			`\t\t<link rel="alternate" type="text/html" href="${escapeHtml(page)}"/>`,
			`\t\t<published>${atomDate(post.postedAt)}</published>`,
			`\t\t<updated>${atomDate(post.updatedAt)}</updated>`,
			post.author ? `\t\t<author><name>${escapeHtml(post.author.name)}</name></author>` : '',
			post.summary ? `\t\t<summary>${escapeHtml(post.summary)}</summary>` : '',
			post.html ? `\t\t<content type="html" xml:base="${escapeHtml(page)}">${escapeHtml(post.html)}</content>` : '',
			'\t</entry>'
		]
			.filter(Boolean)
			.join('\n');
	});
	return [
		'<?xml version="1.0" encoding="utf-8"?>',
		'<feed xmlns="http://www.w3.org/2005/Atom">',
		`\t<id>${escapeHtml(`${address}/news`)}</id>`,
		'\t<title>News · Tribal Law Project</title>',
		`\t<link rel="self" type="application/atom+xml" href="${escapeHtml(`${address}/news/feed.xml`)}"/>`,
		`\t<link rel="alternate" type="text/html" href="${escapeHtml(`${address}/news`)}"/>`,
		`\t<updated>${atomDate(updated)}</updated>`,
		'\t<author><name>Tribal Law Project</name></author>',
		...entries,
		'</feed>',
		''
	].join('\n');
}
