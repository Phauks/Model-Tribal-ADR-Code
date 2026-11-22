import { error, fail, type RequestEvent } from '@sveltejs/kit';
import { forms } from 'virtual:forms';
import { isSendable, type FormTemplate } from '#lib/forms.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { readOnlineForm, readUploadedForm, type SentForm } from '#lib/server/form-submissions.ts';
import { saveRequest } from '#lib/server/request-store.ts';
import type { Actions, PageServerLoad } from './$types';

// A form sent from this page is answered by the Worker, so the page cannot be built ahead of time.
export const prerender = false;

function templateFor(slug: string): FormTemplate {
	const template = forms.find((form) => form.slug === slug);
	if (!template) error(404, 'There is no form with this name.');
	return template;
}

export const load: PageServerLoad = ({ params }) => {
	const template = templateFor(params.form);
	return {
		template: { ...template, markdown: '' },
		sendable: isSendable(template)
	};
};

/** Checks, reads and saves a form sent in either way. */
async function send(
	event: RequestEvent<{ form: string }>,
	read: (template: FormTemplate, form: FormData) => SentForm | Promise<SentForm>,
	way: 'online' | 'upload'
) {
	const template = templateFor(event.params.form);
	if (!isSendable(template)) return fail(400, { way, problem: 'This form is for printing only. Nothing is sent.' });

	const environment = workerEnvironment();
	if (!environment.database || !environment.sourceDocuments) {
		return fail(503, {
			way,
			problem: 'Forms cannot be received right now. Please try again later, or print the form and keep it until then.'
		});
	}
	const limiter = environment.requestFormLimit;
	if (limiter) {
		const { success } = await limiter.limit({ key: event.getClientAddress() });
		if (!success) {
			return fail(429, { way, problem: 'Too many forms were sent from this connection. Please wait a minute and try again.' });
		}
	}

	let data: FormData;
	try {
		data = await event.request.formData();
	} catch {
		return fail(400, { way, problem: 'The form could not be read. Please try again.' });
	}
	const result = await read(template, data);
	if (!result.ok) {
		if (result.spam) return fail(400, { way, problem: 'The form could not be sent.' });
		return fail(400, { way, errors: result.errors, values: result.values });
	}

	const reference = await saveRequest(
		environment.database,
		environment.sourceDocuments,
		result.request,
		result.submission
	);
	return {
		sent: {
			reference,
			way,
			receivedAt: new Date().toISOString(),
			answers: result.answers,
			senderName: result.request.requesterName ?? ''
		}
	};
}

export const actions: Actions = {
	send: (event) => send(event, readOnlineForm, 'online'),
	upload: (event) => send(event, readUploadedForm, 'upload')
};
