import { error, fail, redirect } from '@sveltejs/kit';
import { can } from '#lib/permissions.ts';
import { dollars, dollarsAfterTyping, giftCents, giftFrequencies, isEarmark, isListing, largestGift, smallestGift, type Earmark, type GiftFrequency } from '#lib/sponsorship.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import {
	checkedLink,
	createInvitation,
	createSponsor,
	giftState,
	giftsOf,
	historyOf,
	invitationDays,
	isManager,
	logosReady,
	managersOf,
	openInvitations,
	publicMode,
	publicStatus,
	publicView,
	removeLogo,
	removeManager,
	saveListing,
	saveStripeCustomer,
	setEarmark,
	setLogo,
	sponsorByIdentifier,
	sponsorsManagedBy,
	stripeCustomerFor,
	totalsOf,
	withdrawInvitation,
	type Actor,
	type Sponsor
} from '#lib/server/sponsors.ts';
import { createBillingPortal, createCustomer, createGiftCheckout, monthlyGifts, type MonthlyGift } from '#lib/server/stripe.ts';
import { formText, requireAccount, storage } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

/**
 * Sponsorship, on the Account pages (docs/sponsorship.md): an organization's
 * gift and how the project thanks it in public. Everyone who manages the
 * sponsorship can change everything on it.
 *
 * The lead author can open any sponsor's page with ?sponsor=<identifier>,
 * to see it as the sponsor does and find what is wrong. That view only
 * reads: every action below checks that the signed-in account manages the
 * sponsorship.
 */
/**
 * What the Sponsorship page's gift form asked for (src/routes/sponsor/), to
 * fill in the gift form here: an amount, how often, and where the gift goes.
 * Anything not valid is left blank.
 */
function askedGift(search: URLSearchParams): { amount: string; frequency: GiftFrequency | null; toward: Earmark | null } {
	const cents = giftCents(search.get('other') || search.get('amount') || '');
	const frequency = search.get('frequency');
	const toward = search.get('toward');
	return {
		amount: cents === null ? '' : dollarsAfterTyping(String(cents / 100)),
		frequency: giftFrequencies.includes(frequency as GiftFrequency) ? (frequency as GiftFrequency) : null,
		toward: isEarmark(toward) ? toward : null
	};
}

export const load: PageServerLoad = async (event) => {
	const account = requireAccount(event);
	const { database } = storage(event);
	const state = giftState(workerEnvironment());
	const managed = await sponsorsManagedBy(database, account.subject);
	const requested = event.url.searchParams.get('sponsor');
	const mayDiagnose = Boolean(event.locals.person && can(event.locals.person, 'manage-sponsors'));

	let sponsor: Sponsor | null = null;
	let viewingAs = false;
	if (requested) {
		sponsor = managed.find((item) => item.identifier === requested) ?? null;
		if (!sponsor && mayDiagnose) {
			sponsor = await sponsorByIdentifier(database, requested);
			viewingAs = Boolean(sponsor);
		}
		if (!sponsor) error(404, 'There is no sponsorship here, or you do not manage it.');
	} else {
		sponsor = managed[0] ?? null;
	}

	const gifts = {
		open: state.open,
		reason: state.open ? null : state.reason,
		mode: state.open ? state.mode : null,
		receiver: state.open ? state.receiver : null,
		smallest: smallestGift,
		largest: largestGift
	};
	const others = managed.filter((item) => item.identifier !== sponsor?.identifier).map((item) => ({ identifier: item.identifier, name: item.name }));
	const asked = askedGift(event.url.searchParams);
	if (!sponsor) return { sponsor: null, others, gifts, viewingAs, mayDiagnose, asked };

	const shownMode = publicMode(state);
	const [managers, invitations, history, allGifts, readyLogos] = await Promise.all([
		managersOf(database, sponsor.identifier),
		openInvitations(database, sponsor.identifier),
		historyOf(database, sponsor.identifier, 10),
		giftsOf(database, sponsor.identifier),
		logosReady(database, [sponsor])
	]);
	const logoReady = readyLogos.size > 0;
	const modeGifts = allGifts.filter((gift) => gift.mode === (state.open ? state.mode : shownMode));
	const totals = totalsOf(modeGifts);

	// What Stripe says about a monthly gift. If Stripe cannot be reached, the
	// page still opens and says so, and the lead author's page shows why.
	let monthly: MonthlyGift[] = [];
	let stripeProblem: string | null = null;
	const customer = state.open ? stripeCustomerFor(sponsor, state.mode) : null;
	if (state.open && customer) {
		try {
			monthly = await monthlyGifts(state.stripe, customer);
		} catch (problem) {
			console.error('Could not read the sponsor’s subscriptions', problem);
			stripeProblem = 'Stripe could not be reached just now, so your monthly gift is not shown. Try again in a few minutes.';
		}
	}
	const status = publicStatus(
		sponsor,
		allGifts.some((gift) => gift.mode === shownMode)
	);

	return {
		sponsor: {
			identifier: sponsor.identifier,
			slug: sponsor.slug,
			name: sponsor.name,
			link: sponsor.link,
			oneLine: sponsor.oneLine,
			hasLogo: Boolean(sponsor.logoKey),
			// A new logo waits for the virus check (site/SCANNING.md); the preview shows initials until then.
			logoChecking: Boolean(sponsor.logoKey) && !logoReady,
			listing: sponsor.listing,
			earmark: sponsor.earmark,
			createdAt: sponsor.createdAt
		},
		preview: publicView(sponsor, totals.firstAt ?? sponsor.createdAt, logoReady),
		status,
		managers: managers.map((manager) => ({
			...manager,
			you: manager.account === account.subject
		})),
		invitations,
		invitationDays,
		history,
		totals: { ...totals, total: dollars(totals.totalCents) },
		monthly: monthly.map((gift) => ({
			...gift,
			amount: dollars(gift.amountInCents)
		})),
		asked,
		hasStripeCustomer: Boolean(customer),
		stripeProblem,
		others,
		gifts,
		viewingAs,
		mayDiagnose
	};
};

/** The sponsorship a form names, if the signed-in account manages it. The lead author's read-only view cannot change anything. */
async function managedSponsor(event: RequestEvent, form: FormData): Promise<{ sponsor: Sponsor; actor: Actor }> {
	const account = requireAccount(event);
	const { database } = storage(event);
	const identifier = formText(form, 'sponsor', 100);
	const sponsor = identifier ? await sponsorByIdentifier(database, identifier) : null;
	if (!sponsor || !(await isManager(database, sponsor.identifier, account.subject))) {
		error(403, 'Only the people who manage this sponsorship can change it.');
	}
	return { sponsor, actor: { account: account.subject, name: account.email } };
}

const here = (sponsor: Sponsor, anchor = '') => `/account/sponsorship?sponsor=${encodeURIComponent(sponsor.identifier)}${anchor}`;

export const actions: Actions = {
	/** Starts a sponsorship, with the signed-in account as its first manager. */
	start: async (event) => {
		const account = requireAccount(event);
		const { database } = storage(event);
		const form = await event.request.formData();
		const name = formText(form, 'name', 120);
		if (!name)
			return fail(400, {
				problem: 'Give the name of the organization, or your own name if you give as a person.'
			});
		let sponsor = await createSponsor(database, account, name);
		// Carry what the Sponsorship page's gift form asked for on to the gift form.
		const asked = askedGift(new URLSearchParams([...form.entries()].filter((entry): entry is [string, string] => typeof entry[1] === 'string')));
		if (asked.toward) sponsor = await setEarmark(database, sponsor, { account: account.subject, name: account.email }, asked.toward);
		const carried = new URLSearchParams();
		if (asked.amount) carried.set('amount', asked.amount);
		if (asked.frequency) carried.set('frequency', asked.frequency);
		redirect(303, here(sponsor, carried.size > 0 ? `&${carried}` : ''));
	},

	/** Saves the listing, where the gift goes, and the logo. */
	save: async (event) => {
		const form = await event.request.formData();
		const { sponsor, actor } = await managedSponsor(event, form);
		const { database, bucket } = storage(event);
		const name = formText(form, 'name', 120);
		const listing = form.get('listing');
		const earmark = form.get('earmark');
		if (!name) return fail(400, { problem: 'The name cannot be empty.' });
		if (!isListing(listing) || !isEarmark(earmark))
			return fail(400, {
				problem: 'Choose how to be listed and where your gift goes.'
			});
		const link = checkedLink(formText(form, 'link', 400));
		if ('problem' in link) return fail(400, { problem: link.problem });
		const oneLine = formText(form, 'oneLine', 400);
		if (oneLine && oneLine.length > 160)
			return fail(400, {
				problem: 'Keep the line about you to 160 characters.'
			});

		const saved = await saveListing(database, sponsor, actor, {
			name,
			link: link.link,
			oneLine,
			listing,
			earmark
		});
		const logo = form.get('logo');
		if (logo instanceof File && logo.size > 0) {
			const result = await setLogo(database, bucket, saved, actor, new Uint8Array(await logo.arrayBuffer()));
			if ('problem' in result)
				return fail(400, {
					problem: `${result.problem} Everything else was saved.`
				});
		} else if (form.get('removeLogo') === 'yes') {
			await removeLogo(database, bucket, saved, actor);
		}
		return { done: 'Saved.' };
	},

	/** Makes an invitation link, shown once. */
	invite: async (event) => {
		const form = await event.request.formData();
		const { sponsor, actor } = await managedSponsor(event, form);
		const label = formText(form, 'label', 200);
		if (!label)
			return fail(400, {
				problem: 'Say who the link is for, such as their email address, so you can tell invitations apart.'
			});
		const token = await createInvitation(storage(event).database, sponsor, actor, label);
		return {
			done: `Invitation made. Send this link to ${label} yourself. It works once, for ${invitationDays} days, and is not shown again.`,
			invitationLink: `${event.url.origin}/sponsorship/invite/${token}`
		};
	},

	withdraw: async (event) => {
		const form = await event.request.formData();
		const { sponsor, actor } = await managedSponsor(event, form);
		const invitation = formText(form, 'invitation', 100);
		if (invitation) await withdrawInvitation(storage(event).database, sponsor, actor, invitation);
		return { done: 'Invitation withdrawn. The link no longer works.' };
	},

	/** Takes someone off the sponsorship, or the signed-in person themselves. */
	remove: async (event) => {
		const form = await event.request.formData();
		const { sponsor, actor } = await managedSponsor(event, form);
		const account = formText(form, 'account', 100);
		if (!account) return fail(400, { problem: 'Choose who to remove.' });
		const result = await removeManager(storage(event).database, sponsor, actor, account);
		if (result === 'last-manager') {
			return fail(400, {
				problem: 'You are the only person who manages this sponsorship. Invite someone else first, or write to the project to close it.'
			});
		}
		if (account === actor.account) redirect(303, '/account/sponsorship');
		return { done: 'Removed.' };
	},

	/** Sends the sponsor to Stripe's page to give. */
	give: async (event) => {
		const form = await event.request.formData();
		const { sponsor, actor } = await managedSponsor(event, form);
		const state = giftState(workerEnvironment());
		if (!state.open) return fail(400, { problem: state.reason });
		const cents = giftCents(formText(form, 'amount', 20) ?? '');
		const frequency = form.get('frequency') as GiftFrequency;
		if (!giftFrequencies.includes(frequency)) return fail(400, { problem: 'Choose how often to give.' });
		if (cents === null) {
			return fail(400, {
				problem: `Give an amount from ${dollars(smallestGift * 100)} to ${dollars(largestGift * 100)}. For a larger gift, write to the project.`
			});
		}
		const { database } = storage(event);
		const earmark = form.get('earmark');
		// Where this gift goes, chosen beside the amount; Stripe's report records it with the gift.
		if (isEarmark(earmark)) await setEarmark(database, sponsor, actor, earmark);
		let customer = stripeCustomerFor(sponsor, state.mode);
		let address: string;
		try {
			if (!customer) {
				customer = await createCustomer(state.stripe, {
					name: sponsor.name,
					email: actor.name,
					sponsor: sponsor.identifier
				});
				await saveStripeCustomer(database, sponsor, state.mode, customer, actor);
			}
			address = await createGiftCheckout(state.stripe, {
				customer,
				sponsor: sponsor.identifier,
				amountInCents: cents,
				every: frequency === 'monthly' ? 'month' : frequency === 'yearly' ? 'year' : null,
				description: `Gift to Tribal Law Project from ${sponsor.name}`,
				successAddress: `${event.url.origin}${here(sponsor, '&gift=thanks')}`,
				cancelAddress: `${event.url.origin}${here(sponsor)}`
			});
		} catch (problem) {
			console.error('Stripe refused a gift checkout', problem);
			return fail(502, {
				problem: 'Stripe could not open its payment page just now. Nothing was charged. Try again in a few minutes.'
			});
		}
		redirect(303, address);
	},

	/** Sends the sponsor to Stripe's own billing page. */
	billing: async (event) => {
		const form = await event.request.formData();
		const { sponsor } = await managedSponsor(event, form);
		const state = giftState(workerEnvironment());
		if (!state.open) return fail(400, { problem: state.reason });
		const customer = stripeCustomerFor(sponsor, state.mode);
		if (!customer)
			return fail(400, {
				problem: 'There is nothing to change yet. Your billing settings appear after your first gift.'
			});
		let address: string;
		try {
			address = await createBillingPortal(state.stripe, customer, `${event.url.origin}${here(sponsor)}`);
		} catch (problem) {
			console.error('Stripe refused a billing page', problem);
			return fail(502, {
				problem: 'Stripe could not open your billing page just now. Try again in a few minutes.'
			});
		}
		redirect(303, address);
	}
};
