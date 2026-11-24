import { error, json } from '@sveltejs/kit';
import { builderDataset, builderDatasetIdentifiers } from '#lib/server/table-builder-datasets.ts';
import type { EntryGenerator, RequestHandler } from './$types';

// One dataset for Build a table (src/lib/table-builder.ts), written at build time.
export const prerender = true;

export const entries: EntryGenerator = () => builderDatasetIdentifiers.map((dataset) => ({ dataset }));

export const GET: RequestHandler = ({ params }) => {
	const dataset = builderDataset(params.dataset);
	if (!dataset) error(404, 'No such dataset');
	return json(dataset);
};
