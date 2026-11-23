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

export const contactMethods = ['email', 'phone', 'text-message'] as const;
export type ContactMethod = (typeof contactMethods)[number];

export const contactMethodLabels: Record<ContactMethod, string> = {
	email: 'Email',
	phone: 'Phone call',
	'text-message': 'Text message'
};

/**
 * Names beyond the first and last name, as many as a person likes (Trevor,
 * Nov. 23, 2026: "allow for adding additional name fields, more than one").
 */
export const nameKinds = ['native', 'goes-by', 'pen-name', 'other'] as const;
export type NameKind = (typeof nameKinds)[number];

export const nameKindLabels: Record<NameKind, string> = {
	native: 'Native name',
	'goes-by': 'Name I go by',
	'pen-name': 'Pen name',
	other: 'Other'
};

export interface ProfileName {
	name: string;
	kind: NameKind;
	/** Printed with the credit. */
	shown: boolean;
}

/** Ways to reach someone, each with what it may be used for (Trevor, Nov. 23, 2026: "contacts should be a table to show what can and cannot be used"). */
export const contactKinds = ['email', 'phone'] as const;
export type ContactKind = (typeof contactKinds)[number];

export interface ProfileContact {
	kind: ContactKind;
	/** An email address, or a phone number in E.164 form, such as +17025550134. */
	value: string;
	/** The phone number's country, as an ISO 3166-1 alpha-2 code. */
	country: string | null;
	/** The address the person signed in with. It cannot be removed here. */
	signIn: boolean;
	mayEmail: boolean;
	mayCall: boolean;
	mayText: boolean;
	/** The one way the person would most like to be reached. */
	best: boolean;
}

/** How a person is connected to a nation; several may apply (Trevor, Nov. 23, 2026: "member, and works there"). */
export const nationConnections = ['citizen', 'descendant', 'family', 'community', 'works-for', 'works-with', 'other'] as const;
export type NationConnection = (typeof nationConnections)[number];

export const nationConnectionLabels: Record<NationConnection, string> = {
	citizen: 'Citizen or member',
	descendant: 'Descendant',
	family: 'Family by marriage or adoption',
	community: 'Live in the community',
	'works-for': 'Work for the nation',
	'works-with': 'Work with the nation',
	other: 'Other'
};

export interface ProfileLanguage {
	/** The ISO 639-3 code from src/lib/languages.ts, or null for a language written in. */
	code: string | null;
	/** The language's name as the person wrote it, when it is not in the list. */
	otherName: string | null;
	speaks: boolean;
	reads: boolean;
	/** Shown on the person's contributor page. */
	shown: boolean;
}

export const nationAnswers = ['listed', 'none', 'not-saying'] as const;
export type NationAnswer = (typeof nationAnswers)[number];

export const nationAnswerLabels: Record<NationAnswer, string> = {
	listed: 'Yes, I’d like to list one or more',
	none: 'No, I’m not connected to a Native nation',
	'not-saying': 'I’d rather not say'
};

/** The forms of credit in schemas/common.schema.json $defs.credit, in the same words as the contributor statement. */
export const creditForms = ['name', 'name-and-nation', 'role', 'pseudonym', 'none'] as const;
export type CreditForm = (typeof creditForms)[number];

export const creditFormLabels: Record<CreditForm, string> = {
	name: 'My name',
	'name-and-nation': 'My name and nation',
	role: 'A description only, for example “a peacemaker from the nation”',
	pseudonym: 'A name I choose',
	none: 'No credit'
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

/** Credit forms open to people under 18: a description, a chosen name, or none. */
export const minorCreditForms: readonly CreditForm[] = ['role', 'pseudonym', 'none'];

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

/** The specialties to show, in list order, then the person's own words; an older version without them shows none. */
export function specialtiesShown(answers: Pick<ProfileAnswers, 'specialties' | 'specialtyOther'>): string[] {
	const chosen = new Set(answers.specialties ?? []);
	const shown: string[] = specialties.filter((specialty) => chosen.has(specialty)).map((specialty) => specialtyLabels[specialty]);
	if (answers.specialtyOther) shown.push(answers.specialtyOther);
	return shown;
}

export const profileStatuses = ['draft', 'submitted', 'welcomed', 'declined'] as const;
export type ProfileStatus = (typeof profileStatuses)[number];

export const profileStatusLabels: Record<ProfileStatus, string> = {
	draft: 'Not sent yet',
	submitted: 'Sent',
	welcomed: 'Signed up',
	declined: 'Removed'
};

export interface NationAffiliation {
	/** The content/tribes record, when the nation is in the project's list. */
	nationIdentifier: string | null;
	nationName: string;
	connection: string | null;
	showInCredit: boolean;
}

/** Everything the person tells the project. The email address comes from sign-in. */
export interface ProfileAnswers {
	givenName: string | null;
	familyName: string | null;
	/** A Native name or another name the person goes by. Printed only if they write it in their credit. */
	nativeName: string | null;
	phone: string | null;
	preferredContact: ContactMethod | null;
	/** Empty until answered. Signing up needs 13 or older. */
	ageGroup: AgeGroup | null;
	nationAnswer: NationAnswer | null;
	nations: NationAffiliation[];
	background: string | null;
	languages: string | null;
	organization: string | null;
	interests: Interest[];
	/** Shown with the person's name on the website, when they have a contributor page. */
	specialties: Specialty[];
	specialtyOther: string | null;
	availability: Availability | null;
	creditForm: CreditForm | null;
	creditName: string | null;
	creditRole: string | null;
	creditPseudonym: string | null;
	creditInBook: boolean;
	creditOnWebsite: boolean;
	biography: string | null;
	biographyInCredits: boolean;
}

export const emptyAnswers: ProfileAnswers = {
	givenName: null,
	familyName: null,
	nativeName: null,
	phone: null,
	preferredContact: null,
	ageGroup: null,
	nationAnswer: null,
	nations: [],
	background: null,
	languages: null,
	organization: null,
	interests: [],
	specialties: [],
	specialtyOther: null,
	availability: null,
	creditForm: null,
	creditName: null,
	creditRole: null,
	creditPseudonym: null,
	creditInBook: true,
	creditOnWebsite: true,
	biography: null,
	biographyInCredits: false
};

/** The person's name in the usual order: given names, then family name, when there is one. */
export function fullName(answers: Pick<ProfileAnswers, 'givenName' | 'familyName'>): string {
	return [answers.givenName, answers.familyName].filter(Boolean).join(' ');
}

/** The name to print: the one the person wrote for credits, or their full name. */
export function printedName(answers: Pick<ProfileAnswers, 'givenName' | 'familyName' | 'creditName'>): string {
	return answers.creditName?.trim() || fullName(answers);
}

export interface Credit {
	/** The line as it appears in the book and on the website. */
	line: string;
	/** What the list of credits is sorted by: the family name when there is one. */
	sortKey: string;
	biography: string | null;
	inBook: boolean;
	onWebsite: boolean;
}

/**
 * The credit as it will be printed, or null for no credit. Nations appear
 * only when the person chose "name and nation" and ticked the nation;
 * contact details never appear.
 */
export function creditOf(answers: ProfileAnswers): Credit | null {
	if (!answers.creditForm || answers.creditForm === 'none') return null;
	if (!answers.creditInBook && !answers.creditOnWebsite) return null;
	let line: string;
	let sortKey: string;
	switch (answers.creditForm) {
		case 'name':
		case 'name-and-nation': {
			line = printedName(answers);
			sortKey = answers.creditName?.trim() ? line : answers.familyName || line;
			const shown = answers.nations.filter((nation) => nation.showInCredit).map((nation) => nation.nationName);
			if (answers.creditForm === 'name-and-nation' && shown.length > 0) line += ` (${shown.join('; ')})`;
			break;
		}
		case 'role':
			line = answers.creditRole?.trim() ?? '';
			sortKey = line;
			break;
		case 'pseudonym':
			line = answers.creditPseudonym?.trim() ?? '';
			sortKey = line;
			break;
	}
	if (!line) return null;
	// People under 18 have no biography in credits, so nothing beside a chosen name can identify them.
	const namedCredit = answers.creditForm !== 'role' && answers.ageGroup !== '13-to-17';
	return {
		line,
		sortKey: sortKey.toLocaleLowerCase('en-US'),
		// A biography could identify someone credited only by a description.
		biography: namedCredit && answers.biographyInCredits ? answers.biography : null,
		inBook: answers.creditInBook,
		onWebsite: answers.creditOnWebsite
	};
}

/** Fields that must be answered before the person can confirm, with the message to show. */
export function missingAnswers(answers: ProfileAnswers): Record<string, string> {
	const missing: Record<string, string> = {};
	if (!answers.givenName) missing.givenName = 'Give the name you would like us to use.';
	if (!answers.ageGroup) {
		missing.ageGroup =
			'Choose your age. Signing up on the website is for people 13 or older; someone younger can help with a parent or guardian through the request form.';
	}
	if ((answers.preferredContact === 'phone' || answers.preferredContact === 'text-message') && !answers.phone) {
		missing.phone = 'Give a phone number, or choose email as the way to reach you.';
	}
	if (answers.nationAnswer === 'listed' && answers.nations.length === 0) {
		missing.nations = 'Name at least one nation, or choose another answer.';
	}
	if (answers.interests.length === 0) missing.interests = 'Choose at least one way you would like to help.';
	if (!answers.creditForm) missing.creditForm = 'Choose how you would like to be credited.';
	if (answers.ageGroup === '13-to-17' && answers.creditForm && !minorCreditForms.includes(answers.creditForm)) {
		missing.creditForm = 'People under 18 are credited by a description or a name they choose, not their own name.';
	}
	if (answers.creditForm === 'role' && !answers.creditRole) {
		missing.creditRole = 'Write the description to print, or choose another kind of credit.';
	}
	if (answers.creditForm === 'pseudonym' && !answers.creditPseudonym) {
		missing.creditPseudonym = 'Write the name to print, or choose another kind of credit.';
	}
	if (answers.creditForm === 'name-and-nation' && !answers.nations.some((nation) => nation.showInCredit)) {
		missing.creditForm = 'Tick a nation to show with your name, or choose “My name”.';
	}
	if (answers.interests.includes('write') && !answers.biography) {
		missing.biography = 'Writers are asked for a short biography for the list of contributors.';
	}
	return missing;
}

/**
 * The name a person's public page goes by, or null for no page: only for a
 * credit shown on the website by name or by a chosen name. A description is
 * not a name, so it gets no page.
 */
export function pageNameOf(answers: ProfileAnswers): string | null {
	const credit = creditOf(answers);
	if (!credit || !credit.onWebsite) return null;
	if (answers.creditForm === 'pseudonym') return answers.creditPseudonym?.trim() || null;
	if (answers.creditForm === 'name' || answers.creditForm === 'name-and-nation') return printedName(answers) || null;
	return null;
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
