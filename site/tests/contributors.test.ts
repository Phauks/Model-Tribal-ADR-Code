import { describe, expect, it } from 'vitest';
import {
	ageGroupOf,
	answersFromSnapshot,
	creditIn,
	creditOf,
	creditsOf,
	defaultCreditSection,
	emptyAnswers,
	emptyPlacements,
	missingAnswers,
	nationNameForCredit,
	pageNameOf,
	type NationAffiliation,
	type PlacedAnswer,
	type Placement,
	type ProfileAnswers
} from '#lib/contributors.ts';
import { phoneNumberOf, readProfileForm } from '#lib/server/contributor-form.ts';

const both: Placement = { book: true, website: true };
const year = 2026;

function answers(changes: Partial<ProfileAnswers>, placed: Partial<Record<PlacedAnswer, Placement>> = {}): ProfileAnswers {
	return { ...emptyAnswers, ageGroup: '18-or-older', ...changes, placements: { ...emptyPlacements(), ...placed } };
}

const nation = (name: string, placement: Placement): NationAffiliation => ({
	nationIdentifier: null,
	nationName: name,
	relationships: ['citizen'],
	relationshipOther: null,
	...placement
});

describe('credit lines', () => {
	it('prints the given and family name and sorts by family name', () => {
		const credit = creditOf(answers({ givenName: 'Ada', familyName: 'Lovelace' }, { 'full-name': both }));
		expect(credit).toMatchObject({ line: 'Ada Lovelace', sortKey: 'lovelace', inBook: true, onWebsite: true });
	});

	it('adds other names in brackets, then the nations and organization ticked for that place', () => {
		const person = answers(
			{
				givenName: 'Sample',
				familyName: 'Name',
				names: [{ name: 'Sample Native Name', kind: 'native', ...both }, { name: 'Sam', kind: 'goes-by', book: false, website: false }],
				nations: [nation('Navajo Nation, Arizona, New Mexico, & Utah', both), nation('Second Nation', { book: false, website: true })],
				organization: 'Sample Program'
			},
			{ 'full-name': both, organization: { book: false, website: true } }
		);
		expect(creditIn(person, 'book')?.line).toBe('Sample Name (Sample Native Name), Navajo Nation');
		expect(creditIn(person, 'website')?.line).toBe('Sample Name (Sample Native Name), Navajo Nation; Second Nation, Sample Program');
		expect(creditsOf(person)).toHaveLength(2);
	});

	it('gives one credit for both places when they read the same', () => {
		const credits = creditsOf(answers({ givenName: 'Ada' }, { 'full-name': both }));
		expect(credits).toEqual([expect.objectContaining({ line: 'Ada', inBook: true, onWebsite: true })]);
	});

	it('never credits someone who ticked no name or description', () => {
		expect(creditsOf(answers({ givenName: 'Ada', organization: 'Somewhere' }, { organization: both }))).toEqual([]);
	});

	it('uses the description in place of a name, without the biography', () => {
		const credit = creditOf(answers({ description: 'a peacemaker', biography: 'Lives on the reservation.' }, { description: both, biography: both }));
		expect(credit).toMatchObject({ line: 'a peacemaker', biography: null });
	});

	it('publishes only a pen name for someone under 18, and never their full name, picture or biography', () => {
		const minor = answers(
			{
				ageGroup: '13-to-17',
				givenName: 'Ada',
				biography: 'Too much.',
				names: [{ name: 'Native Name', kind: 'native', ...both }, { name: 'Pen Name', kind: 'pen-name', ...both }]
			},
			{ 'full-name': both, biography: both, picture: both }
		);
		expect(creditOf(minor)).toMatchObject({ line: 'Pen Name', biography: null });
		expect(pageNameOf(minor)).toBe('Pen Name');
	});

	it('never prints what only the website can show', () => {
		const person = answers({ givenName: 'Ada', pronouns: ['she'] }, { 'full-name': both, pronouns: both, picture: both, specialties: both });
		expect(creditIn(person, 'book')?.line).toBe('Ada');
	});

	it('gives a contributor page only to a name on the website', () => {
		expect(pageNameOf(answers({ givenName: 'Ada' }, { 'full-name': { book: true, website: false } }))).toBeNull();
		expect(pageNameOf(answers({ description: 'a peacemaker' }, { description: both }))).toBeNull();
		expect(pageNameOf(answers({ givenName: 'Ada' }, { 'full-name': both }))).toBe('Ada');
	});

	it('leaves the states off a nation’s name from the federal list', () => {
		expect(nationNameForCredit('Navajo Nation, Arizona, New Mexico, & Utah')).toBe('Navajo Nation');
		expect(nationNameForCredit('Pueblo of Acoma, New Mexico')).toBe('Pueblo of Acoma');
		expect(nationNameForCredit('Sample Band of Sample Indians, Sample Reservation')).toBe('Sample Band of Sample Indians, Sample Reservation');
	});
});

describe('age from the birth year', () => {
	it('asks about a birthday only in the year someone turns 13 or 18', () => {
		expect(ageGroupOf({ birthYear: 1985, birthdayAnswer: null, birthdayAnswerYear: null }, year)).toBe('18-or-older');
		expect(ageGroupOf({ birthYear: 2011, birthdayAnswer: null, birthdayAnswerYear: null }, year)).toBe('13-to-17');
		expect(ageGroupOf({ birthYear: 2008, birthdayAnswer: null, birthdayAnswerYear: null }, year)).toBeNull();
		expect(ageGroupOf({ birthYear: 2008, birthdayAnswer: 'yes', birthdayAnswerYear: year }, year)).toBe('18-or-older');
		expect(ageGroupOf({ birthYear: 2008, birthdayAnswer: 'no', birthdayAnswerYear: year }, year)).toBe('13-to-17');
		expect(ageGroupOf({ birthYear: 2013, birthdayAnswer: 'no', birthdayAnswerYear: year }, year)).toBe('under-13');
		expect(ageGroupOf({ birthYear: 2014, birthdayAnswer: null, birthdayAnswerYear: null }, year)).toBe('under-13');
	});

	it('counts a birthday answer only in the year it was given', () => {
		expect(ageGroupOf({ birthYear: 2008, birthdayAnswer: 'no', birthdayAnswerYear: year - 1 }, year)).toBeNull();
	});
});

describe('answers needed before confirming', () => {
	const ready = { givenName: 'Ada', birthYear: 1985, interests: ['review' as const] };

	it('asks only for a name, a birth year and one kind of help', () => {
		expect(missingAnswers(answers(ready), year)).toEqual({});
		expect(Object.keys(missingAnswers(emptyAnswers, year)).sort()).toEqual(['birthYear', 'givenName', 'interests']);
	});

	it('asks the birthday question in the year someone turns 18, and turns away someone under 13', () => {
		expect(missingAnswers(answers({ ...ready, birthYear: 2008 }), year).birthYear).toMatch(/18th birthday/);
		expect(missingAnswers(answers({ ...ready, birthYear: 2015 }), year).birthYear).toMatch(/13 or older/);
	});

	it('needs Call or Text on a preferred phone, a nation when the person said they would list one, and a description that is ticked', () => {
		const phone = { kind: 'phone' as const, value: '+17025550134', country: 'US', signIn: false, mayEmail: false, mayCall: false, mayText: false, preferred: true };
		const missing = missingAnswers(answers({ ...ready, contacts: [phone], nationAnswer: 'listed' }, { description: both }), year);
		expect(Object.keys(missing).sort()).toEqual(['contacts', 'description', 'nations']);
	});
});

describe('the profile form', () => {
	const nations = [{ identifier: 'sample-nation', title: 'Sample Nation, Arizona' }];
	const email = 'person@example.org';

	function form(entries: [string, string][]): FormData {
		const data = new FormData();
		for (const [name, value] of entries) data.append(name, value);
		return data;
	}

	it('reads repeatable rows in order, each with its own Book and Website choices', () => {
		const result = readProfileForm(
			form([
				['givenName', ' Ada '],
				['book', 'full-name'],
				['website', 'full-name'],
				['nameRow', 'b'],
				['nameRow', 'a'],
				['nameRow', 'empty'],
				['name-a', 'Second'],
				['nameKind-a', 'pen-name'],
				['name-b', 'First'],
				['nameKind-b', 'not-a-kind'],
				['website', 'name-b'],
				['interests', 'review'],
				['interests', 'not-a-choice']
			]),
			nations,
			email,
			year
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.answers.givenName).toBe('Ada');
		expect(result.answers.placements['full-name']).toEqual(both);
		expect(result.answers.names).toEqual([
			{ name: 'First', kind: 'other', book: false, website: true },
			{ name: 'Second', kind: 'pen-name', book: false, website: false }
		]);
		expect(result.answers.interests).toEqual(['review']);
	});

	it('picks nations from the list by identifier, keeps others as written, and keeps each relationship separately', () => {
		const result = readProfileForm(
			form([
				['nationAnswer', 'listed'],
				['nationRow', 'x'],
				['nation-x', 'sample-nation'],
				['relationship-x', 'citizen'],
				['relationship-x', 'works-for'],
				['relationship-x', 'not-a-relationship'],
				['book', 'nation-x'],
				['nationRow', 'y'],
				['nation-y', 'other'],
				['nationOther-y', 'Nation Not Listed'],
				['relationship-y', 'other'],
				['relationshipOther-y', 'Friend of the court'],
				['nationRow', 'z'],
				['nation-z', 'unknown-identifier']
			]),
			nations,
			email,
			year
		);
		expect(result.ok && result.answers.nations).toEqual([
			{ nationIdentifier: 'sample-nation', nationName: 'Sample Nation, Arizona', relationships: ['citizen', 'works-for'], relationshipOther: null, book: true, website: false },
			{ nationIdentifier: null, nationName: 'Nation Not Listed', relationships: ['other'], relationshipOther: 'Friend of the court', book: false, website: false }
		]);
	});

	it('drops listed nations when the person chose not to say', () => {
		const result = readProfileForm(form([['nationAnswer', 'not-saying'], ['nationRow', 'x'], ['nation-x', 'sample-nation']]), nations, email, year);
		expect(result.ok && result.answers.nations).toEqual([]);
	});

	it('always keeps the sign-in address, and stores phone numbers in international form', () => {
		const result = readProfileForm(
			form([
				['contactRow', 's'],
				['contactKind-s', 'sign-in'],
				['mayEmail', 's'],
				['contactRow', 'p'],
				['contactKind-p', 'phone'],
				['phone-pCountry', 'US'],
				['phone-pNumber', '(702) 555-0134'],
				['mayText', 'p'],
				['preferred', 'p']
			]),
			nations,
			'signed-in@example.org',
			year
		);
		expect(result.ok && result.answers.contacts).toEqual([
			{ kind: 'email', value: 'signed-in@example.org', country: null, signIn: true, mayEmail: true, mayCall: false, mayText: false, preferred: false },
			{ kind: 'phone', value: '+17025550134', country: 'US', signIn: false, mayEmail: false, mayCall: false, mayText: true, preferred: true }
		]);
		const none = readProfileForm(form([]), nations, email, year);
		expect(none.ok && none.answers.contacts).toEqual([
			{ kind: 'email', value: email, country: null, signIn: true, mayEmail: true, mayCall: false, mayText: false, preferred: true }
		]);
	});

	it('puts a row’s problem under its place among the answers, so the form can show it beside the row', () => {
		const result = readProfileForm(
			form([
				['contactRow', 's'],
				['contactKind-s', 'sign-in'],
				['contactRow', 'e'],
				['contactKind-e', 'email'],
				['email-e', 'not an address'],
				['contactRow', 'p'],
				['contactKind-p', 'phone'],
				['phone-pCountry', 'US'],
				['phone-pNumber', '12345'],
				['nameRow', 'n'],
				['name-n', 'x'.repeat(201)]
			]),
			nations,
			email,
			year
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(Object.keys(result.errors).sort()).toEqual(['contact-1', 'contact-2', 'name-0']);
		// The answers come back as written, so nothing typed is lost.
		expect(result.answers.contacts[1].value).toBe('not an address');
	});

	it('reads languages from the list or written in, with what the person does in each', () => {
		const result = readProfileForm(
			form([
				['languageRow', 'a'],
				['language-a', 'nav'],
				['speaks', 'a'],
				['writes', 'a'],
				['website', 'language-a'],
				['book', 'language-a'],
				['languageRow', 'b'],
				['language-b', 'other'],
				['languageOther-b', 'A Language'],
				['reads', 'b'],
				['languageRow', 'c'],
				['language-c', 'not-a-code']
			]),
			nations,
			email,
			year
		);
		expect(result.ok && result.answers.languages).toEqual([
			{ code: 'nav', otherName: null, speaks: true, reads: false, writes: true, website: true },
			{ code: null, otherName: 'A Language', speaks: false, reads: true, writes: false, website: false }
		]);
	});

	it('takes a birth year only from the list', () => {
		expect(readProfileForm(form([['birthYear', '1985']]), nations, email, year)).toMatchObject({ ok: true, answers: { birthYear: 1985 } });
		expect(readProfileForm(form([['birthYear', '2020']]), nations, email, year)).toMatchObject({ ok: false, errors: { birthYear: expect.any(String) } });
	});
});

describe('phone numbers', () => {
	it('checks the digits against the country’s numbering plan', () => {
		expect(phoneNumberOf('US', '702 555 0134')).toEqual({ ok: true, value: '+17025550134', country: 'US' });
		expect(phoneNumberOf('GB', '020 7946 0958')).toMatchObject({ ok: true, value: '+442079460958' });
		expect(phoneNumberOf('US', '12345').ok).toBe(false);
		expect(phoneNumberOf('US', 'call me').ok).toBe(false);
	});
});

describe('answers kept before the redesign', () => {
	it('reads an earlier confirmed version as the same credit', () => {
		const old = {
			givenName: 'Ada',
			familyName: 'Lovelace',
			nativeName: 'Another Name',
			creditForm: 'name-and-nation',
			creditInBook: true,
			creditOnWebsite: true,
			nations: [
				{ nationIdentifier: 'a', nationName: 'First Nation', connection: 'citizen', showInCredit: true },
				{ nationIdentifier: null, nationName: 'Second Nation', connection: null, showInCredit: false }
			],
			specialtyOther: 'Weaving',
			ageGroup: '18-or-older'
		};
		const upgraded = answersFromSnapshot(JSON.stringify(old));
		expect(creditOf(upgraded)).toMatchObject({ line: 'Ada Lovelace, First Nation', inBook: true, onWebsite: true });
		expect(upgraded.names).toEqual([{ name: 'Another Name', kind: 'native', book: false, website: false }]);
		expect(upgraded.specialtyOthers).toEqual(['Weaving']);
	});

	it('keeps a printed name the person wrote in place of their own', () => {
		const old = { givenName: 'Ada', familyName: 'Lovelace', creditName: 'A. A. Lovelace', creditForm: 'name', creditInBook: true, creditOnWebsite: false, ageGroup: '18-or-older' };
		expect(creditsOf(answersFromSnapshot(JSON.stringify(old)))).toEqual([expect.objectContaining({ line: 'A. A. Lovelace', inBook: true, onWebsite: false })]);
	});

	it('reads a new snapshot as it was saved', () => {
		const saved = answers({ givenName: 'Ada' }, { 'full-name': both });
		expect(answersFromSnapshot(JSON.stringify(saved))).toEqual(saved);
	});
});

describe('where a new credit goes', () => {
	it('puts writers under Contributors, reviewers under Reviewers, and everyone else under Thanks', () => {
		expect(defaultCreditSection(['review', 'write'])).toBe('contributors');
		expect(defaultCreditSection(['review'])).toBe('reviewers');
		expect(defaultCreditSection(['research'])).toBe('acknowledgments');
	});
});
