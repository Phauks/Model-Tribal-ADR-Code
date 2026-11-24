/**
 * How a person looks in the editor: their initials, and a color that comes
 * from their name, so the same person keeps the same color on their avatar,
 * their cursor and their place in the text (PersonAvatar.svelte; presence in
 * EssayEditor.svelte).
 */

export const personTones = ['document', 'treaty', 'case', 'opinion', 'federal'] as const;
export type PersonTone = (typeof personTones)[number];

/** Up to two initials: "Trevor Goldsmith" is "TG". */
export function personInitials(name: string): string {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? '')
		.join('');
}

/** The person's tone, from their name. */
export function personTone(name: string): PersonTone {
	return personTones[[...name].reduce((sum, character) => sum + character.charCodeAt(0), 0) % personTones.length];
}

/** The person's color as a CSS value, for places that take a color rather than a class. */
export function personColor(name: string): string {
	return `var(--color-timeline-${personTone(name)})`;
}
