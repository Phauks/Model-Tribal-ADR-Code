import { aboutPage } from '#lib/server/about-pages.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { giftState, publicMode, publicSponsors, type PublicSponsor } from '#lib/server/sponsors.ts';
import type { PageServerLoad } from './$types';

// Edited on the website like the essays (content/about/README.md), so the
// Worker renders it. Below the text, the sponsors who have given and chose
// to be listed (docs/sponsorship.md).
export const prerender = false;

export const load: PageServerLoad = async () => {
	const environment = workerEnvironment();
	const state = giftState(environment);
	let sponsors: PublicSponsor[] = [];
	if (environment.database) {
		try {
			sponsors = await publicSponsors(environment.database, publicMode(state));
		} catch (problem) {
			// Before the sponsor tables exist the page still shows its text.
			console.error('Could not read the sponsors', problem);
		}
	}
	// The link to give shows only while gifts are open: no one is asked for
	// money before the project has chosen who receives it (docs/sponsorship.md).
	return { ...(await aboutPage('sponsor')), sponsors, giftsOpen: state.open };
};
