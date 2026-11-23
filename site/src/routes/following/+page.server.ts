import { fail } from '@sveltejs/kit';
import { emailChoiceLabels, followKindOf, historyAddress, type FollowKind } from '#lib/following.ts';
import {
	followedPages,
	markNoticesRead,
	noticesFor,
	settingsFor,
	unfollow
} from '#lib/server/following.ts';
import { checkThisBuildOnce, currentDirectory } from '#lib/server/following-run.ts';
import { requireAccount, storage } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad } from './$types';

export interface NoticeView {
	address: string;
	title: string;
	kind: FollowKind;
	updatedAt: string;
	unread: boolean;
	/** The page's public version history, for the model code and essays; never for a nation. */
	history: string | undefined;
}

/**
 * The reader's Following page: updates to the pages they follow, the pages
 * themselves, and how often to email. Opening it marks the updates as seen.
 * A notice names the page by its title on the site now and says only that it
 * was updated; an update to a page no longer on the site is not shown.
 */
export const load: PageServerLoad = async (event) => {
	const account = requireAccount(event);
	const { database } = storage(event);
	await checkThisBuildOnce(database);
	const directory = await currentDirectory(database);
	const [pages, notices, settings] = await Promise.all([
		followedPages(database, account.subject, directory),
		noticesFor(database, account.subject),
		settingsFor(database, account.subject)
	]);
	const shown: NoticeView[] = [];
	for (const notice of notices) {
		const page = directory.get(notice.address);
		if (!page) continue;
		shown.push({
			address: notice.address,
			title: page.title,
			kind: page.kind,
			updatedAt: notice.updatedAt,
			unread: notice.unread,
			history: historyAddress(page.kind, notice.address)
		});
	}
	const newest = notices[0]?.identifier;
	if (newest && notices.some((notice) => notice.unread)) await markNoticesRead(database, account.subject, newest);
	return {
		email: account.email,
		pages,
		notices: shown,
		emailLine: `${emailChoiceLabels[settings.email]}.`
	};
};

export const actions: Actions = {
	unfollow: async (event) => {
		const account = requireAccount(event);
		const { database } = storage(event);
		const address = String((await event.request.formData()).get('address') ?? '');
		if (!followKindOf(address)) return fail(400, { problem: 'Choose a page to stop following.' });
		await unfollow(database, account.subject, address);
		return { done: 'You no longer follow that page.' };
	}
};
