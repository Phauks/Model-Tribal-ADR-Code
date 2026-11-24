/**
 * Reads the profile form (src/routes/profile/edit). Saving a draft accepts
 * anything well formed, so a person can stop and come back; what must be
 * answered before confirming is checked on the review page
 * (missingAnswers in src/lib/contributors.ts).
 *
 * Repeatable answers come as rows. Each row sends its key under a "…Row"
 * name (nameRow, contactRow, nationRow, languageRow) and its fields under
 * "<field>-<key>", so rows can be added and removed in any order. Where an
 * answer may appear comes as the repeated fields "book" and "website", whose
 * values name the answer: "full-name", "picture", "name-<key>",
 * "nation-<key>" and so on.
 */
import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/min';
import {
	availabilities,
	emptyPlacements,
	interests,
	nameKinds,
	nationAnswers,
	nationRelationships,
	oldestAge,
	placedAnswers,
	pronounChoices,
	specialties,
	youngestAge,
	type NationAffiliation,
	type ProfileAnswers,
	type ProfileContact,
	type ProfileLanguage,
	type ProfileName
} from '#lib/contributors.ts';
import { languageOf } from '#lib/languages.ts';

/** A trimmed, NFC-normalized form field, or null when empty. */
function formText(form: FormData, name: string, maximum = 8000): string | null {
	const value = form.get(name);
	if (typeof value !== 'string') return null;
	const trimmed = value.normalize('NFC').trim().slice(0, maximum);
	return trimmed === '' ? null : trimmed;
}

export interface NationChoice {
	identifier: string;
	title: string;
}

function choice<T extends string>(options: readonly T[], value: string | null): T | null {
	return value !== null && (options as readonly string[]).includes(value) ? (value as T) : null;
}

function chosen<T extends string>(options: readonly T[], values: FormDataEntryValue[]): T[] {
	return [...new Set(values.filter((value): value is T => typeof value === 'string' && (options as readonly string[]).includes(value)))];
}

/** At most this many rows of each kind are read, so a form cannot fill the database. */
const rowLimit = 30;

/** Row keys in the order the rows came, without repeats. Keys are short, so a name built from one stays short. */
function rows(form: FormData, name: string): string[] {
	const keys = form.getAll(name).filter((value): value is string => typeof value === 'string' && /^[A-Za-z0-9]{1,12}$/.test(value));
	return [...new Set(keys)].slice(0, rowLimit);
}

/** A simple check that an address has a name, an at sign and a domain with a dot; the person's own mail system decides the rest. */
export function isEmailAddress(text: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(text) && text.length <= 254;
}

/**
 * A phone number from its country and digits, in E.164 form, or a message
 * saying what is wrong. The digits are checked against the country's
 * numbering plan with libphonenumber-js.
 */
export function phoneNumberOf(country: string | null, digits: string): { ok: true; value: string; country: string } | { ok: false; message: string } {
	const only = digits.replace(/\D/g, '');
	if (only.length === 0) return { ok: false, message: 'Type the phone number, or remove the row.' };
	const region = (country ?? 'US').toUpperCase() as CountryCode;
	const parsed = parsePhoneNumberFromString(only, region);
	if (!parsed || !parsed.isValid()) return { ok: false, message: 'This number does not look complete for the country chosen. Check the country and the digits.' };
	return { ok: true, value: parsed.number, country: parsed.country ?? region };
}

export type ProfileFormResult = { ok: true; answers: ProfileAnswers } | { ok: false; errors: Record<string, string>; answers: ProfileAnswers };

export function readProfileForm(form: FormData, nations: readonly NationChoice[], email: string, year: number): ProfileFormResult {
	const errors: Record<string, string> = {};
	/** A text answer; a message for one that is too long goes under the field's name, or for a row, under the row's place (such as "name-0"). */
	const text = (name: string, maximum: number, errorKey = name) => {
		const value = formText(form, name, maximum + 1);
		if (value && value.length > maximum) {
			errors[errorKey] = `Please keep this under ${maximum.toLocaleString('en-US')} characters.`;
			return value.slice(0, maximum);
		}
		return value;
	};
	const book = new Set(form.getAll('book'));
	const website = new Set(form.getAll('website'));
	const placed = (item: string) => ({ book: book.has(item), website: website.has(item) });
	const ticked = (name: string, key: string) => form.getAll(name).includes(key);

	// Messages for a row go under its place among the answers kept, such as "name-0", so the form can show them beside the row it rebuilds.
	const names: ProfileName[] = [];
	for (const key of rows(form, 'nameRow')) {
		const name = text(`name-${key}`, 200, `name-${names.length}`);
		const kind = choice(nameKinds, formText(form, `nameKind-${key}`)) ?? 'other';
		if (name) names.push({ name, kind, ...placed(`name-${key}`) });
	}

	const birthText = formText(form, 'birthYear');
	let birthYear: number | null = birthText && /^\d{4}$/.test(birthText) ? Number(birthText) : null;
	if (birthYear !== null && (year - birthYear < youngestAge || year - birthYear > oldestAge)) {
		errors.birthYear = 'Choose a year from the list.';
		birthYear = null;
	}
	const birthdayAnswer = choice(['yes', 'no'] as const, formText(form, 'birthdayAnswer'));

	const preferred = formText(form, 'preferred');
	const contacts: ProfileContact[] = [];
	for (const key of rows(form, 'contactRow')) {
		const kind = formText(form, `contactKind-${key}`);
		const common = { mayEmail: ticked('mayEmail', key), mayCall: ticked('mayCall', key), mayText: ticked('mayText', key), preferred: preferred === key };
		if (kind === 'sign-in') {
			contacts.push({ kind: 'email', value: email, country: null, signIn: true, ...common, mayCall: false, mayText: false });
		} else if (kind === 'email') {
			const address = text(`email-${key}`, 254, `contact-${contacts.length}`);
			if (!address) continue;
			if (!isEmailAddress(address)) errors[`contact-${contacts.length}`] = 'Write the whole address, for example name@example.org.';
			contacts.push({ kind: 'email', value: address, country: null, signIn: false, ...common, mayCall: false, mayText: false });
		} else if (kind === 'phone') {
			const digits = formText(form, `phone-${key}Number`, 40) ?? '';
			if (!digits.replace(/\D/g, '')) continue;
			const country = formText(form, `phone-${key}Country`, 2);
			const phone = phoneNumberOf(country, digits);
			if (!phone.ok) errors[`contact-${contacts.length}`] = phone.message;
			contacts.push({
				kind: 'phone',
				value: phone.ok ? phone.value : digits.replace(/\D/g, ''),
				country: phone.ok ? phone.country : country,
				signIn: false,
				...common,
				mayEmail: false
			});
		}
	}
	if (!contacts.some((contact) => contact.signIn)) {
		contacts.unshift({ kind: 'email', value: email, country: null, signIn: true, mayEmail: true, mayCall: false, mayText: false, preferred: false });
	}
	if (!contacts.some((contact) => contact.preferred)) contacts[0].preferred = true;

	const byIdentifier = new Map(nations.map((nation) => [nation.identifier, nation]));
	const nationAnswer = choice(nationAnswers, formText(form, 'nationAnswer'));
	const listed: NationAffiliation[] = [];
	if (nationAnswer === 'listed') {
		for (const key of rows(form, 'nationRow')) {
			const picked = formText(form, `nation-${key}`);
			const known = picked ? byIdentifier.get(picked) : undefined;
			const written = picked === 'other' ? text(`nationOther-${key}`, 300, `nation-${listed.length}`) : null;
			if (!known && !written) continue;
			const relationships = chosen(nationRelationships, form.getAll(`relationship-${key}`));
			listed.push({
				nationIdentifier: known?.identifier ?? null,
				nationName: known?.title ?? written!,
				relationships,
				relationshipOther: relationships.includes('other') ? text(`relationshipOther-${key}`, 300, `nation-${listed.length}`) : null,
				...placed(`nation-${key}`)
			});
		}
	}

	const languages: ProfileLanguage[] = [];
	for (const key of rows(form, 'languageRow')) {
		const picked = formText(form, `language-${key}`);
		const code = picked && picked !== 'other' && languageOf(picked) ? picked : null;
		const otherName = picked === 'other' ? text(`languageOther-${key}`, 100, `language-${languages.length}`) : null;
		if (!code && !otherName) continue;
		languages.push({ code, otherName, speaks: ticked('speaks', key), reads: ticked('reads', key), writes: ticked('writes', key), website: website.has(`language-${key}`) });
	}

	const specialtyOthers = [
		...new Set(
			form
				.getAll('specialtyOther')
				.filter((value): value is string => typeof value === 'string')
				.map((value) => value.normalize('NFC').trim().slice(0, 100))
				.filter(Boolean)
		)
	].slice(0, rowLimit);

	const placements = emptyPlacements();
	for (const item of placedAnswers) placements[item] = placed(item);

	const answers: ProfileAnswers = {
		givenName: text('givenName', 200),
		familyName: text('familyName', 200),
		names,
		pronouns: chosen(pronounChoices, form.getAll('pronouns')),
		pronounOther: form.getAll('pronouns').includes('other') ? text('pronounOther', 60) : null,
		birthYear,
		birthdayAnswer,
		birthdayAnswerYear: birthdayAnswer ? year : null,
		ageGroup: null,
		contacts,
		nationAnswer,
		nations: listed,
		background: text('background', 4000),
		languages,
		organization: text('organization', 300),
		interests: chosen(interests, form.getAll('interests')),
		specialties: chosen(specialties, form.getAll('specialties')),
		specialtyOthers,
		availability: choice(availabilities, formText(form, 'availability')),
		description: text('description', 200),
		biography: text('biography', 1200),
		placements
	};

	if (Object.keys(errors).length > 0) return { ok: false, errors, answers };
	return { ok: true, answers };
}
