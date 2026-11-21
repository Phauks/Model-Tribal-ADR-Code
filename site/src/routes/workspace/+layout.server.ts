import { permissionsOf } from '#lib/permissions.ts';
import { requirePerson } from '#lib/server/workspace.ts';
import type { LayoutServerLoad } from './$types';

// Private pages, answered by the Worker for the signed-in person.
export const prerender = false;

export const load: LayoutServerLoad = (event) => {
	const person = requirePerson(event);
	return { person, permissions: [...permissionsOf(person.role)] };
};
