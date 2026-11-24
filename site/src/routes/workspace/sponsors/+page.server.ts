import { fail } from '@sveltejs/kit';
import { workerEnvironment } from '#lib/server/environment.ts';
import { allSponsors, giftSettingChecks, giftState, publicMode } from '#lib/server/sponsors.ts';
import { saveSponsorshipCosts, sponsorshipCosts } from '#lib/server/sponsorship-goals.ts';
import { levelAmounts, saveLevelAmounts } from '#lib/server/sponsorship-levels.ts';
import { formText, requirePermission, storage } from '#lib/server/workspace.ts';
import { centsFromDollars, costItems, dollars, largestGift, type CostItem } from '#lib/sponsorship.ts';
import { levelAmountsProblem, levels, type Level, type LevelAmounts } from '#lib/sponsorship-levels.ts';
import type { Actions, PageServerLoad } from './$types';

// Every sponsor, and whether gifts work and why not (docs/sponsorship.md,
// "Diagnosing"). The lead author only. From here each sponsor's own
// Account page opens as its managers see it.
export const load: PageServerLoad = async (event) => {
	requirePermission(event, 'manage-sponsors');
	const environment = workerEnvironment();
	const state = giftState(environment);
	const mode = publicMode(state);
	const { database } = storage(event);
	const [sponsors, costs, amounts] = await Promise.all([allSponsors(database, mode), sponsorshipCosts(database), levelAmounts(database)]);
	return {
		costs: Object.fromEntries(costItems.map((item) => [item, costs[item] ? (costs[item] / 100).toFixed(2) : ''])) as Record<CostItem, string>,
		levelAmounts: Object.fromEntries(levels.map((level) => [level, (amounts[level] / 100).toFixed(2)])) as Record<Level, string>,
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

export const actions: Actions = {
	/**
	 * Sets what each thing a gift can fund costs, for the Sponsorship page
	 * (docs/sponsorship.md, "The Sponsorship page"). A blank box takes that
	 * cost off the page.
	 */
	costs: async (event) => {
		const person = requirePermission(event, 'manage-sponsors');
		const form = await event.request.formData();
		const costs = {} as Record<CostItem, number | null>;
		for (const item of costItems) {
			const text = formText(form, item, 20)?.trim();
			if (!text) {
				costs[item] = null;
				continue;
			}
			const cents = centsFromDollars(text);
			if (cents === null || cents <= 0 || cents > largestGift * 100)
				return fail(400, { problem: `Write each cost in dollars and cents, up to ${dollars(largestGift * 100)}, or leave it blank.` });
			costs[item] = cents;
		}
		await saveSponsorshipCosts(storage(event).database, costs, `The project (${person.displayName})`);
		return { done: 'Saved. The Sponsorship page shows the new costs.' };
	},

	/**
	 * Sets what each sponsorship level costs a month, for the Sponsorship
	 * levels page (docs/sponsorship.md, "Levels"). A year costs ten months.
	 */
	levels: async (event) => {
		const person = requirePermission(event, 'manage-sponsors');
		const form = await event.request.formData();
		const amounts = {} as LevelAmounts;
		for (const level of levels) {
			const cents = centsFromDollars(formText(form, `level-${level}`, 20)?.trim() ?? '');
			if (cents === null || cents <= 0 || cents > largestGift * 100)
				return fail(400, { levelProblem: `Write each level's amount in dollars and cents, up to ${dollars(largestGift * 100)} a month.` });
			amounts[level] = cents;
		}
		const problem = levelAmountsProblem(amounts);
		if (problem) return fail(400, { levelProblem: problem });
		await saveLevelAmounts(storage(event).database, amounts, `The project (${person.displayName})`);
		return { levelsDone: 'Saved. The Sponsorship levels page shows the new amounts.' };
	}
};
