/**
 * Words the story pages use for the values in story records
 * (schemas/story.schema.json). A value with no label here is shown with its
 * hyphens turned into spaces, so a new kind or topic in a record still reads
 * sensibly before a label is added.
 */

export const storyKindLabels: Record<string, string> = {
	'traditional-story': 'Traditional story',
	'historical-account': 'Historical account',
	teaching: 'Teaching',
	'court-opinion': 'Court opinion',
	'oral-history': 'Oral history',
	essay: 'Essay',
	'program-story': 'A program’s own story',
	other: 'Other'
};

/** Whose voice a telling is, nearest to the nation first (decision record 0019). */
export const authorityLabels: Record<string, string> = {
	'nation-government': 'The nation’s government',
	'nation-court': 'The nation’s court',
	'nation-cultural-office': 'The nation’s cultural office',
	'nation-press': 'The nation’s press',
	'nation-newspaper': 'The nation’s newspaper',
	'native-organization': 'A Native organization',
	'co-published-with-nation': 'Published with the nation',
	'member-author': 'A citizen of the nation, writing in their own name',
	contributor: 'A person who shared it with the project',
	'outside-recorder': 'An outside writer or recorder'
};

export const lengthLabels: Record<string, string> = {
	paragraph: 'A paragraph',
	short: 'Short (under about 1,500 words)',
	long: 'Long',
	book: 'Book length',
	'audio-video': 'Audio or video'
};

export const protocolKindLabels: Record<string, string> = {
	seasonal: 'Told in a season',
	setting: 'Told in a place or setting',
	teller: 'Only certain people tell it',
	'clan-owned': 'Belongs to a clan',
	'family-owned': 'Belongs to a family',
	ceremonial: 'Ceremonial',
	sacred: 'Sacred',
	'name-avoidance': 'A name is not spoken',
	'permission-required': 'Ask first',
	other: 'Other'
};

/** A value from an open list, as words: its label, or the value with hyphens turned into spaces. */
export function labelFor(labels: Record<string, string>, value: string): string {
	return labels[value] ?? spaced(value);
}

/** "peace-between-nations" as "peace between nations". */
export function spaced(value: string): string {
	return value.replaceAll('-', ' ');
}
