import { error } from '@sveltejs/kit';
import { contactCards } from '#lib/contact-card.ts';
import { displayName } from '#lib/nation-labels.ts';
import { nations } from '#lib/server/content.ts';
import { nationVcards } from '#lib/vcard.ts';
import type { EntryGenerator, RequestHandler } from './$types';

// A nation's public government office contacts as contact cards (src/lib/vcard.ts), from its
// page's Download menu. Trevor asked for them on Nov. 23, 2026. A withdrawn page shows no
// contacts, so its file holds only the nation's name.
export const prerender = true;

export const entries: EntryGenerator = () => nations().map((record) => ({ id: record.id }));

export const GET: RequestHandler = ({ params }) => {
	const record = nations().find((candidate) => candidate.id === params.id);
	if (!record) error(404, 'No published record has that identifier.');
	const withdrawn = record.review?.status === 'withdrawn-at-request';
	const cards = withdrawn ? { websites: [], offices: [] } : contactCards(record.contacts ?? []);
	return new Response(nationVcards(displayName(record.names.official), cards, `/nations/${record.id}`), {
		headers: {
			'content-type': 'text/vcard; charset=utf-8',
			'content-disposition': `attachment; filename="${record.id}-contacts.vcf"`
		}
	});
};
