import { error } from '@sveltejs/kit';
import { compareTexts } from '#lib/essays/compare.ts';
import { essayDateTime } from '#lib/essays/dates.ts';
import { readVersionText, version } from '#lib/server/essays.ts';
import { essayAccess } from '#lib/server/essay-workspace.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { identifier, database, bucket } = await essayAccess(event, 'comment');
	const from = Number(event.url.searchParams.get('from'));
	const to = Number(event.url.searchParams.get('to'));
	const [before, after] = await Promise.all([version(database, identifier, from), version(database, identifier, to)]);
	if (!before || !after) error(404, 'Choose two saved versions.');
	const [beforeText, afterText] = await Promise.all([readVersionText(bucket, before), readVersionText(bucket, after)]);
	const changes = compareTexts(beforeText, afterText);
	return {
		identifier,
		title: after.title,
		from: { number: before.number, at: essayDateTime(before.created_at), by: before.person_name ?? 'Someone' },
		to: { number: after.number, at: essayDateTime(after.created_at), by: after.person_name ?? 'Someone' },
		changes,
		changed: changes.filter((change) => change.kind !== 'same').length
	};
};
