import { error, fail } from '@sveltejs/kit';
import { workerEnvironment } from '#lib/server/environment.ts';
import {
	giftState,
	giftsOf,
	historyOf,
	managersOf,
	openInvitations,
	publicMode,
	publicStatus,
	setHiddenByProject,
	sponsorByIdentifier,
	stripeCustomerFor
} from '#lib/server/sponsors.ts';
import { customerExists, monthlyGifts } from '#lib/server/stripe.ts';
import { formText, requirePermission, storage } from '#lib/server/workspace.ts';
import { dollars, earmarkLabels, isEarmark, listingLabels } from '#lib/sponsorship.ts';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

// One sponsor, for the lead author to find what is wrong (docs/sponsorship.md,
// "Diagnosing"): their settings, managers, gifts with amounts, history,
// and what Stripe says when asked.
async function loadSponsor(event: RequestEvent | Parameters<PageServerLoad>[0]) {
	const person = requirePermission(event, 'manage-sponsors');
	const { database } = storage(event);
	const sponsor = await sponsorByIdentifier(database, event.params.identifier);
	if (!sponsor) error(404, 'No sponsor has this address.');
	return { person, database, sponsor };
}

export const load: PageServerLoad = async (event) => {
	const { database, sponsor } = await loadSponsor(event);
	const state = giftState(workerEnvironment());
	const mode = publicMode(state);
	const [managers, invitations, gifts, history] = await Promise.all([
		managersOf(database, sponsor.identifier),
		openInvitations(database, sponsor.identifier),
		giftsOf(database, sponsor.identifier),
		historyOf(database, sponsor.identifier, 100)
	]);
	return {
		sponsor: {
			identifier: sponsor.identifier,
			name: sponsor.name,
			slug: sponsor.slug,
			link: sponsor.link,
			oneLine: sponsor.oneLine,
			hasLogo: Boolean(sponsor.logoKey),
			listing: listingLabels[sponsor.listing],
			earmark: earmarkLabels[sponsor.earmark],
			stripeCustomerTest: sponsor.stripeCustomerTest,
			stripeCustomerLive: sponsor.stripeCustomerLive,
			hiddenByProject: sponsor.hiddenByProject,
			hiddenNote: sponsor.hiddenNote,
			createdAt: sponsor.createdAt,
			updatedAt: sponsor.updatedAt
		},
		status: publicStatus(
			sponsor,
			gifts.some((gift) => gift.mode === mode)
		),
		publicMode: mode,
		giftsOpen: state.open,
		managers,
		invitations,
		gifts: gifts.map((gift) => ({
			...gift,
			amount: dollars(gift.amountCents),
			earmark: isEarmark(gift.earmark) ? earmarkLabels[gift.earmark] : gift.earmark
		})),
		history
	};
};

export const actions: Actions = {
	/** Takes the sponsor off the public pages, with a note for the sponsor's history. */
	hide: async (event) => {
		const { person, database, sponsor } = await loadSponsor(event);
		const note = formText(await event.request.formData(), 'note', 500);
		if (!note) return fail(400, { problem: 'Say why, for the sponsor’s history.' });
		await setHiddenByProject(database, sponsor, true, note, {
			account: null,
			name: `The project (${person.displayName})`
		});
		return { done: 'Taken off the public pages.' };
	},

	show: async (event) => {
		const { person, database, sponsor } = await loadSponsor(event);
		await setHiddenByProject(database, sponsor, false, null, {
			account: null,
			name: `The project (${person.displayName})`
		});
		return {
			done: 'Back on the public pages, if their listing and gifts allow it.'
		};
	},

	/** Asks Stripe about the sponsor's customer and monthly gifts, as the sponsor's page would. */
	check: async (event) => {
		const { sponsor } = await loadSponsor(event);
		const state = giftState(workerEnvironment());
		if (!state.open)
			return fail(400, {
				problem: 'Gifts are off, so the site does not call Stripe. See the settings on the Sponsors page.'
			});
		const customer = stripeCustomerFor(sponsor, state.mode);
		if (!customer)
			return {
				stripe: [`No Stripe customer in ${state.mode} mode yet. One is made the first time a manager presses “Continue to payment”.`]
			};
		const lines: string[] = [];
		try {
			const found = await customerExists(state.stripe, customer);
			lines.push(
				found.deleted ? `Customer ${customer} was deleted in Stripe.` : `Customer ${customer} exists in Stripe${found.email ? `, email ${found.email}` : ''}.`
			);
			const monthly = await monthlyGifts(state.stripe, customer);
			if (monthly.length === 0) lines.push('No monthly gift.');
			for (const gift of monthly) {
				lines.push(
					`Subscription ${gift.identifier}: ${dollars(gift.amountInCents)} a ${gift.interval}, status ${gift.status}${gift.cancelAtPeriodEnd ? ', ends at the end of the period' : ''}${gift.nextPayment ? `, period ends ${gift.nextPayment.slice(0, 10)}` : ''}.`
				);
			}
		} catch (problem) {
			lines.push(`Stripe refused: ${problem instanceof Error ? problem.message : String(problem)}`);
		}
		return { stripe: lines };
	}
};
