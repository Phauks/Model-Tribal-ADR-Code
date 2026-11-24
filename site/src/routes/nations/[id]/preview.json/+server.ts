import { error, json } from '@sveltejs/kit';
import { contactCards, defaultOfficeFor, type ContactRow } from '#lib/contact-card.ts';
import { humanize } from '#lib/nation-labels.ts';
import { imageMayBeShown, imagePath } from '#lib/official-images.ts';
import { nations } from '#lib/server/content.ts';
import { nationIndexRows } from '#lib/server/nation-index.ts';
import type { EntryGenerator, RequestHandler } from './$types';

/**
 * A nation in short, for the preview that opens when a reader selects it on the map (Trevor, 2026-11-23: show its seal, website and contact). Each field repeats a cited fact the nation's page shows with its source: the seal or logo where its reuse status allows showing it, the first website, and the main office's address, phone and email. Built with the site, one small file a nation, so the map fetches only the nations a reader opens.
 */
export const prerender = true;

const shown = () => new Set(nationIndexRows().map((row) => row.id));

export const entries: EntryGenerator = () => [...shown()].map((id) => ({ id }));

/** A contact row as the preview shows it: its label, its lines and where it links. */
const brief = (row: ContactRow | undefined) => (row ? { label: row.label, lines: row.lines, link: row.link, external: row.external } : undefined);

export const GET: RequestHandler = ({ params }) => {
	const record = nations().find((entry) => entry.id === params.id);
	if (!record || !shown().has(record.id)) error(404, 'There is no nation page by that name');
	const image = (record.official_images ?? []).find((entry) => entry.private_copy && imageMayBeShown(entry));
	const cards = contactCards(record.contacts ?? [], undefined, defaultOfficeFor(record.entity_type));
	const office = cards.offices[0];
	const first = (...kinds: ContactRow['kind'][]) => office?.rows.find((row) => kinds.includes(row.kind));
	return json({
		image: image ? { src: imagePath(record.id), kind: humanize(image.kind) } : undefined,
		website: brief(cards.websites[0]),
		office: office?.name,
		address: brief(first('physical-address', 'mailing-address')),
		phone: brief(first('phone')),
		email: brief(first('email'))
	});
};
