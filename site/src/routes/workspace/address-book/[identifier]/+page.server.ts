import { error, fail } from '@sveltejs/kit';
import {
	contactMethods,
	methodLabels,
	methodStatusNames,
	methodStatuses,
	sourceKinds,
	stalenessOf,
	today,
	type ContactMethodKind,
	type MethodLabel,
	type MethodStatus,
	type SourceKind
} from '#lib/address-book.ts';
import {
	addContactMethod,
	contactChanges,
	contactEntry,
	contactMethod,
	editContact,
	editContactMethod,
	contactNames,
	type MethodEdit
} from '#lib/server/address-book.ts';
import { formText, requirePermission, storage } from '#lib/server/workspace.ts';
import { nations, nationTitles } from '../nations.ts';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

export const load: PageServerLoad = async (event) => {
	requirePermission(event, 'manage-address-book');
	const { database } = storage(event);
	const contact = await contactEntry(database, event.params.identifier);
	if (!contact) error(404, 'That contact is not in the address book.');
	const day = today();
	// Only names and organizations: reading every contact's emails, phones and tags here was not needed.
	const everyone = await contactNames(database);
	return {
		contact: {
			...contact,
			nationTitle: contact.nationIdentifier
				? (nationTitles.get(contact.nationIdentifier) ?? contact.nationIdentifier)
				: null,
			methods: contact.methods.map((method) => ({
				...method,
				staleness: stalenessOf(method, day)
			}))
		},
		organization: everyone.find((other) => other.identifier === contact.organizationIdentifier) ?? null,
		members: everyone
			.filter((other) => other.organizationIdentifier === contact.identifier)
			.map((other) => ({
				identifier: other.identifier,
				name: other.name,
				role: other.role
			})),
		organizations: everyone
			.filter((other) => other.kind === 'organization' && other.identifier !== contact.identifier)
			.map((other) => ({ identifier: other.identifier, name: other.name })),
		changes: await contactChanges(database, contact.identifier),
		nations,
		today: day
	};
};

/** The email or phone named in the form, if it belongs to this contact. */
async function methodOf(event: RequestEvent, form: FormData) {
	const { database } = storage(event);
	const method = await contactMethod(database, formText(form, 'method') ?? '');
	return method && method.contactIdentifier === event.params.identifier ? method : null;
}

function dateField(form: FormData, name: string): string | null | 'bad' {
	const value = formText(form, name, 10);
	if (!value) return null;
	return isoDate.test(value) ? value : 'bad';
}

export const actions: Actions = {
	edit: async (event) => {
		const person = requirePermission(event, 'manage-address-book');
		const { database } = storage(event);
		const form = await event.request.formData();
		const name = formText(form, 'name', 300);
		if (!name) return fail(400, { problem: 'Give a name.' });
		const nationIdentifier = formText(form, 'nationIdentifier');
		if (nationIdentifier && !nationTitles.has(nationIdentifier))
			return fail(400, { problem: 'Choose a nation from the list.' });
		const result = await editContact(
			database,
			event.params.identifier,
			{
				name,
				organizationIdentifier: formText(form, 'organizationIdentifier'),
				nationIdentifier,
				role: formText(form, 'role', 300),
				notes: formText(form, 'notes'),
				tags: (formText(form, 'tags') ?? '').split(',')
			},
			person.identifier
		);
		return result.ok ? { done: 'Saved.' } : fail(400, { problem: result.problem });
	},

	addMethod: async (event) => {
		const person = requirePermission(event, 'manage-address-book');
		const { database } = storage(event);
		const form = await event.request.formData();
		const method = formText(form, 'kind') as ContactMethodKind | null;
		const label = formText(form, 'label') as MethodLabel | null;
		const sourceKind = formText(form, 'sourceKind') as SourceKind | null;
		if (!method || !contactMethods.includes(method)) return fail(400, { problem: 'Choose email or phone.' });
		if (!label || !methodLabels.includes(label)) return fail(400, { problem: 'Choose what kind of address this is.' });
		if (!sourceKind || !sourceKinds.includes(sourceKind)) return fail(400, { problem: 'Choose where it was found.' });
		const verifiedOn = dateField(form, 'verifiedOn') ?? today();
		const nextElectionOn = dateField(form, 'nextElectionOn');
		if (verifiedOn === 'bad' || nextElectionOn === 'bad') return fail(400, { problem: 'Write dates as YYYY-MM-DD.' });
		const result = await addContactMethod(
			database,
			event.params.identifier,
			{
				method,
				value: formText(form, 'value', 320) ?? '',
				label,
				sourceKind,
				sourceLabel: formText(form, 'sourceLabel', 300) ?? '',
				sourceLink: formText(form, 'sourceLink', 2000),
				verifiedOn,
				nextElectionOn,
				preferred: form.get('preferred') === 'on',
				note: formText(form, 'note')
			},
			person.identifier
		);
		return result.ok ? { done: 'Added.' } : fail(400, { problem: result.problem });
	},

	verify: async (event) => {
		const person = requirePermission(event, 'manage-address-book');
		const form = await event.request.formData();
		const method = await methodOf(event, form);
		if (!method)
			return fail(404, {
				problem: 'That email or phone is not on this contact.'
			});
		const { database } = storage(event);
		const edit: MethodEdit = { verifiedOn: today() };
		const note = formText(form, 'note');
		if (note) edit.note = [method.note, note].filter(Boolean).join(' ');
		const result = await editContactMethod(database, method.identifier, edit, 'Verified by hand', person.identifier);
		return result.ok ? { done: `${method.value} counts as checked today.` } : fail(400, { problem: result.problem });
	},

	status: async (event) => {
		const person = requirePermission(event, 'manage-address-book');
		const form = await event.request.formData();
		const method = await methodOf(event, form);
		if (!method)
			return fail(404, {
				problem: 'That email or phone is not on this contact.'
			});
		const status = formText(form, 'status') as MethodStatus | null;
		if (!status || !methodStatuses.includes(status)) return fail(400, { problem: 'Choose a status.' });
		const note = formText(form, 'note');
		const { database } = storage(event);
		const edit: MethodEdit = { status };
		if (status !== 'current') edit.preferred = false;
		if (note) edit.note = [method.note, note].filter(Boolean).join(' ');
		const result = await editContactMethod(
			database,
			method.identifier,
			edit,
			`Marked ${methodStatusNames[status].toLocaleLowerCase('en-US')}`,
			person.identifier
		);
		return result.ok
			? { done: `${method.value}: ${methodStatusNames[status]}.` }
			: fail(400, { problem: result.problem });
	},

	prefer: async (event) => {
		const person = requirePermission(event, 'manage-address-book');
		const form = await event.request.formData();
		const method = await methodOf(event, form);
		if (!method)
			return fail(404, {
				problem: 'That email or phone is not on this contact.'
			});
		if (method.status !== 'current') return fail(400, { problem: 'Only one in use can be the first choice.' });
		const { database } = storage(event);
		const result = await editContactMethod(
			database,
			method.identifier,
			{ preferred: true },
			'Made first choice',
			person.identifier
		);
		return result.ok ? { done: `${method.value} is now the first choice.` } : fail(400, { problem: result.problem });
	},

	editMethod: async (event) => {
		const person = requirePermission(event, 'manage-address-book');
		const form = await event.request.formData();
		const method = await methodOf(event, form);
		if (!method)
			return fail(404, {
				problem: 'That email or phone is not on this contact.'
			});
		const label = formText(form, 'label') as MethodLabel | null;
		const sourceKind = formText(form, 'sourceKind') as SourceKind | null;
		if (!label || !methodLabels.includes(label)) return fail(400, { problem: 'Choose what kind of address this is.' });
		if (!sourceKind || !sourceKinds.includes(sourceKind)) return fail(400, { problem: 'Choose where it was found.' });
		const verifiedOn = dateField(form, 'verifiedOn');
		const nextElectionOn = dateField(form, 'nextElectionOn');
		if (verifiedOn === 'bad' || nextElectionOn === 'bad' || !verifiedOn)
			return fail(400, { problem: 'Write dates as YYYY-MM-DD.' });
		const { database } = storage(event);
		const result = await editContactMethod(
			database,
			method.identifier,
			{
				value: formText(form, 'value', 320) ?? '',
				label,
				sourceKind,
				sourceLabel: formText(form, 'sourceLabel', 300) ?? '',
				sourceLink: formText(form, 'sourceLink', 2000),
				verifiedOn,
				nextElectionOn,
				note: formText(form, 'note')
			},
			'Edited',
			person.identifier
		);
		return result.ok ? { done: 'Saved.' } : fail(400, { problem: result.problem });
	}
};
