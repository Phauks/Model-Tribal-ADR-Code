/**
 * The News pages (src/routes/news): the list, a post's page and the Atom
 * feed, from the posts src/lib/server/news-posts.ts reads.
 */
import { essayDate } from '../essays/dates.ts';
import { essayPage, renderedVersion, storageForPages } from './essay-pages.ts';
import { newsPosts, type PostDetails } from './news-posts.ts';

/** What the News list shows. */
export async function newsIndex() {
	const { database, bucket } = storageForPages();
	const posts = await newsPosts(database, bucket);
	return {
		posts: posts.map(({ identifier, title, link, summary, postedAt, postedText }) => ({ identifier, title, link, summary, postedAt, postedText }))
	};
}

/** A post's page: the essay page without credit lines, and the post's details. */
export async function newsPostPage(slug: string, publicationNumber?: number) {
	const page = await essayPage('news', slug, publicationNumber, { credits: false });
	if (page.unpublished) return { ...page, post: undefined };
	const { database, bucket } = storageForPages();
	const posts = await newsPosts(database, bucket);
	const at = posts.findIndex((post) => post.identifier === page.identifier);
	const here = posts[at];
	if (!here) return { ...page, post: undefined };
	const updatedText = essayDate(here.updatedAt);
	const post: PostDetails = {
		postedText: here.postedText,
		...(updatedText !== here.postedText ? { updatedText } : {}),
		author: here.author,
		older: posts[at + 1] ? { title: posts[at + 1].title, link: posts[at + 1].link } : null,
		newer: at > 0 ? { title: posts[at - 1].title, link: posts[at - 1].link } : null
	};
	return { ...page, post };
}

/** The References list under a post's text in the feed, with the ids its citation markers point to, since a feed reader shows no page around it. */
function referencesHtml(sources: { number: number; html: string }[]): string {
	if (sources.length === 0) return '';
	return `\n<h2>References</h2>\n<ol>${sources.map((source) => `<li id="source-${source.number}">${source.html}</li>`).join('')}</ol>\n`;
}

/** The posts for the Atom feed, each with its newest text rendered. */
export async function newsFeedEntries(limit = 50) {
	const { database, bucket } = storageForPages();
	const posts = (await newsPosts(database, bucket)).slice(0, limit);
	const rendered = await Promise.all(
		posts.map((post) =>
			renderedVersion(bucket, post.newest).then(
				(text) => text.html + referencesHtml(text.sources),
				(problem) => {
					console.error(`Could not render ${post.identifier} for the feed`, problem);
					return '';
				}
			)
		)
	);
	return posts.map((post, index) => ({ ...post, html: rendered[index] }));
}
