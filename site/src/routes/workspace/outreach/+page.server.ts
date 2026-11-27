import { fail } from '@sveltejs/kit';
import { mailNations } from 'virtual:mail-nations';
import { today } from '#lib/address-book.ts';
import { copyBatch, listBatches, nextSendAt, OutreachError, outreachAudience, outreachConversations, outreachReadiness, setBatchStatus, startBatch } from '#lib/server/mail/outreach.ts';
import { currentTime } from '#lib/server/mail/context.ts';
import { mailCarriers, mailContext } from '#lib/server/mail/runtime.ts';
import { requirePermission } from '#lib/server/workspace.ts';
import { isOutreachView } from './views.ts';
import type { Actions, PageServerLoad } from './$types';

// The Outreach page (site/MAIL.md, "Outreach"; design/outreach-redesign):
// the batches as rows like the inbox's conversations, in the view chosen in
// the left column (?view=), or the conversations of answered letters and of
// letters that wait for a follow-up.
export const prerender = false;

const nationNames = new Map(mailNations.map((nation) => [nation.identifier, nation.name]));

export const load: PageServerLoad = async (event) => {
	requirePermission(event, 'send-outreach');
	const context = mailContext();
	const asked = event.url.searchParams.get('view');
	const view = isOutreachView(asked) ? asked : 'all';
	const search = event.url.searchParams.get('q')?.trim().slice(0, 200) || null;
	const problems = outreachReadiness(context, mailCarriers(context));

	if (view === 'replies' || view === 'follow') {
		const conversations = await outreachConversations(context, view, search);
		return {
			view,
			search,
			problems,
			batches: [],
			conversations: conversations.map((item) => ({ ...item, nationName: item.nationIdentifier ? (nationNames.get(item.nationIdentifier) ?? null) : null }))
		};
	}

	const words = search?.toLowerCase();
	const batches = (await listBatches(context)).filter((batch) => {
		const shown =
			view === 'all'
				? batch.stage !== 'cancelled'
				: view === 'drafts'
					? batch.stage === 'draft'
					: view === 'done'
						? batch.stage === 'done' || batch.stage === 'cancelled'
						: batch.stage === view;
		return shown && (!words || `${batch.name}\n${batch.subject}\n${batch.templateName ?? ''}`.toLowerCase().includes(words));
	});
	// What is under way first, then what is waiting to go, then drafts, then what is over; newest first within each.
	const stageOrder = ['sending', 'scheduled', 'paused', 'draft', 'done', 'cancelled'];
	batches.sort((a, b) => stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage));

	// The time zone of each sending batch's next recipient, for "Next …".
	const sending = batches.filter((batch) => batch.stage === 'sending').map((batch) => batch.identifier);
	const zones = new Map<string, string>();
	for (const identifier of sending) {
		const row = await context.database
			.prepare(`SELECT time_zone AS zone FROM outreach_recipients WHERE batch_identifier = ? AND status = 'queued' ORDER BY rowid LIMIT 1`)
			.bind(identifier)
			.first<{ zone: string }>();
		if (row) zones.set(identifier, row.zone);
	}
	// Who each draft would reach, counted as the New batch page counts it (at most ten drafts are counted).
	const reach = new Map<string, { recipients: number; leftOut: number }>();
	for (const batch of batches.filter((item) => item.stage === 'draft' && item.audience).slice(0, 10)) {
		const audience = await outreachAudience(context, batch.audience!, today());
		reach.set(batch.identifier, { recipients: audience.recipients.length, leftOut: audience.leftOut.reduce((sum, group) => sum + group.count, 0) });
	}
	const now = currentTime(context);

	return {
		view,
		search,
		problems,
		conversations: [],
		batches: batches.map((batch) => {
			const count = (status: string) => batch.counts[status] ?? 0;
			const sent = count('sent') + count('replied') + count('bounced') + count('unsubscribed');
			const total = sent + count('queued') + count('failed');
			const zone = zones.get(batch.identifier);
			return {
				identifier: batch.identifier,
				name: batch.name,
				stage: batch.stage,
				template: batch.templateName ? `${batch.templateName} (v${batch.templateVersion})` : null,
				sent,
				total,
				replied: count('replied'),
				bounced: count('bounced'),
				reach: reach.get(batch.identifier) ?? null,
				nextAt: zone ? (nextSendAt(batch, zone, now)?.toISOString() ?? null) : null,
				startsAt: batch.startsAt,
				updatedAt: batch.updatedAt,
				finishedAt: batch.finishedAt
			};
		})
	};
};

export const actions: Actions = {
	/** The toolbar over the batches: start now, pause, copy or cancel the ticked ones. */
	bulk: async (event) => {
		const person = requirePermission(event, 'send-outreach');
		const context = mailContext();
		const form = await event.request.formData();
		const ticked = form.getAll('batch').filter((value): value is string => typeof value === 'string').slice(0, 100);
		const action = form.get('do');
		if (ticked.length === 0) return fail(400, { problem: 'Tick a batch first.' });
		try {
			for (const identifier of ticked) {
				if (action === 'start') await startBatch(context, person.identifier, identifier, null);
				else if (action === 'pause') await setBatchStatus(context, person.identifier, identifier, 'paused');
				else if (action === 'cancel') await setBatchStatus(context, person.identifier, identifier, 'cancelled');
				else if (action === 'copy') await copyBatch(context, person.identifier, identifier);
				else return fail(400, { problem: 'Choose what to do.' });
			}
		} catch (problem) {
			if (problem instanceof OutreachError) return fail(400, { problem: problem.message });
			throw problem;
		}
		const words = { start: 'Started', pause: 'Paused', cancel: 'Cancelled', copy: 'Copied as a draft' }[action as string];
		return { done: `${words}: ${ticked.length} ${ticked.length === 1 ? 'batch' : 'batches'}.` };
	}
};
