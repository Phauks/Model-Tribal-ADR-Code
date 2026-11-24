/**
 * The address book's mailing list as CSV, for the lead author: one email per
 * contact, its preferred one in use (mailingList in
 * src/lib/server/address-book.ts). It holds leaders' own addresses, so it is
 * never cached and never linked from a public page.
 */
import { csvDocument, csvResponse } from '#lib/csv.ts';
import { listContacts, mailingList } from '#lib/server/address-book.ts';
import { requirePermission, storage } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	requirePermission(event, 'manage-address-book');
	const { database } = storage(event);
	const recipients = mailingList(await listContacts(database));
	const header = ['name', 'role', 'organization', 'nation', 'email', 'kind', 'last_checked'];
	const lines = recipients.map((recipient) =>
		[
			recipient.name,
			recipient.role,
			recipient.organizationName,
			recipient.nationIdentifier,
			recipient.email,
			recipient.label,
			recipient.verifiedOn
		]
	);
	const body = csvDocument([header, ...lines], { guardFormulas: true });
	const day = new Date().toISOString().slice(0, 10);
	return csvResponse(body, { fileName: `mailing-list-${day}.csv`, private: true });
};
