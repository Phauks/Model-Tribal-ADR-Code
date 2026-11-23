import { workerEnvironment } from '#lib/server/environment.ts';
import { allSponsors, giftSettingChecks, giftState, publicMode } from '#lib/server/sponsors.ts';
import { requirePermission, storage } from '#lib/server/workspace.ts';
import { dollars } from '#lib/sponsorship.ts';
import type { PageServerLoad } from './$types';

// Every sponsor, and whether gifts work and why not (docs/sponsorship.md,
// "Diagnosing"). The lead author only. From here each sponsor's own
// Account page opens as its managers see it.
export const load: PageServerLoad = async (event) => {
	requirePermission(event, 'manage-sponsors');
	const environment = workerEnvironment();
	const state = giftState(environment);
	const mode = publicMode(state);
	const sponsors = await allSponsors(storage(event).database, mode);
	return {
		checks: giftSettingChecks(environment),
		open: state.open,
		mode: state.open ? state.mode : null,
		publicMode: mode,
		reason: state.open ? null : state.reason,
		webhookAddress: `${event.url.origin}/sponsorship/payment-webhook`,
		sponsors: sponsors.map((overview) => ({
			identifier: overview.sponsor.identifier,
			name: overview.sponsor.name,
			slug: overview.sponsor.slug,
			listing: overview.sponsor.listing,
			managers: overview.managers,
			shown: overview.status.shown,
			reason: overview.status.reason,
			test: {
				count: overview.gifts.test.count,
				total: dollars(overview.gifts.test.totalCents)
			},
			live: {
				count: overview.gifts.live.count,
				total: dollars(overview.gifts.live.totalCents)
			},
			stripeTest: Boolean(overview.sponsor.stripeCustomerTest),
			stripeLive: Boolean(overview.sponsor.stripeCustomerLive)
		}))
	};
};
