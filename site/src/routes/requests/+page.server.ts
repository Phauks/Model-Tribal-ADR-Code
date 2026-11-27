import { fail } from '@sveltejs/kit';
import { reviewSubjects } from 'virtual:review-subjects';
import { isRequestKind } from '#lib/requests.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { BodyTooLarge, formWithin } from '#lib/server/limited-body.ts';
import { maximumFileBytes, maximumFiles, readRequestForm } from '#lib/server/request-form.ts';
import { saveRequest } from '#lib/server/request-store.ts';
import { checkTurnstile, turnstileActions, turnstileProblem } from '#lib/server/turnstile.ts';
import type { Actions, PageServerLoad } from './$types';

// The form is answered by the Worker, so it cannot be built ahead of time.
export const prerender = false;

/**
 * Pages link here with the record and field already filled in
 * (docs/requests.md, "Where the request starts"), for example
 * /requests?record=tribes/sample-nation&field=recognition.
 */
export const load: PageServerLoad = ({ url }) => {
	const kind = url.searchParams.get('kind');
	const record = (url.searchParams.get('record') ?? '').slice(0, 200);
	const field = (url.searchParams.get('field') ?? '').slice(0, 200);
	const material = record ? (field ? `${record} (${field})` : record) : '';
	const nationIdentifier = record.startsWith('tribes/') ? record.slice('tribes/'.length) : '';
	// From a claimed nation page's badge: a message to the nation's team.
	const nation = reviewSubjects.find((subject) => subject.kind === 'nation' && subject.identifier === nationIdentifier);
	const toTeam = url.searchParams.get('to') === 'team' && nation !== undefined && kind === 'question';
	return {
		toTeam,
		teamPage: toTeam && nation?.page ? { title: nation.title, link: nation.page } : undefined,
		kind: isRequestKind(kind) ? kind : undefined,
		record,
		field,
		material,
		nationIdentifier
	};
};

/** The largest form the request form takes: its files at their largest, and a megabyte for the text and the form's own wrapping. */
const largestForm = maximumFiles * maximumFileBytes + 1024 * 1024;

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
