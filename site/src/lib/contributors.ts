/**
 * Contributor registration and profiles (docs/contributor-profiles.md):
 * the choices a person makes, their labels, and how a credit line is built
 * from them. Shared by the profile pages and the workspace, and free of
 * server code so the pages can show a live preview of the credit.
 */

export const interests = [
	'write',
	'review',
	'share-knowledge',
	'research',
	'translate',
	'art',
	'outreach',
	'website'
] as const;
export type Interest = (typeof interests)[number];

export const interestLabels: Record<Interest, string> = {
	write: 'Write an essay or commentary',
	review: 'Review drafts for accuracy and tone',
	'share-knowledge': 'Share knowledge or experience of how disputes are resolved',
	research: 'Find and check sources',
	translate: 'Translate',
	art: 'Make art for the book (through the art contest)',
	outreach: 'Help reach Native nations and organizations',
	website: 'Help with the website'
};

/** What each kind of help needs next, so the person knows before they confirm. */
export const interestNextSteps: Record<Interest, string> = {
	write:
		'Writers are asked for a short biography for the list of contributors, and sign a co-author agreement before their writing is used.',
	review: 'Reviewers see drafts in the workspace once the lead author gives them access.',
	'share-knowledge':
		'Anything you share for the book is filed with its own contributor statement, where you choose how it may be used. Signing up is not permission to use it.',
	research: 'Researchers get access to sources and research notes.',
	translate: 'We will ask which languages and which pages before any work starts.',
	art: 'Art is chosen through a contest for Native artists, with a written agreement for each artist.',
	outreach: 'Contact with a nation goes through the nation’s own offices first.',
	website: 'Website changes go through the public code on GitHub.'
};

export const availabilities = ['occasionally', 'monthly', 'weekly'] as const;
export type Availability = (typeof availabilities)[number];

export const availabilityLabels: Record<Availability, string> = {
	occasionally: 'Now and then, for a single task',
	monthly: 'A few hours a month',
	weekly: 'A few hours a week'
};

/**
 * Names beyond the first and last name, as many as a person likes (Trevor,
 * Nov. 23, 2026: "allow for adding additional name fields, more than one").
 * "Name in my language" replaced "Native name" (Trevor, Nov. 24, 2026).
 */
export const nameKinds = ['native', 'goes-by', 'pen-name', 'other'] as const;
export type NameKind = (typeof nameKinds)[number];

export const nameKindLabels: Record<NameKind, string> = {
	native: 'Name in my language',
	'goes-by': 'Name I go by',
	'pen-name': 'Pen name',
	other: 'Other'
};

/**
 * Where one answer may appear (Trevor, Nov. 24, 2026: "Shown" did not say
 * whether it meant online or in anything published). Book is the printed
 * book and the ebook; Website is the credits on the website and the person's
 * contributor page. An answer ticked for neither is never published.
 */
export interface Placement {
	book: boolean;
	website: boolean;
}

export const unpublished: Placement = { book: false, website: false };

export interface ProfileName extends Placement {
	name: string;
	kind: NameKind;
}

/** Ways to reach someone, each with what it may be used for (Trevor, Nov. 23, 2026: "contacts should be a table to show what can and cannot be used"). Contacts are never published. */
export const contactKinds = ['email', 'phone'] as const;
export type ContactKind = (typeof contactKinds)[number];

export interface ProfileContact {
	kind: ContactKind;
	/** An email address, or a phone number in E.164 form, such as +17025550134. */
	value: string;
	/** The phone number's country, as an ISO 3166-1 alpha-2 code, such as US. */
	country: string | null;
	/** The address the person signed in with, which is always listed. */
	signIn: boolean;
	mayEmail: boolean;
	mayCall: boolean;
	mayText: boolean;
	/** The one way the person would most like to be reached. */
	preferred: boolean;
}

/**
 * A person's relationships to a nation; several may apply (Trevor, Nov. 23,
 * 2026: "member, and works there"). Each is stored as its own row, so
 * changing one never touches another (Trevor, Nov. 24, 2026).
 */
export const nationRelationships = ['citizen', 'descendant', 'family', 'community', 'works-for', 'works-with', 'other'] as const;
export type NationRelationship = (typeof nationRelationships)[number];

export const nationRelationshipLabels: Record<NationRelationship, string> = {
	citizen: 'Citizen or member',
	descendant: 'Descendant',
	family: 'Family by marriage or adoption',
	community: 'Live in the community',
	'works-for': 'Work for the nation',
	'works-with': 'Work with the nation',
	other: 'Other'
};

/** Pronouns, from a short list; several may apply, and "Other" is written in (Trevor, Nov. 24, 2026). Shown only on the website. */
export const pronounChoices = ['she', 'he', 'they', 'name-only', 'other', 'not-saying'] as const;
export type PronounChoice = (typeof pronounChoices)[number];

export const pronounLabels: Record<PronounChoice, string> = {
	she: 'she/her',
	he: 'he/him',
	they: 'they/them',
	'name-only': 'Use my name',
	other: 'Other',
	'not-saying': 'I’d rather not say'
};

export interface ProfileLanguage {
	/** The ISO 639-3 code from src/lib/languages.ts, or null for a language written in. */
	code: string | null;
	/** The language's name as the person wrote it, when it is not in the list. */
	otherName: string | null;
	speaks: boolean;
	reads: boolean;
	writes: boolean;
	/** Listed on the person's contributor page. Languages are never printed. */
	website: boolean;
}

export const nationAnswers = ['listed', 'none', 'not-saying'] as const;
export type NationAnswer = (typeof nationAnswers)[number];

export const nationAnswerLabels: Record<NationAnswer, string> = {
	listed: 'Yes, I’d like to list one or more',
	none: 'No, I’m not connected to a Native nation',
	'not-saying': 'I’d rather not say'
};

/** Where the project places a credit in the book. Set by the lead author, not the person. */
export const creditSections = ['acknowledgments', 'reviewers', 'contributors'] as const;
export type CreditSection = (typeof creditSections)[number];

export const creditSectionLabels: Record<CreditSection, string> = {
	acknowledgments: 'Acknowledgments',
	reviewers: 'Reviewers',
	contributors: 'Contributors (with biographies)'
};

/** Where a credit goes until the lead author moves it: writers under Contributors, reviewers under Reviewers, everyone else under Thanks. */
export function defaultCreditSection(chosen: readonly Interest[]): CreditSection {
	if (chosen.includes('write')) return 'contributors';
	if (chosen.includes('review')) return 'reviewers';
	return 'acknowledgments';
}

/** Age groups. Signing up is for people 13 or older; people under 18 are credited only by a description or a chosen name (docs/contributions.md, "Contributors under the age of majority"). */
export const ageGroups = ['13-to-17', '18-or-older'] as const;
export type AgeGroup = (typeof ageGroups)[number];

export const ageGroupLabels: Record<AgeGroup, string> = {
	'13-to-17': '13 to 17',
	'18-or-older': '18 or older'
};

/** The youngest and oldest ages the birth year list offers. */
export const youngestAge = 13;
export const oldestAge = 110;

/**
 * How old a person is, from their birth year (Trevor, Nov. 23, 2026: "why not
 * just birth year?"). In the year someone turns 13 or 18 the year cannot say
 * which side of the line they are on, so only then is a birthday asked, and
 * the answer counts only in the year it was given. Null when that question is
 * unanswered; "under-13" when they have not yet turned 13.
 */
export function ageGroupOf(
	answers: Pick<ProfileAnswers, 'birthYear' | 'birthdayAnswer' | 'birthdayAnswerYear'>,
	year: number
): AgeGroup | 'under-13' | null {
	if (answers.birthYear === null) return null;
	const turning = year - answers.birthYear;
	const hadBirthday = answers.birthdayAnswerYear === year ? answers.birthdayAnswer : null;
	if (turning < 13) return 'under-13';
	if (turning === 13) return hadBirthday === 'yes' ? '13-to-17' : hadBirthday === 'no' ? 'under-13' : null;
	if (turning < 18) return '13-to-17';
	if (turning === 18) return hadBirthday === 'yes' ? '18-or-older' : hadBirthday === 'no' ? '13-to-17' : null;
	return '18-or-older';
}

/** The age at which a birthday question is asked this year, or null. */
export function birthdayQuestionAge(birthYear: number | null, year: number): 13 | 18 | null {
	if (birthYear === null) return null;
	const turning = year - birthYear;
	return turning === 13 || turning === 18 ? turning : null;
}

/**
 * Specialties a person may choose to show with their name on the People page
 * and their own page (lead author, 2026-11-23). Optional; "Other" is written
 * in the person's own words.
 */
export const specialties = ['peacemaking', 'mediation', 'tribal-courts', 'tribal-codes', 'language', 'research'] as const;
export type Specialty = (typeof specialties)[number];

export const specialtyLabels: Record<Specialty, string> = {
	peacemaking: 'Peacemaking',
	mediation: 'Mediation',
	'tribal-courts': 'Tribal courts',
	'tribal-codes': 'Tribal codes and constitutions',
	language: 'Language and translation',
	research: 'Research and sources'
};

/** The specialties to show, in list order, then the person's own words. */
export function specialtiesShown(answers: Pick<ProfileAnswers, 'specialties' | 'specialtyOthers'>): string[] {
	const chosen = new Set(answers.specialties ?? []);
	return [...specialties.filter((specialty) => chosen.has(specialty)).map((specialty) => specialtyLabels[specialty]), ...(answers.specialtyOthers ?? [])];
}

export const profileStatuses = ['draft', 'submitted', 'welcomed', 'declined'] as const;
export type ProfileStatus = (typeof profileStatuses)[number];

export const profileStatusLabels: Record<ProfileStatus, string> = {
	draft: 'Not sent yet',
	submitted: 'Sent',
	welcomed: 'Signed up',
	declined: 'Removed'
};

export interface NationAffiliation extends Placement {
	/** The content/tribes record, when the nation is picked from the project's list. */
	nationIdentifier: string | null;
	/** The record's name, or the name as the person wrote it. */
	nationName: string;
	relationships: NationRelationship[];
	/** The relationship in the person's own words, when they chose Other. */
	relationshipOther: string | null;
}

/** Answers that appear once, each with where it may appear. Things never printed are kept off the book by placementOf. */
export const placedAnswers = ['full-name', 'picture', 'pronouns', 'organization', 'specialties', 'description', 'biography'] as const;
export type PlacedAnswer = (typeof placedAnswers)[number];

/** Answers that only the website can show: a book credit is one line of text. */
export const websiteOnly: readonly PlacedAnswer[] = ['picture', 'pronouns', 'specialties'];

/** Answers never published for someone under 18, so nothing beside a chosen name can identify them. */
export const adultsOnly: readonly PlacedAnswer[] = ['full-name', 'picture', 'biography'];

/** Everything the person tells the project. The sign-in email address is the first contact. */
export interface ProfileAnswers {
	givenName: string | null;
	familyName: string | null;
	/** Other names, in the order the person put them. */
	names: ProfileName[];
	pronouns: PronounChoice[];
	pronounOther: string | null;
	birthYear: number | null;
	/** The answer to "Have you had your 13th (or 18th) birthday yet?", asked only in that year. */
	birthdayAnswer: 'yes' | 'no' | null;
	birthdayAnswerYear: number | null;
	/** Worked out from the birth year when the answers are read or saved; kept in each confirmed version. */
	ageGroup: AgeGroup | null;
	contacts: ProfileContact[];
	nationAnswer: NationAnswer | null;
	nations: NationAffiliation[];
	background: string | null;
	languages: ProfileLanguage[];
	organization: string | null;
	interests: Interest[];
	specialties: Specialty[];
	/** Specialties in the person's own words. */
	specialtyOthers: string[];
	availability: Availability | null;
	/** A description to print in place of a name, such as "a peacemaker from the nation". */
	description: string | null;
	biography: string | null;
	placements: Record<PlacedAnswer, Placement>;
}

export function emptyPlacements(): Record<PlacedAnswer, Placement> {
	return Object.fromEntries(placedAnswers.map((item) => [item, { ...unpublished }])) as Record<PlacedAnswer, Placement>;
}

export const emptyAnswers: ProfileAnswers = {
	givenName: null,
	familyName: null,
	names: [],
	pronouns: [],
	pronounOther: null,
	birthYear: null,
	birthdayAnswer: null,
	birthdayAnswerYear: null,
	ageGroup: null,
	contacts: [],
	nationAnswer: null,
	nations: [],
	background: null,
	languages: [],
	organization: null,
	interests: [],
	specialties: [],
	specialtyOthers: [],
	availability: null,
	description: null,
	biography: null,
	placements: emptyPlacements()
};

/** Where an answer may appear, after the rules: never in the book if only the website can show it, never at all for someone under 18 if it could identify them. */
export function placementOf(answers: Pick<ProfileAnswers, 'placements' | 'ageGroup'>, item: PlacedAnswer): Placement {
	const placed = answers.placements?.[item] ?? unpublished;
	if (adultsOnly.includes(item) && answers.ageGroup !== '18-or-older') return { ...unpublished };
	return { book: websiteOnly.includes(item) ? false : placed.book, website: placed.website };
}

/** Whether a name may appear in a place: someone under 18 may show only a pen name. */
function nameAllowed(answers: Pick<ProfileAnswers, 'ageGroup'>, name: ProfileName): boolean {
	return Boolean(name.name) && (answers.ageGroup === '18-or-older' || name.kind === 'pen-name');
}

/** The person's name in the usual order: given names, then family name, when there is one. */
export function fullName(answers: Pick<ProfileAnswers, 'givenName' | 'familyName'>): string {
	return [answers.givenName, answers.familyName].filter(Boolean).join(' ');
}

const stateNames = new Set([
	'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia',
	'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland',
	'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
	'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina',
	'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
]);

/**
 * A nation's name for a credit line, without the states the Bureau of Indian
 * Affairs list puts after it: "Navajo Nation, Arizona, New Mexico, & Utah"
 * prints as "Navajo Nation". Only a trailing run of state names is removed,
 * so a name with any other words after its last comma is printed whole.
 */
export function nationNameForCredit(official: string): string {
	const parts = official.split(',');
	let end = parts.length;
	while (end > 1 && stateNames.has(parts[end - 1].trim().replace(/^(&|and)\s+/u, ''))) end -= 1;
	return parts.slice(0, end).join(',').trim();
}

export interface Credit {
	/** The line as it appears in the book or on the website. */
	line: string;
	/** What the list of credits is sorted by: the family name when there is one. */
	sortKey: string;
	biography: string | null;
	inBook: boolean;
	onWebsite: boolean;
}

export type Place = 'book' | 'website';

/** The name part of a credit in one place: the full name with other names after it in brackets, or the other names alone. */
function namesIn(answers: ProfileAnswers, place: Place): { line: string; sortKey: string } | null {
	const full = placementOf(answers, 'full-name')[place] ? fullName(answers) : '';
	const others = (answers.names ?? []).filter((name) => name[place] && nameAllowed(answers, name)).map((name) => name.name);
	if (full) return { line: [full, ...others.map((name) => `(${name})`)].join(' '), sortKey: answers.familyName || full };
	if (others.length > 0) return { line: others.join(' '), sortKey: others.join(' ') };
	return null;
}

/**
 * The credit as it will read in one place, or null for none there. It is
 * built only from answers ticked for that place: the names, or else the
 * description; then the nations and the organization. Contact details, age
 * and anything private never appear.
 */
export function creditIn(answers: ProfileAnswers, place: Place): Credit | null {
	const named = namesIn(answers, place);
	const description = placementOf(answers, 'description')[place] ? (answers.description?.trim() ?? '') : '';
	let line = named?.line ?? description;
	if (!line) return null;
	const nations = answers.nations.filter((nation) => nation[place]).map((nation) => nationNameForCredit(nation.nationName));
	if (nations.length > 0) line += `, ${nations.join('; ')}`;
	if (placementOf(answers, 'organization')[place] && answers.organization) line += `, ${answers.organization}`;
	return {
		line,
		sortKey: (named?.sortKey ?? line).toLocaleLowerCase('en-US'),
		// A biography could identify someone credited only by a description.
		biography: named && placementOf(answers, 'biography')[place] ? answers.biography : null,
		inBook: place === 'book',
		onWebsite: place === 'website'
	};
}

/** The credits as printed: one when the book and the website read the same, otherwise one for each place used. */
export function creditsOf(answers: ProfileAnswers): Credit[] {
	const book = creditIn(answers, 'book');
	const website = creditIn(answers, 'website');
	if (book && website && book.line === website.line && book.biography === website.biography) return [{ ...book, onWebsite: true }];
	return [book, website].filter((credit): credit is Credit => credit !== null);
}

/** The main credit line, the book's when there is one, for lists that show one line per person. */
export function creditOf(answers: ProfileAnswers): Credit | null {
	return creditsOf(answers)[0] ?? null;
}

/** Fields that must be answered before the person can confirm, with the message to show. */
export function missingAnswers(answers: ProfileAnswers, year: number): Record<string, string> {
	const missing: Record<string, string> = {};
	if (!answers.givenName) missing.givenName = 'Give the name you would like us to use.';
	const age = ageGroupOf(answers, year);
	if (answers.birthYear === null) missing.birthYear = 'Choose the year you were born.';
	else if (age === null) missing.birthYear = `Say whether you have had your ${birthdayQuestionAge(answers.birthYear, year)}th birthday yet.`;
	else if (age === 'under-13') {
		missing.birthYear =
			'Signing up on the website is for people 13 or older. Someone younger can help with a parent or guardian through the request form.';
	}
	const preferred = answers.contacts.find((contact) => contact.preferred);
	if (preferred && preferred.kind === 'phone' && !preferred.mayCall && !preferred.mayText) {
		missing.contacts = 'Tick Call or Text for the number you prefer, or choose another way to reach you.';
	}
	if (answers.nationAnswer === 'listed' && answers.nations.length === 0) {
		missing.nations = 'Name at least one nation, or choose another answer.';
	}
	if (answers.interests.length === 0) missing.interests = 'Choose at least one way you would like to help.';
	const describe = answers.placements?.description ?? unpublished;
	if ((describe.book || describe.website) && !answers.description) {
		missing.description = 'Write the description to print, or untick Book and Website beside it.';
	}
	if (answers.interests.includes('write') && !answers.biography) {
		missing.biography = 'Writers are asked for a short biography for the list of contributors.';
	}
	return missing;
}

/**
 * The name a person's public page goes by, or null for no page: only for a
 * website credit with a name. A description is not a name, so it gets no
 * page.
 */
export function pageNameOf(answers: ProfileAnswers): string | null {
	return namesIn(answers, 'website')?.line ?? null;
}

/** Fills in answers kept before the November 2026 redesign, so old confirmed versions read the same way as new ones. */
export function answersFromSnapshot(snapshot: string): ProfileAnswers {
	const saved = JSON.parse(snapshot) as Partial<ProfileAnswers> & Record<string, unknown>;
	if (saved.placements) return { ...emptyAnswers, ...saved } as ProfileAnswers;
	return upgradeAnswers(saved);
}

/** The redesign's answers from the earlier shape, which chose one form of credit and two places for all of it. */
export function upgradeAnswers(old: Record<string, unknown>): ProfileAnswers {
	const text = (key: string) => (typeof old[key] === 'string' && old[key] ? (old[key] as string) : null);
	const form = text('creditForm');
	const inBook = Boolean(old.creditInBook);
	const onWebsite = Boolean(old.creditOnWebsite);
	const where = (on: boolean): Placement => ({ book: on && inBook, website: on && onWebsite });
	const placements = emptyPlacements();
	const named = form === 'name' || form === 'name-and-nation';
	// A name the person wrote to print in place of their own stands in for it.
	const printed = named ? text('creditName') : null;
	placements['full-name'] = where(named && !printed);
	placements.description = where(form === 'role');
	placements.biography = where(Boolean(old.biographyInCredits) && form !== 'role');
	placements.specialties = { book: false, website: true };
	placements.picture = { book: false, website: true };
	const names: ProfileName[] = [];
	if (printed) names.push({ name: printed, kind: 'other', ...where(true) });
	if (text('nativeName')) names.push({ name: text('nativeName')!, kind: 'native', ...unpublished });
	if (text('creditPseudonym')) names.push({ name: text('creditPseudonym')!, kind: 'pen-name', ...where(form === 'pseudonym') });
	const nations = ((old.nations as Record<string, unknown>[] | undefined) ?? []).map((nation) => ({
		nationIdentifier: (nation.nationIdentifier as string | null) ?? null,
		nationName: String(nation.nationName ?? ''),
		relationships: nation.connection ? (['other'] as NationRelationship[]) : [],
		relationshipOther: (nation.connection as string | null) ?? null,
		...where(form === 'name-and-nation' && Boolean(nation.showInCredit))
	}));
	return {
		...emptyAnswers,
		givenName: text('givenName'),
		familyName: text('familyName'),
		names,
		ageGroup: (text('ageGroup') as AgeGroup | null) ?? null,
		nationAnswer: (text('nationAnswer') as NationAnswer | null) ?? null,
		nations,
		background: text('background'),
		languages: text('languages') ? [{ code: null, otherName: text('languages'), speaks: true, reads: false, writes: false, website: false }] : [],
		organization: text('organization'),
		interests: (old.interests as Interest[] | undefined) ?? [],
		specialties: (old.specialties as Specialty[] | undefined) ?? [],
		specialtyOthers: text('specialtyOther') ? [text('specialtyOther')!] : [],
		availability: (text('availability') as Availability | null) ?? null,
		description: text('creditRole'),
		biography: text('biography'),
		placements
	};
}

/** A page address from a name: lower case letters and digits joined by hyphens, accents removed. */
export function slugOf(name: string): string {
	return name
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLocaleLowerCase('en-US')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 60)
		.replace(/-+$/g, '');
}
