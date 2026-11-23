import { fail } from '@sveltejs/kit';
import { reviewSubjects } from 'virtual:review-subjects';
import { pageParts, proofRoutes, type PagePart, type ProofRoute } from '#lib/nation-teams.ts';
import { applicationsOf, placesOf, saveApplication, withdrawApplication } from '#lib/server/nation-teams.ts';
import { readFile } from '#lib/server/request-form.ts';
import { formText, requireAccount, storage } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad } from './$types';

const nations = reviewSubjects
	.filter((subject) => subject.kind === 'nation')
	.map((subject) => ({ identifier: subject.identifier, title: subject.title }))
	.sort((first, second) => first.title.localeCompare(second.title, 'en-US'));

/** At most this many requests can wait at once, so the form cannot be used to flood the project. */
const openLimit = 3;

export const load: PageServerLoad = async (event) => {
	const account = requireAccount(event);
	const { database } = storage(event);
	const person = event.locals.person;
	return {
		nations,
		applications: await applicationsOf(database, account.subject),
		places: person ? await placesOf(database, person.identifier) : [],
		chosenNation: event.url.searchParams.get('nation') ?? ''
	};
};

export const actions: Actions = {
	send: async (event) => {
		const account = requireAccount(event);
		const { database, bucket } = storage(event);
		const form = await event.request.formData();
		const errors: Record<string, string> = {};

		const nationIdentifier = formText(form, 'nation', 200) ?? '';
		if (!nations.some((nation) => nation.identifier === nationIdentifier)) errors.nation = 'Choose your nation from the list.';
		const displayName = formText(form, 'name', 200);
		if (!displayName) errors.name = 'Give the name the nation’s office will know you by.';
		const office = formText(form, 'office', 300);
		if (!office) errors.office = 'Give your title or office at the nation.';
		const route = formText(form, 'route') as ProofRoute | null;
		if (!route || !proofRoutes.includes(route)) errors.route = 'Choose how your nation chose you.';
		const whole = formText(form, 'scope') !== 'parts';
		const chosenParts = form.getAll('parts').filter((part): part is PagePart => pageParts.includes(part as PagePart));
		if (!whole && chosenParts.length === 0) errors.parts = 'Choose at least one part of the page, or the whole page.';
		const details = formText(form, 'details', 4000);
		const proof = await readFile(form, 'proof', errors);
		if ((route === 'letter' || route === 'resolution') && !proof && !errors.proof) {
			errors.proof =
				route === 'letter'
					? 'Upload the letter, as a PDF or a photo.'
					: 'Upload the resolution or order, as a PDF or a photo.';
		}

		const waiting = (await applicationsOf(database, account.subject)).filter(
			(application) => application.status === 'received' || application.status === 'confirming-with-nation'
		);
		if (waiting.some((application) => application.nationIdentifier === nationIdentifier)) {
			errors.nation = 'You already have a request waiting for this nation. You can withdraw it below.';
		} else if (waiting.length >= openLimit) {
			errors.nation = `You have ${openLimit} requests waiting. Withdraw one, or wait for an answer.`;
		}

		if (Object.keys(errors).length > 0 || !displayName || !office || !route) {
			return fail(400, { errors, values: Object.fromEntries([...form.entries()].filter(([, value]) => typeof value === 'string')) });
		}

		const reference = await saveApplication(database, bucket, {
			accountIdentifier: account.subject,
			email: account.email,
			displayName,
			nationIdentifier,
			office,
			route,
			parts: whole ? null : chosenParts,
			details,
			proof
		});
		return { sent: reference };
	},

	withdraw: async (event) => {
		const account = requireAccount(event);
		const { database } = storage(event);
		const form = await event.request.formData();
		const application = (await applicationsOf(database, account.subject)).find(
			(found) => found.reference === formText(form, 'reference', 40)
		);
		if (!application || (application.status !== 'received' && application.status !== 'confirming-with-nation')) {
			return fail(404, { problem: 'That request has already been answered or withdrawn.' });
		}
		await withdrawApplication(database, application);
		return { withdrawn: application.reference };
	}
};
