import { nations } from '#lib/server/content.ts';
import { entityTypeLabels, reviewStatusLabels, stateName } from '#lib/nation-labels.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const records = nations();
	const groups = Object.keys(entityTypeLabels)
		.map((entityType) => ({
			entityType,
			label: entityTypeLabels[entityType],
			rows: records
				.filter((record) => record.entity_type === entityType)
				.map((record) => ({
					id: record.id,
					name: record.names.official,
					states: [...new Set((record.states ?? []).map((fact) => fact.state))]
						.map(stateName)
						.join(', '),
					review: reviewStatusLabels[record.review?.status]?.label ?? record.review?.status ?? ''
				}))
		}))
		.filter((group) => group.rows.length > 0);

	return { groups, example: records.some((record) => record.example) };
};
