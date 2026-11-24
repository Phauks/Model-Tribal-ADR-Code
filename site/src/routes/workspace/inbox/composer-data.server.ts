// What the box for writing mail needs besides the message itself
// (src/routes/workspace/inbox/Composer.svelte): the signature of each
// address, the saved replies, and the merge fields of the people in the
// address book, so a saved reply can greet the recipient by name.
import { mailNations } from 'virtual:mail-nations';
import type { MergeValues } from '#lib/mail.ts';
import type { MailContext } from '#lib/server/mail/context.ts';
import { addressBookRecipients, fieldsFor } from '#lib/server/mail/outreach.ts';
import { listSavedReplies, listSignatures } from '#lib/server/mail/writing.ts';

const nationsByIdentifier = new Map(mailNations.map((nation) => [nation.identifier, nation]));

export interface ComposerData {
	signatures: Record<string, string>;
	savedReplies: { identifier: string; name: string; body: string }[];
	/** Merge fields by email address, for the people in the address book. */
	mergeValues: Record<string, MergeValues>;
	senderName: string;
}

/**
 * The box's extras. Give `only` to look up just these addresses (a
 * conversation's other side) rather than the whole address book.
 */
export async function composerData(context: MailContext, senderName: string, only?: (string | null)[]): Promise<ComposerData> {
	const [signatures, savedReplies, contacts] = await Promise.all([listSignatures(context), listSavedReplies(context), addressBookRecipients(context)]);
	const wanted = only ? new Set(only.filter((item): item is string => Boolean(item)).map((item) => item.toLowerCase())) : null;
	const mergeValues: Record<string, MergeValues> = {};
	for (const contact of contacts) {
		if (wanted && !wanted.has(contact.email.toLowerCase())) continue;
		const nation = contact.nationIdentifier ? (nationsByIdentifier.get(contact.nationIdentifier) ?? null) : null;
		mergeValues[contact.email.toLowerCase()] = fieldsFor(contact, nation, context.settings.siteAddress, senderName);
	}
	return {
		signatures,
		savedReplies: savedReplies.map(({ identifier, name, body }) => ({ identifier, name, body })),
		mergeValues,
		senderName
	};
}
