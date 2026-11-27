import { fail } from '@sveltejs/kit';
import { mergeFields } from '#lib/mail.ts';
import { mailContext } from '#lib/server/mail/runtime.ts';
import {
	awayAnswers,
	deleteSavedReply,
	getAway,
	getUndoSeconds,
	listSavedReplies,
	listSignatures,
	saveAway,
	saveSavedReply,
	saveSignature,
	setUndoSeconds,
	undoChoices,
	WritingError
} from '#lib/server/mail/writing.ts';
import { currentTime } from '#lib/server/mail/context.ts';
import { blockSender, listBlocked, SenderError, unblockSender } from '#lib/server/mail/senders.ts';
import { can } from '#lib/permissions.ts';
import { requireMail } from '#lib/server/mail/inbox-access.ts';
import {
	addInboxAddress,
	addInboxMember,
	createInbox,
	deleteInbox,
	InboxError,
	inboxCandidates,
	inboxesForManaging,
	makeCatchAll,
	removeInboxAddress,
	removeInboxMember,
	renameInbox,
	setInboxAlerts
} from '#lib/server/mail/inboxes.ts';
import { formText, requirePermission } from '#lib/server/workspace.ts';
import { whenFromForm } from '../compose.ts';
import type { Actions, PageServerLoad } from './$types';

// Settings for the project inbox (site/MAIL.md, "Inboxes" and "Writing"):
// the inboxes and who is on each, the signature of each address, saved
// replies, the pause before a message goes (undo send), and the away
// message. They belong to the whole project, so only someone who manages
// mail changes them. Anyone else on an inbox sees only the Inboxes card,
// with the inboxes they are on, where they choose their own new-mail alerts
// (site/MAIL.md, "New-mail alerts") and can leave a shared inbox.
export const prerender = false;

export const load: PageServerLoad = async (event) => {
	const person = await requireMail(event);
	const context = mailContext();
	const canManage = can(person, 'manage-mail');
	const shown = (inbox: Awaited<ReturnType<typeof inboxesForManaging>>[number]) => ({
		...inbox,
		// What a manager sees of someone else's personal inbox is only that it exists.
		conversationCount: inbox.kind === 'personal' && inbox.ownerIdentifier !== person.identifier ? null : inbox.conversationCount,
		unread: inbox.kind === 'personal' && inbox.ownerIdentifier !== person.identifier ? null : inbox.unread
	});
	if (!canManage) {
		const mine = (await inboxesForManaging(context)).filter((inbox) => inbox.members.some((member) => member.identifier === person.identifier));
		return { canManage: false as const, me: person.identifier, domain: context.settings.domain, inboxes: mine.map(shown), candidates: [] };
	}
	const [inboxes, candidates, signatures, savedReplies, undoSeconds, away, blocked] = await Promise.all([
		inboxesForManaging(context),
		inboxCandidates(context),
		listSignatures(context),
		listSavedReplies(context),
		getUndoSeconds(context),
		getAway(context),
		listBlocked(context)
	]);
	return {
		canManage: true as const,
		me: person.identifier,
		domain: context.settings.domain,
		inboxes: inboxes.map(shown),
		candidates,
		// Each address, extra ones included, can have its own signature.
		addresses: inboxes.flatMap((inbox) => inbox.addresses),
		signatures,
		savedReplies,
		undoSeconds,
		undoChoices: [...undoChoices],
		away,
		awayAnswering: awayAnswers(away, currentTime(context)),
		blocked,
		mergeFields: mergeFields.map((field) => ({ key: field.key, label: field.label }))
	};
};

/** Runs a change and turns a WritingError, SenderError or InboxError into words on the page. */
async function attempt(section: string, work: () => Promise<string>) {
	try {
		return { section, done: await work() };
	} catch (problem) {
		if (problem instanceof WritingError || problem instanceof SenderError || problem instanceof InboxError) return fail(400, { section, problem: problem.message });
		throw problem;
	}
}

export const actions: Actions = {
	createInbox: async (event) => {
		const person = requirePermission(event, 'manage-mail');
		const form = await event.request.formData();
		const kind = form.get('kind') === 'personal' ? 'personal' : 'shared';
		const localPart = formText(form, 'localPart', 100) ?? '';
		return attempt('inboxes', async () => {
			await createInbox(mailContext(), person.identifier, {
				localPart,
				name: formText(form, 'name', 100) ?? '',
				kind,
				ownerIdentifier: formText(form, 'owner', 100)
			});
			return kind === 'personal'
				? `Made the personal inbox ${localPart.trim().toLowerCase()}@. Only its owner sees what comes to it.`
				: `Made the shared inbox ${localPart.trim().toLowerCase()}@, with you on it. Add the others who should read it.`;
		});
	},
	renameInbox: async (event) => {
		const person = requirePermission(event, 'manage-mail');
		const form = await event.request.formData();
		const name = formText(form, 'name', 100) ?? '';
		return attempt('inboxes', async () => {
			await renameInbox(mailContext(), person.identifier, formText(form, 'inbox', 100) ?? '', name);
			return `Renamed the inbox “${name.trim()}”.`;
		});
	},
	addMember: async (event) => {
		const person = requirePermission(event, 'manage-mail');
		const form = await event.request.formData();
		return attempt('inboxes', async () => {
			await addInboxMember(mailContext(), person.identifier, formText(form, 'inbox', 100) ?? '', formText(form, 'member', 100) ?? '');
			return 'Added them. They see this inbox’s conversations from now on, including the earlier ones.';
		});
	},
	removeMember: async (event) => {
		const person = requirePermission(event, 'manage-mail');
		const form = await event.request.formData();
		return attempt('inboxes', async () => {
			await removeInboxMember(mailContext(), person.identifier, formText(form, 'inbox', 100) ?? '', formText(form, 'member', 100) ?? '');
			return 'Took them off the inbox. Conversations assigned to them there are now unassigned.';
		});
	},
	addAddress: async (event) => {
		const person = requirePermission(event, 'manage-mail');
		const form = await event.request.formData();
		return attempt('inboxes', async () => {
			const localPart = await addInboxAddress(mailContext(), person.identifier, formText(form, 'inbox', 100) ?? '', formText(form, 'localPart', 100) ?? '');
			return `Added ${localPart}@. Mail to it files into this inbox, and replies to that mail go from it.`;
		});
	},
	removeAddress: async (event) => {
		const person = requirePermission(event, 'manage-mail');
		const form = await event.request.formData();
		const localPart = formText(form, 'localPart', 100) ?? '';
		return attempt('inboxes', async () => {
			await removeInboxAddress(mailContext(), person.identifier, formText(form, 'inbox', 100) ?? '', localPart);
			return `Took ${localPart}@ off the inbox. Mail to it now goes to the inbox that gets other mail.`;
		});
	},
	alerts: async (event) => {
		const person = await requireMail(event);
		const form = await event.request.formData();
		return attempt('inboxes', async () => {
			const level = await setInboxAlerts(mailContext(), person.identifier, formText(form, 'inbox', 100) ?? '', formText(form, 'level', 10) ?? '');
			return level === 'now'
				? 'You will get an alert as new mail arrives, at most one every 30 minutes.'
				: level === 'daily'
					? 'You will get one summary a day, starting about a day from now.'
					: 'You will get no alerts for this inbox.';
		});
	},
	leaveInbox: async (event) => {
		const person = await requireMail(event);
		const form = await event.request.formData();
		return attempt('inboxes', async () => {
			await removeInboxMember(mailContext(), person.identifier, formText(form, 'inbox', 100) ?? '', person.identifier);
			return 'You left the inbox. Conversations assigned to you there are now unassigned.';
		});
	},
	makeCatchAll: async (event) => {
		const person = requirePermission(event, 'manage-mail');
		const form = await event.request.formData();
		return attempt('inboxes', async () => {
			await makeCatchAll(mailContext(), person.identifier, formText(form, 'inbox', 100) ?? '');
			return 'Mail to an address no inbox has now goes to this inbox.';
		});
	},
	deleteInbox: async (event) => {
		const person = requirePermission(event, 'manage-mail');
		const form = await event.request.formData();
		return attempt('inboxes', async () => {
			await deleteInbox(mailContext(), person.identifier, formText(form, 'inbox', 100) ?? '');
			return 'Deleted the inbox. Mail to its address now goes to the catch-all inbox.';
		});
	},
	signature: async (event) => {
		const person = requirePermission(event, 'manage-mail');
		const form = await event.request.formData();
		const address = formText(form, 'address', 200) ?? '';
		const body = typeof form.get('body') === 'string' ? String(form.get('body')).slice(0, 4000) : '';
		return attempt('signatures', async () => {
			await saveSignature(mailContext(), person.identifier, address, body);
			return body.trim() ? `Saved the signature for ${address}.` : `Took away the signature for ${address}.`;
		});
	},
	reply: async (event) => {
		const person = requirePermission(event, 'manage-mail');
		const form = await event.request.formData();
		const identifier = formText(form, 'identifier', 100);
		const name = formText(form, 'name', 200) ?? '';
		const body = typeof form.get('body') === 'string' ? String(form.get('body')).slice(0, 40_000) : '';
		return attempt('saved-replies', async () => {
			await saveSavedReply(mailContext(), person.identifier, { identifier, name, body });
			return identifier ? `Saved “${name.trim()}”.` : `Made the saved reply “${name.trim()}”.`;
		});
	},
	deleteReply: async (event) => {
		const person = requirePermission(event, 'manage-mail');
		const form = await event.request.formData();
		const identifier = formText(form, 'identifier', 100);
		if (identifier) await deleteSavedReply(mailContext(), person.identifier, identifier);
		return { section: 'saved-replies', done: 'Deleted the saved reply.' };
	},
	undo: async (event) => {
		const person = requirePermission(event, 'manage-mail');
		const form = await event.request.formData();
		const seconds = Number(formText(form, 'seconds', 5));
		return attempt('undo', async () => {
			await setUndoSeconds(mailContext(), person.identifier, seconds);
			return seconds ? `Mail now waits ${seconds} seconds before it goes, so it can be pulled back.` : 'Mail now goes at once, with no chance to undo.';
		});
	},
	block: async (event) => {
		const person = requirePermission(event, 'manage-mail');
		const form = await event.request.formData();
		const pattern = formText(form, 'pattern', 300) ?? '';
		return attempt('blocked', async () => {
			const blocked = await blockSender(mailContext(), person.identifier, pattern, { note: formText(form, 'note', 300) });
			return `Blocked ${blocked}. New mail from ${blocked.startsWith('@') ? 'that domain' : 'that address'} goes straight to Spam.`;
		});
	},
	unblock: async (event) => {
		const person = requirePermission(event, 'manage-mail');
		const form = await event.request.formData();
		const pattern = formText(form, 'pattern', 300) ?? '';
		await unblockSender(mailContext(), person.identifier, pattern);
		return { section: 'blocked', done: `Unblocked ${pattern}. Mail already in Spam stays there until you move it.` };
	},
	away: async (event) => {
		const person = requirePermission(event, 'manage-mail');
		const form = await event.request.formData();
		const on = form.get('on') === 'yes';
		const body = typeof form.get('text') === 'string' ? String(form.get('text')).slice(0, 40_000) : '';
		return attempt('away', async () => {
			await saveAway(mailContext(), person.identifier, {
				on,
				from: whenFromForm(form, 'from'),
				until: whenFromForm(form, 'until'),
				subject: formText(form, 'subject', 200) ?? '',
				text: body
			});
			return on ? 'The away message is on. Each person who writes gets it once.' : 'The away message is off.';
		});
	}
};
