/**
 * The check every page about one nation's team runs (decision record 0041).
 * The nation comes only from the page's address, and every load and action
 * checks the signed-in person's own place on that nation's team, so nobody
 * can reach another nation's team or page from here.
 */
import { error } from '@sveltejs/kit';
import { reviewSubjects } from 'virtual:review-subjects';
import { displayName } from '../nation-labels.ts';
import { granterOn } from './nation-teams.ts';
import { refuse, requirePerson, storage } from './workspace.ts';

interface NationEvent {
	locals: App.Locals;
	url: URL;
	params: { nation: string };
}

export async function nationAndGranter(event: NationEvent) {
	const person = requirePerson(event);
	const subject = reviewSubjects.find(
		(candidate) => candidate.kind === 'nation' && candidate.identifier === event.params.nation
	);
	if (!subject) error(404, 'No such nation.');
	// The name as the page shows it, without the states the federal list adds.
	const nation = { ...subject, title: displayName(subject.title) };
	const { database, bucket } = storage(event);
	const granter = await granterOn(database, person, nation.identifier);
	if (!granter.isAdministrator && !granter.level) {
		refuse(event, `not on the team of nation ${nation.identifier}`);
	}
	return { person, nation, granter, database, bucket };
}
