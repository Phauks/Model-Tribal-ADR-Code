import { describe, expect, it } from 'vitest';
import { documentYear, onRequestBytes, parts, shortName } from '../tools/write-offline-catalog.mjs';

/** The group of a part a page falls into, as the catalog sorts it: the first whose test it passes. */
function groupOf(path: string, facts: Record<string, string> = {}): string | undefined {
	const page = { path, label: path, files: [], bytes: 0, facts };
	const part = (parts as { key: string; test: (page: unknown) => boolean; groups?: { key: string; test: (page: unknown) => boolean }[] }[]).find((item) => item.test(page));
	return part?.groups?.find((group) => group.test(page))?.key ?? part?.key;
}

describe('the offline catalog', () => {
	it('names a run by the first words that tell its pages apart', () => {
		expect(shortName('United States v. Kagama')).toBe('United States v. Kagama');
		expect(shortName('Brendale v. Confederated Tribes and Bands of the Yakima Indian Nation')).toBe('Brendale v. Confederated…');
	});

	it('sorts pages drawn on request into their groups', () => {
		expect(groupOf('/laws/federal-register-2025-14189')).toBe('laws-register');
		expect(groupOf('/laws/nigc-bulletin-no-2017-1')).toBe('laws-gaming');
		expect(groupOf('/laws/treaty-with-the-navajo-1868')).toBe('laws-treaties');
		expect(groupOf('/cases/williams-v-lee', { court: 'Warren Court' })).toBe('cases-supreme-court');
		expect(groupOf('/cases/x', { decidedBy: 'Interior Board of Indian Appeals' })).toBe('cases-agencies');
		expect(groupOf('/cases/x', { decidedBy: 'United States Court of Appeals for the Ninth Circuit' })).toBe('cases-federal');
		expect(groupOf('/cases/x', { decidedBy: 'Supreme Court of Montana' })).toBe('cases-state');
		expect(groupOf('/supreme-court/justices/john-marshall')).toBe('supreme-court-justices');
		expect(groupOf('/supreme-court/marshall-court')).toBe('supreme-court-courts');
		expect(groupOf('/biographies/standing-bear')).toBe('biographies');
	});

	it('estimates the space a page drawn on request takes from its page data', () => {
		expect(onRequestBytes(2000)).toBe(95800);
	});

	it('reads the year of a United States document', () => {
		expect(documentYear('/copies/federal-register/2020-21558.pdf', 'Agency Information Collection Activities')).toBe('2020');
		expect(documentYear('/copies/federal-register/E9-17121.pdf', '')).toBe('2009');
		expect(documentYear('/copies/federal-register/99-8851.pdf', 'Acquisition of Title to Land in Trust')).toBe('1999');
		expect(documentYear('/copies/ibia-decisions/39ibia231.pdf', 'Borrego Pass Community School, Inc. v. Director, 39 IBIA 231 (2004)')).toBe('2004');
	});
});
