import { describe, expect, it } from 'vitest';
import { noneIdentified } from '../src/lib/search-status.ts';

describe('noneIdentified', () => {
	it('says only "None Identified", never how far a search went or that none exists', () => {
		expect(noneIdentified).toEqual({ text: 'None Identified' });
	});
});
