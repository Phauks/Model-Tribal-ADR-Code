import { sponsorshipCounts } from 'virtual:sponsorship-counts';
import { aboutPage } from '#lib/server/about-pages.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { giftState, publicMode, publicSponsors, type PublicSponsor } from '#lib/server/sponsors.ts';
import { givenToward, sponsorshipCosts, sponsorshipGoals, type SponsorshipCosts, type GivenToward } from '#lib/server/sponsorship-goals.ts';
import type { PageServerLoad } from './$types';

// Edited on the website like the essays (content/about/README.md), so the
// Worker renders it. Below the text: the goal of a printed copy for every
// nation, what else a gift can fund, and the sponsors who have given and
// chose to be listed (docs/sponsorship.md, "The Sponsorship page").
export const prerender = false;

const nothingGiven: GivenToward = {
	total: { 'needed-most': 0, 'books-for-nations': 0, 'large-format': 0, hosting: 0 },
	siteLastYear: 0
};

export const load: PageServerLoad = async () => {
	const environment = workerEnvironment();
	const state = giftState(environment);
	const mode = publicMode(state);
	let sponsors: PublicSponsor[] = [];
	let costs: SponsorshipCosts = {};
	let given = nothingGiven;
	if (environment.database) {
		const database = environment.database;
		// Before the sponsor tables exist the page still shows its text.
		[sponsors, costs, given] = await Promise.all([
			publicSponsors(database, mode).catch((problem) => {
				console.error('Could not read the sponsors', problem);
				return [];
			}),
			sponsorshipCosts(database).catch((problem) => {
				console.error('Could not read the sponsorship costs', problem);
				return {};
			}),
			givenToward(database, mode).catch((problem) => {
				console.error('Could not total the gifts', problem);
				return nothingGiven;
			})
		]);
	}
	// The link to give shows only while gifts are open: no one is asked for
	// money before the project has chosen who receives it (docs/sponsorship.md).
	return {
		...(await aboutPage('sponsor')),
		sponsors,
		giftsOpen: state.open,
		receiver: state.open ? state.receiver : null,
		counts: sponsorshipCounts,
		goals: sponsorshipGoals(sponsorshipCounts, costs, given)
	};
};
