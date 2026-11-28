import { fail, redirect } from '@sveltejs/kit';
import { maximumRequestFiles } from '#lib/requests.ts';
import { oldRequestTarget } from '#lib/report-request.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { BodyTooLarge, formWithin } from '#lib/server/limited-body.ts';
import { maximumFileBytes, readRequestForm, sourceSlots } from '#lib/server/request-form.ts';
import { saveRequest } from '#lib/server/request-store.ts';
import { checkTurnstile, turnstileActions, turnstileProblem } from '#lib/server/turnstile.ts';
import type { Actions, PageServerLoad } from './$types';

// The form is answered by the Worker, so it cannot be built ahead of time.
export const prerender = false;

/**
 * Where Request a Change sends its form (src/lib/components/RequestChange.svelte).
 * The request page that was here is gone: the site has one way to ask for a
 * change, the masthead's dialog (Trevor, Nov. 28, 2026). An old address such
 * as /requests?kind=remove&record=copies/<key>, which saved copies of court
 * opinions still carry, goes to the record's page with the dialog open and
 * filled in the same way (src/lib/report-request.ts).
 */
export const load: PageServerLoad = ({ url, request }) => {
	redirect(request.method === 'GET' ? 301 : 303, oldRequestTarget(url));
};

/** The largest form the request form takes: its files (or a missing nation's source copies) at their largest, and a megabyte for the text and the form's own wrapping. */
const largestForm = Math.max(maximumRequestFiles, sourceSlots) * maximumFileBytes + 1024 * 1024;

export const actions: Actions = {
	default: async ({ request, getClientAddress }) => {
		const environment = workerEnvironment();
		if (!environment.database || !environment.sourceDocuments) {
			return fail(503, {
				problem:
					'The request form cannot save requests right now. Please try again later, or use the interim route in docs/requests.md.'
			});
		}

		const limiter = environment.requestFormLimit;
		if (limiter) {
			const { success } = await limiter.limit({ key: getClientAddress() });
			if (!success) {
				return fail(429, {
					problem: 'Too many requests were sent from this connection. Please wait a minute and try again.'
				});
			}
		}

		let form: FormData;
		try {
			form = await formWithin(request, largestForm);
		} catch (problem) {
			if (problem instanceof BodyTooLarge) {
				return fail(413, { problem: `The files are too large. Each file can be up to ${maximumFileBytes / 1024 / 1024} MB.` });
			}
			return fail(400, { problem: 'The form could not be read. Please try again.' });
		}

		// Cloudflare's "are you a person?" check, when it is on (src/lib/server/turnstile.ts).
		const person = await checkTurnstile(environment, form, turnstileActions.request, request.headers.get('cf-connecting-ip'));
		if (person.outcome === 'refused') {
			console.warn(`Turnstile refused a request: ${person.reason}`);
			return fail(403, { problem: turnstileProblem });
		}

		const result = await readRequestForm(form);
		if (!result.ok) {
			if (result.spam) return fail(400, { problem: 'The request could not be sent.' });
			return fail(400, { errors: result.errors, values: result.values });
		}

		const reference = await saveRequest(environment.database, environment.sourceDocuments, result.request);
		return {
			sent: {
				reference,
				kind: result.request.kind,
				receivedAt: new Date().toISOString()
			}
		};
	}
};
