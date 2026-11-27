import { describe, expect, it } from 'vitest';
import { parseSectionChoices } from '../src/lib/sidebar-outline.ts';

describe('the sections the reader opened or shut', () => {
	it('reads what it stores, and the older list of open sections', () => {
		expect(parseSectionChoices('{"/nations":true,"/glossary":false}')).toEqual({ '/nations': true, '/glossary': false });
		expect(parseSectionChoices('["/essays","/nations"]')).toEqual({ '/essays': true, '/nations': true });
	});

	it('ignores anything else', () => {
		expect(parseSectionChoices(null)).toEqual({});
		expect(parseSectionChoices('not json')).toEqual({});
		expect(parseSectionChoices('{"/nations":"yes","/about":true}')).toEqual({ '/about': true });
		expect(parseSectionChoices('[1, "/about"]')).toEqual({ '/about': true });
	});
});
