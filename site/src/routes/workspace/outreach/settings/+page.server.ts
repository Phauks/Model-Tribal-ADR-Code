import { inboxForArrival } from '#lib/server/mail/inboxes.ts';
import { listTemplates, outreachReadiness } from '#lib/server/mail/outreach.ts';
import { mailCarriers, mailContext } from '#lib/server/mail/runtime.ts';
import { requirePermission } from '#lib/server/workspace.ts';
import type { PageServerLoad } from './$types';

// Outreach settings, in Outreach's left column (design/outreach-redesign): whether the outreach mailbox is set up and what is missing, where replies go unless a batch says otherwise, and the templates that were put away. The mailbox itself is set in the environment (site/MAIL.md, "Switching email on"), so this page only shows it.
export const prerender = false;

export const load: PageServerLoad = async (event) => {
	requirePermission(event, 'send-outreach');
	const context = mailContext();
	const outreach = context.settings.outreach;
	const replyInbox = await inboxForArrival(context, outreach?.replyTo ?? null);
	const templates = await listTemplates(context, true);
	return {
		problems: outreachReadiness(context, mailCarriers(context)),
		mailbox: outreach ? { from: outreach.from, host: outreach.host } : null,
		replyTo: outreach?.replyTo ?? null,
		replyInbox: replyInbox ? { name: replyInbox.name, address: replyInbox.address } : null,
		archived: templates.filter((template) => template.archived).map(({ identifier, name, version }) => ({ identifier, name, version }))
	};
};
