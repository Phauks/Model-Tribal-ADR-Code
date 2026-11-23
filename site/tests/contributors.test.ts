import { describe, expect, it } from 'vitest';
import { creditOf, defaultCreditSection, emptyAnswers, missingAnswers, type ProfileAnswers } from '#lib/contributors.ts';
import { isPlausiblePhone, readProfileForm } from '#lib/server/contributor-form.ts';

const answers = (changes: Partial<ProfileAnswers>): ProfileAnswers => ({ ...emptyAnswers, ...changes });

describe('credit lines', () => {
	it('prints the given and family name and sorts by family name', () => {
		const credit = creditOf(answers({ givenName: 'Ada', familyName: 'Lovelace', creditForm: 'name' }));
		expect(credit?.line).toBe('Ada Lovelace');
		expect(credit?.sortKey).toBe('lovelace');
	});

	it('prints a single name when there is no family name', () => {
		expect(creditOf(answers({ givenName: 'Sukarno', creditForm: 'name' }))?.line).toBe('Sukarno');
	});

	it('adds only the nations the person ticked, and only for name and nation', () => {
		const nations = [
			{ nationIdentifier: 'a', nationName: 'First Nation', connection: 'citizen', showInCredit: true },
			{ nationIdentifier: null, nationName: 'Second Nation', connection: null, showInCredit: false }
		];
		const withNation = answers({ givenName: 'Ada', familyName: 'Lovelace', creditForm: 'name-and-nation', nations });
		expect(creditOf(withNation)?.line).toBe('Ada Lovelace (First Nation)');
		expect(creditOf({ ...withNation, creditForm: 'name' })?.line).toBe('Ada Lovelace');
	});

	it('never credits someone who chose no credit or no place', () => {
		expect(creditOf(answers({ givenName: 'Ada', creditForm: 'none' }))).toBeNull();
		expect(creditOf(answers({ givenName: 'Ada', creditForm: 'name', creditInBook: false, creditOnWebsite: false }))).toBeNull();
	});

	it('leaves out the biography for a description-only credit', () => {
		const credit = creditOf(
			answers({ creditForm: 'role', creditRole: 'a peacemaker', biography: 'Lives on the reservation.', biographyInCredits: true })
		);
		expect(credit).toMatchObject({ line: 'a peacemaker', biography: null });
	});

	it('uses the printed name the person wrote', () => {
		const credit = creditOf(answers({ givenName: 'Ada', familyName: 'Lovelace', creditName: 'A. A. Lovelace', creditForm: 'name' }));
		expect(credit?.line).toBe('A. A. Lovelace');
	});
});

describe('answers needed before confirming', () => {
	it('asks only for a name, adulthood, one kind of help and a credit choice', () => {
		const ready = answers({ givenName: 'Ada', thirteenOrOlder: true, interests: ['review'], creditForm: 'none' });
		expect(missingAnswers(ready)).toEqual({});
		expect(Object.keys(missingAnswers(emptyAnswers)).sort()).toEqual(
			['thirteenOrOlder', 'creditForm', 'givenName', 'interests'].sort()
		);
	});

	it('never requires a nation, a phone number or a family name', () => {
		const ready = answers({ givenName: 'Ada', thirteenOrOlder: true, interests: ['research'], creditForm: 'name', nationAnswer: 'not-saying' });
		expect(missingAnswers(ready)).toEqual({});
	});

	it('asks for a phone number only when the person wants calls or texts', () => {
		const ready = answers({ givenName: 'Ada', thirteenOrOlder: true, interests: ['research'], creditForm: 'none', preferredContact: 'phone' });
		expect(Object.keys(missingAnswers(ready))).toEqual(['phone']);
	});
});

describe('the profile form', () => {
	const nations = [{ identifier: 'sample-nation', title: 'Sample Nation' }];

	function form(entries: [string, string][]): FormData {
		const data = new FormData();
		for (const [name, value] of entries) data.append(name, value);
		return data;
	}

	it('matches a typed nation to the project’s list and keeps any other name as written', () => {
		const result = readProfileForm(
			form([
				['givenName', 'Ada'],
				['nationAnswer', 'listed'],
				['nation1Name', 'sample nation'],
				['nation1Credit', 'yes'],
				['nation2Name', 'Nation Not Listed'],
				['interests', 'review'],
				['interests', 'not-a-choice']
			]),
			nations
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.answers.nations).toEqual([
			{ nationIdentifier: 'sample-nation', nationName: 'Sample Nation', connection: null, showInCredit: true },
			{ nationIdentifier: null, nationName: 'Nation Not Listed', connection: null, showInCredit: false }
		]);
		expect(result.answers.interests).toEqual(['review']);
	});

	it('drops listed nations when the person chose not to say', () => {
		const result = readProfileForm(form([['nationAnswer', 'not-saying'], ['nation1Name', 'Sample Nation']]), nations);
		expect(result.ok && result.answers.nations).toEqual([]);
	});

	it('accepts phone numbers in familiar formats and refuses other text', () => {
		for (const phone of ['+1 702 555 0123', '(702) 555-0123', '702.555.0123 ext. 12', '+44 20 7946 0958']) {
			expect(isPlausiblePhone(phone), phone).toBe(true);
		}
		for (const phone of ['call me', '12345', '+1 702 555 0123 4567 8901']) {
			expect(isPlausiblePhone(phone), phone).toBe(false);
		}
		const result = readProfileForm(form([['phone', 'call me']]), nations);
		expect(result.ok).toBe(false);
	});
});

describe('where a new credit goes', () => {
	it('puts writers under Contributors, reviewers under Reviewers, and everyone else under Thanks', () => {
		expect(defaultCreditSection(['review', 'write'])).toBe('contributors');
		expect(defaultCreditSection(['review'])).toBe('reviewers');
		expect(defaultCreditSection(['research'])).toBe('acknowledgments');
	});
});
