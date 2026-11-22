import { describe, expect, it } from 'vitest';
import { lineChanges } from '#lib/essays/merge.ts';
import { renderEssay, type EssayLibrary } from '#lib/essays/render.ts';

const library: EssayLibrary = { citation: () => undefined, term: () => undefined, facts: () => [] };

describe('lineChanges', () => {
	it('marks unchanged, changed and new lines', () => {
		const before = 'One.\n\nTwo.\n\nThree.\n';
		const after = 'One.\n\nTwo, edited.\n\nThree.\n\nFour.\n';
		expect(lineChanges(before, after)).toEqual(['same', 'same', 'changed', 'same', 'same', 'added', 'added', 'same']);
	});

	it('calls every line new when nothing was published (blank lines match)', () => {
		expect(lineChanges('', 'One.\n\nTwo.')).toEqual(['added', 'same', 'added']);
	});
});

describe('renderEssay with marks', () => {
	const before = '# Title\n\n## Part\n\nOne.\n\nTwo.\n';
	const after = '# Title\n\n## Part\n\nOne, edited.\n\nTwo.\n\nThree.\n';

	it('wraps changed and new blocks, and only those', () => {
		const { html } = renderEssay(after, library, { lines: lineChanges(before, after) });
		expect(html).toContain('<div class="essay-draft-mark essay-draft-changed" data-draft="Draft">\n<p>One, edited.</p>');
		expect(html).toContain('<div class="essay-draft-mark essay-draft-added" data-draft="New">\n<p>Three.</p>');
		expect(html).toMatch(/<\/div>\n<p>Two\.<\/p>/);
		expect(html.match(/essay-draft-mark/g)).toHaveLength(2);
	});

	it('renders the same as before without marks', () => {
		expect(renderEssay(after, library).html).not.toContain('essay-draft-mark');
	});
});
