/**
 * Reads the profile form (src/routes/profile/edit). Saving a draft accepts
 * anything well formed, so a person can stop and come back; what must be
 * answered before confirming is checked on the review page
 * (missingAnswers in src/lib/contributors.ts).
 */
import {
	availabilities,
	contactMethods,
	creditForms,
	interests,
	nationAnswers,
	type NationAffiliation,
	type ProfileAnswers
} from '#lib/contributors.ts';

/** A trimmed, NFC-normalized form field, or null when empty. */
function formText(form: FormData, name: string, maximum = 8000): string | null {
	const value = form.get(name);
	if (typeof value !== 'string') return null;
	const trimmed = value.normalize('NFC').trim().slice(0, maximum);
	return trimmed === '' ? null : trimmed;
}

/** How many nations the form has room for. A person can list more by saving and coming back. */
export const nationSlots = 4;

export interface NationChoice {
	identifier: string;
	title: string;
}

function choice<T extends string>(options: readonly T[], value: string | null): T | null {
	return value !== null && (options as readonly string[]).includes(value) ? (value as T) : null;
}

/**
 * A phone number in any format the person is used to: digits with spaces,
 * dots, dashes, brackets, a leading plus and an extension. Between 7 and 15
 * digits, the most a number may have under ITU-T E.164, plus up to 6 for an
 * extension.
 */
export function isPlausiblePhone(text: string): boolean {
	if (!/^\+?[0-9 ().\-]+((ext\.?|x|#)\s*[0-9]{1,6})?$/i.test(text)) return false;
	const main = text.replace(/(ext\.?|x|#)\s*[0-9]{1,6}$/i, '');
	const digits = main.replace(/[^0-9]/g, '').length;
	return digits >= 7 && digits <= 15;
}

export type ProfileFormResult =
	| { ok: true; answers: ProfileAnswers }
	| { ok: false; errors: Record<string, string>; values: Record<string, string> };

export function readProfileForm(form: FormData, nations: readonly NationChoice[]): ProfileFormResult {
	const errors: Record<string, string> = {};
	const values: Record<string, string> = {};
	for (const [name, value] of form.entries()) {
		if (typeof value === 'string') values[name] = values[name] ? `${values[name]}\n${value}` : value;
	}

	const text = (name: string, maximum: number) => {
		const value = formText(form, name, maximum + 1);
		if (value && value.length > maximum) {
			errors[name] = `Please keep this under ${maximum.toLocaleString('en-US')} characters.`;
			return value.slice(0, maximum);
		}
		return value;
	};
	const ticked = (name: string) => form.get(name) === 'yes';

	const phone = text('phone', 40);
	if (phone && !isPlausiblePhone(phone)) {
		errors.phone = 'Write the phone number with its country or area code, for example +1 702 555 0123.';
	}

	const byTitle = new Map(nations.map((nation) => [nation.title.normalize('NFC').toLocaleLowerCase('en-US'), nation]));
	const nationAnswer = choice(nationAnswers, formText(form, 'nationAnswer'));
	const listed: NationAffiliation[] = [];
	if (nationAnswer === 'listed') {
		for (let slot = 1; slot <= nationSlots; slot++) {
			const name = text(`nation${slot}Name`, 300);
			if (!name) continue;
			const known = byTitle.get(name.toLocaleLowerCase('en-US'));
			listed.push({
				nationIdentifier: known?.identifier ?? null,
				nationName: known?.title ?? name,
				connection: text(`nation${slot}Connection`, 300),
				showInCredit: ticked(`nation${slot}Credit`)
			});
		}
	}

	const answers: ProfileAnswers = {
		givenName: text('givenName', 200),
		familyName: text('familyName', 200),
		nativeName: text('nativeName', 200),
		phone,
		preferredContact: choice(contactMethods, formText(form, 'preferredContact')),
		thirteenOrOlder: ticked('thirteenOrOlder'),
		nationAnswer,
		nations: listed,
		background: text('background', 4000),
		languages: text('languages', 500),
		organization: text('organization', 300),
		interests: form
			.getAll('interests')
			.filter((value): value is (typeof interests)[number] =>
				(interests as readonly unknown[]).includes(value)
			),
		availability: choice(availabilities, formText(form, 'availability')),
		creditForm: choice(creditForms, formText(form, 'creditForm')),
		creditName: text('creditName', 200),
		creditRole: text('creditRole', 200),
		creditPseudonym: text('creditPseudonym', 200),
		creditInBook: ticked('creditInBook'),
		creditOnWebsite: ticked('creditOnWebsite'),
		biography: text('biography', 1200),
		biographyInCredits: ticked('biographyInCredits')
	};

	if (Object.keys(errors).length > 0) return { ok: false, errors, values };
	return { ok: true, answers };
}
