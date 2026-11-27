// The New batch page's form, read the same way when it saves itself as a draft (../drafts/save/+server.ts) and when it starts or schedules the batch (+page.server.ts).
import { zonedTimeToUtc } from '#lib/mail.ts';
import type { MailContext } from '#lib/server/mail/context.ts';
import { listInboxes } from '#lib/server/mail/inboxes.ts';
import type { AudienceFilter, BatchDraft } from '#lib/server/mail/outreach.ts';

export const addressLabels = ['general-office', 'leader', 'state-listed'] as const;

function read(values: URLSearchParams | FormData, name: string, limit = 200): string | null {
	const value = values.get(name);
	return typeof value === 'string' ? value.slice(0, limit) : null;
}

/** Who the batch reaches: contacts linked to a nation unless "Every contact" is chosen, with a tag and a kind of address if chosen. */
export function filterOf(values: URLSearchParams | FormData): AudienceFilter {
	const label = read(values, 'label');
	return {
		tag: read(values, 'tag', 60)?.trim() || null,
		label: label && (addressLabels as readonly string[]).includes(label) ? label : null,
		nationsOnly: read(values, 'nations') !== 'any'
	};
}

/** Whether the address carries a filter of its own, which then wins over a draft's saved one. */
export function hasFilter(values: URLSearchParams): boolean {
	return values.has('tag') || values.has('label') || values.has('nations');
}

function whole(values: FormData, name: string, fallback: number): number {
	const value = Number(read(values, name, 10) ?? fallback);
	return Number.isFinite(value) ? value : fallback;
}

/** The batch as written, for saveBatchDraft. Reply addresses not in `replyChoices` are dropped. */
export function draftOf(form: FormData, replyChoices: readonly string[]): BatchDraft {
	const zone = read(form, 'zone', 60) || 'America/Denver';
	const startsLocal = read(form, 'startsAt', 30)?.trim() ?? '';
	let startsAt: string | null = null;
	try {
		startsAt = startsLocal ? zonedTimeToUtc(startsLocal, zone) : null;
	} catch {
		startsAt = null;
	}
	const replyTo = read(form, 'replyTo', 200)?.trim().toLowerCase() ?? '';
	return {
		identifier: read(form, 'draft', 100) || null,
		name: read(form, 'name', 120)?.trim() || 'New batch',
		templateIdentifier: read(form, 'template', 100) || null,
		subject: read(form, 'subject', 300) ?? '',
		body: read(form, 'body', 20_000) ?? '',
		perDay: whole(form, 'perDay', 40),
		windowStartHour: whole(form, 'windowStart', 9),
		windowEndHour: whole(form, 'windowEnd', 15),
		weekdaysOnly: form.get('weekdaysOnly') === 'yes',
		followUpDays: form.get('followUp') === 'yes' ? whole(form, 'followUpDays', 10) : null,
		askAcknowledgment: form.get('askAcknowledgment') === 'yes',
		startsAt,
		replyAddress: replyChoices.includes(replyTo) ? replyTo : null,
		audience: filterOf(form)
	};
}

/** Every address an outreach letter's replies may go to: each inbox's, and the one set for outreach. */
export async function replyChoicesOf(context: MailContext) {
	const inboxes = (await listInboxes(context)).filter((inbox) => inbox.address);
	const choices = inboxes.map((inbox) => ({ value: inbox.address!.toLowerCase(), label: `${inbox.name} ${inbox.localPart}@` }));
	const configured = context.settings.outreach?.replyTo?.toLowerCase() ?? null;
	if (configured && !choices.some((choice) => choice.value === configured)) choices.push({ value: configured, label: configured });
	return { choices, fallback: configured ?? choices[0]?.value ?? null };
}
