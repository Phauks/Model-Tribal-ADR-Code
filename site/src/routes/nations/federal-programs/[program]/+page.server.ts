import { error } from '@sveltejs/kit';
import { federalPrograms } from '#lib/federal-programs.ts';
import { programView } from '#lib/server/federal-programs.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = () => federalPrograms.map((program) => ({ program: program.key }));

export const load: PageServerLoad = ({ params }) => {
	const view = programView(params.program);
	if (!view) error(404, 'No federal program by that name.');
	return view;
};
