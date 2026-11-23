import { describe, expect, it } from 'vitest';
import { parseEssay } from '#lib/essays/document.ts';
import { characterPosition, components, counts, definitionIssues, joinBlocks, repeatedPhrases, textBlocks, wordPosition } from '#lib/essays/checks.ts';

const body = [
	'## How disputes are settled',
	'',
	'Peacemaking is used by many nations. A [[tribal-court|Tribal court]] may refer a case [@worcester-v-georgia].',
	'',
	'The Customary Dispute Panel meets monthly. The Customary Dispute Panel hears elders. The Customary Dispute Panel decides. The Customary Dispute Panel closes.',
	''
].join('\n');

describe('checks', () => {
	const doc = parseEssay(body);
	const blocks = textBlocks(doc);

	it('maps each character of the text back to its place in the document', () => {
		const joined = joinBlocks(blocks);
		const index = joined.text.indexOf('many');
		const position = joined.position(index);
		expect(doc.textBetween(position, position + 4)).toBe('many');
		const later = joined.text.indexOf('monthly');
		expect(doc.textBetween(joined.position(later), joined.position(later) + 7)).toBe('monthly');
	});

	it('finds a glossary term used but not linked, once', () => {
		const terms: [string, string][] = [
			['peacemaking', 'Peacemaking'],
			['tribal-court', 'Tribal court']
		];
		const issues = definitionIssues(blocks, terms, new Set(['tribal-court']));
		expect(issues).toHaveLength(1);
		expect(issues[0]).toMatchObject({ kind: 'definition', termId: 'peacemaking', problem: 'Peacemaking' });
		expect(doc.textBetween(issues[0].from, issues[0].to)).toBe('Peacemaking');
	});

	it('suggests a definition for a phrase used often, keeping the longest form', () => {
		const issues = repeatedPhrases(blocks, []);
		expect(issues.map((issue) => issue.problem)).toEqual(['Customary Dispute Panel']);
		expect(doc.textBetween(issues[0].from, issues[0].to)).toBe('Customary Dispute Panel');
		expect(repeatedPhrases(blocks, [['customary-dispute-panel', 'Customary Dispute Panel']])).toEqual([]);
	});

	it('lists components and goes to words and characters', () => {
		expect(components(doc).map((component) => component.label)).toEqual([
			'How disputes are settled',
			'Paragraph 1: Peacemaking is used by many nations. A Tribal…',
			'Paragraph 2: The Customary Dispute Panel meets monthly. The Customary…'
		]);
		const position = wordPosition(blocks, 5)!;
		expect(doc.textBetween(position, position + 11)).toBe('Peacemaking');
		expect(counts(blocks).words).toBeGreaterThan(20);
		const character = characterPosition(blocks, 1)!;
		expect(doc.textBetween(character, character + 3)).toBe('How');
	});
});
