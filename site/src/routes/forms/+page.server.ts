import { forms } from 'virtual:forms';
import { formGroups } from '#lib/forms.ts';
import type { PageServerLoad } from './$types';

// The list of forms, built ahead of time from the form files (src/lib/server/form-catalog.ts).
export const load: PageServerLoad = () => ({
	groups: formGroups
		.map((group) => ({
			...group,
			forms: forms
				.filter((form) => form.group === group.group)
				.map(({ slug, title, summary, version }) => ({ slug, title, summary, version }))
		}))
		.filter((group) => group.forms.length > 0)
});
