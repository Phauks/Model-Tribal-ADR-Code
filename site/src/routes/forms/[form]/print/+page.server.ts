import { error } from '@sveltejs/kit';
import { forms } from 'virtual:forms';
import { formHtml, isSendable } from '#lib/forms.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

// A blank copy of each form to print and fill in by hand, built ahead of time.
export const entries: EntryGenerator = () => forms.map((form) => ({ form: form.slug }));

export const load: PageServerLoad = ({ params }) => {
	const form = forms.find((entry) => entry.slug === params.form);
	if (!form) error(404, 'There is no form with this name.');
	return {
		slug: form.slug,
		title: form.title,
		version: form.version,
		sendable: isSendable(form),
		html: formHtml(form, 'blank')
	};
};
