/**
 * The differences between the address book and the nation pages as CSV, for
 * turning into a pull request that corrects the profiles. It lists office
 * emails and phones only, which are public on the nation pages or meant to be.
 */
import { publicNationContacts } from 'virtual:public-contacts';
import { csvText } from '#lib/address-book.ts';
import { differences } from '#lib/address-book-sync.ts';
import { bookOfficeMethods } from '#lib/server/address-book.ts';
import { requirePermission, storage } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	requirePermission(event, 'manage-address-book');
	const { database } = storage(event);
	const found = differences(publicNationContacts, await bookOfficeMethods(database));
	const header = [
		'kind',
		'nation',
		'nation_name',
		'method',
		'value',
		'source',
		'source_link',
		'book_status',
		'book_note'
	];
	const lines = found.map((item) =>
		[
			item.kind,
			item.nationIdentifier,
			item.nationName,
			item.method,
			item.value,
			item.sourceTitle,
			item.sourceLink,
			item.status ?? null,
			item.note ?? null
		].map(csvText)
	);
	const body = [header, ...lines].map((line) => line.join(',')).join('\r\n') + '\r\n';
	const day = new Date().toISOString().slice(0, 10);
	return new Response(body, {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': `attachment; filename="address-book-differences-${day}.csv"`,
			'cache-control': 'no-store'
		}
	});
};
