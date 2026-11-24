import { describe, expect, it } from 'vitest';
import { essaySchema, parseEssay, serializeEssay, writeEssay } from '#lib/essays/document.ts';
import { isRecordBox, shownBoxes } from '#lib/essays/record-box-view.ts';
import { boxMarkdown, type RecordBox } from '#lib/essays/record-boxes.ts';
import { renderEssay, type EssayLibrary } from '#lib/essays/render.ts';

const worcester: RecordBox = {
	question: 'May Georgia apply its criminal laws to a missionary living in the Cherokee Nation under federal license?',
	holding: 'No.',
	quotes: [{ text: 'The Cherokee nation, then, is a distinct community ...', pinpoint: 'p. 561' }]
};
const intercourse: RecordBox = { summary: 'Required federal licenses to trade.' };

const library: EssayLibrary = {
	citation: (key) => ({ 'worcester-v-georgia': '<i>Worcester v. Georgia</i>, 31 U.S. 515 (1832).', 'trade-and-intercourse-act-1790': 'Trade and Intercourse Act, 1 Stat. 137 (1790).' })[key],
	term: () => undefined,
	box: (kind, key) =>
		boxMarkdown(kind, key, kind === 'case' ? { 'worcester-v-georgia': worcester }[key] : { 'trade-and-intercourse-act-1790': intercourse }[key]) || undefined
};

const body = [
	'## Removal',
	'',
	':::: law trade-and-intercourse-act-1790',
	'::::',
	'',
	'Text between the boxes [@worcester-v-georgia, p. 520].',
	'',
	':::: case worcester-v-georgia',
	'::::',
	''
].join('\n');

describe('case and law boxes kept on their records, in the editor', () => {
	it('reads an empty box as a box with nothing inside, and writes it back unchanged', () => {
		const document = parseEssay(body);
		const boxes: string[] = [];
		document.forEach((node) => {
			if (isRecordBox(node)) boxes.push(`${node.type.name} ${node.attrs.source}`);
		});
		expect(boxes).toEqual(['law_block trade-and-intercourse-act-1790', 'case_block worcester-v-georgia']);
		expect(writeEssay(document, body)).toBe(body);
		expect(serializeEssay(document)).toBe(body);
	});

	it('writes a newly placed box with four colons, so its record fills it', () => {
		const document = essaySchema.node('doc', null, [essaySchema.node('case_block', { source: 'worcester-v-georgia' })]);
		expect(serializeEssay(document)).toBe(':::: case worcester-v-georgia\n::::\n');
	});

	it('still treats a box written out in full as editable text', () => {
		const written = ':::: case worcester-v-georgia\n::: holding\nNo.\n:::\n::::\n';
		const box = parseEssay(written).firstChild;
		expect(box?.type.name).toBe('case_block');
		expect(isRecordBox(box)).toBe(false);
	});

	it('finds each box in the page as readers see it, in order, with its kind and key', () => {
		const { html } = renderEssay(body, library);
		const boxes = shownBoxes(html);
		expect(boxes.map(({ kind, key }) => `${kind} ${key}`)).toEqual(['law trade-and-intercourse-act-1790', 'case worcester-v-georgia']);
		expect(boxes[0].html).toContain('Required federal licenses to trade.');
		expect(boxes[1].html).toContain('<p class="essay-block-label">Holding</p>');
		expect(boxes[1].html).toContain('The Cherokee nation, then, is a distinct community');
		expect(boxes[1].html).not.toContain('</section>');
	});
});
