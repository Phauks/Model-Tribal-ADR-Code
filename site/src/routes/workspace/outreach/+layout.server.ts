import { listTemplates, outreachCounts } from '#lib/server/mail/outreach.ts';
import { mailContext } from '#lib/server/mail/runtime.ts';
import { requirePermission } from '#lib/server/workspace.ts';
import type { LayoutServerLoad } from './$types';

// Outreach's own left column, laid out as the inbox's (site/MAIL.md,
// "Outreach"; design/outreach-redesign, approved by Trevor on Nov. 27, 2026):
// New batch, the views with their counts, the templates, and the
// do-not-email list and settings.
export const prerender = false;

export const load: LayoutServerLoad = async (event) => {
	requirePermission(event, 'send-outreach');
	event.depends('outreach:counts');
	const context = mailContext();
	const [counts, templates] = await Promise.all([outreachCounts(context), listTemplates(context)]);
	return {
		outreachCounts: counts,
		outreachTemplates: templates.map(({ identifier, name, version }) => ({ identifier, name, version }))
	};
};
