/**
 * The book's Credits page, built from confirmed credits
 * (docs/contributor-profiles.md, "Credits in the book").
 *
 * The output is a front matter page in the same form as
 * content/front-matter/acknowledgments.md, so the print build prints it
 * after the acknowledgments with no other change. Only credits the person
 * chose to have in the book are included.
 */
import type { CreditSection } from './contributors.ts';

export interface BookCredit {
	section: CreditSection;
	line: string;
	sortKey: string;
	biography: string | null;
	inBook: boolean;
}

/** Headings as printed. "Thanks" avoids repeating the Acknowledgments page title. */
export const printedSectionHeadings: Record<CreditSection, string> = {
	contributors: 'Contributors',
	reviewers: 'Reviewers',
	acknowledgments: 'Thanks'
};

/** The order sections print in. */
export const printedSectionOrder: readonly CreditSection[] = ['contributors', 'reviewers', 'acknowledgments'];

/**
 * Text as Markdown that prints exactly as written: Markdown punctuation is
 * escaped, so a name or biography cannot start a heading, a link or a
 * citation, and line breaks become spaces.
 */
export function literalMarkdown(text: string): string {
	return text
		.normalize('NFC')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/[\\`*_{}[\]()<>#+\-.!|@~^:=$&]/g, (character) => `\\${character}`);
}

export function creditsPage(credits: readonly BookCredit[], exportedOn: string): string {
	const lines = ['---', 'id: credits', 'title: Credits', `exported: ${exportedOn}`, 'sources: []', '---', ''];
	for (const section of printedSectionOrder) {
		const entries = credits
			.filter((credit) => credit.section === section && credit.inBook)
			.sort((first, second) => first.sortKey.localeCompare(second.sortKey, 'en-US'));
		if (entries.length === 0) continue;
		lines.push(`## ${printedSectionHeadings[section]}`, '');
		for (const entry of entries) {
			const name = literalMarkdown(entry.line);
			lines.push(entry.biography ? `**${name}.** ${literalMarkdown(entry.biography)}` : name, '');
		}
	}
	return `${lines.join('\n').trimEnd()}\n`;
}
