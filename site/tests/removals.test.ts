import { describe, expect, it } from 'vitest';
import { journeyBounds, journeyFeatures, journeyYears, namesInWords } from '#lib/removal-journeys.ts';
import { evidenceDate, quotationText, removalJourneyPage, removalJourneys, shownCitation } from '#lib/server/removals.ts';

describe('the removals', () => {
	it('reads every journey with its kind of move and arrows', () => {
		const journeys = removalJourneys();
		expect(journeys.length).toBe(55);
		expect(journeys.filter((journey) => journey.move === 'not carried out').map((journey) => journey.id).sort()).toEqual(['menominee-attempted-removal', 'stockbridge-1848-attempt']);
		for (const journey of journeys) if (journey.arrow !== 'not carried out') expect(journey.arrows.length > 0 || journey.origin !== undefined).toBe(true);
	});

	it('gives every journey page a dated, cited record', () => {
		for (const journey of removalJourneys()) {
			const page = removalJourneyPage(journey.id);
			expect(page).toBeDefined();
			for (const item of [...page!.order, ...page!.move, ...page!.force]) {
				expect(item.date).not.toBe('');
				expect(item.marks.length).toBeGreaterThan(0);
				expect(item.citation).not.toMatch(/OCR|\bscan\b|unconfirmed|approx/i);
			}
		}
	});

	it('writes dates, years and lists as the pages say them', () => {
		expect(evidenceDate('1835-12-29')).toBe('Dec. 29, 1835');
		expect(evidenceDate('1838-05')).toBe('May 1838');
		expect(evidenceDate('1838')).toBe('1838');
		expect(journeyYears([1838, 1839])).toBe('1838 to 1839');
		expect(journeyYears([1838, 1838])).toBe('1838');
		expect(namesInWords(['Georgia', 'Tennessee', 'Alabama'])).toBe('Georgia, Tennessee and Alabama');
		expect(quotationText('and remove there,')).toBe('and remove there . . . .');
	});

	it('leaves the research notes out of a citation', () => {
		expect(shownCitation('H.R. Doc. No. 453, 25th Cong., 2d Sess., at 16-18 (1838) (Removal of the Cherokees; letter from the Secretary of War); pin page approximate; scan header OCR also reads "458"')).toBe('H.R. Doc. No. 453, 25th Cong., 2d Sess., at 16-18 (1838) (Removal of the Cherokees; letter from the Secretary of War)');
		expect(shownCitation('Annual Report for the Year 1866, at 32 (approx.; OCR header for p. 32 missing, between headers 31 and 33) (Gov\'t Printing Off. 1867)')).toBe('Annual Report for the Year 1866, at 32 (Gov\'t Printing Off. 1867)');
		expect(shownCitation('Treaty with the Cherokee, Dec. 29, 1835, art. 8, 7 Stat. 478, 482')).toBe('Treaty with the Cherokee, Dec. 29, 1835, art. 8, 7 Stat. 478, 482');
	});

	it('draws each stage as a curved arrow, and hides those not yet begun', () => {
		const line = { id: 'test', people: 'Test', arrow: 'solid' as const, arrows: [{ from: [-84, 34] as [number, number], to: [-95, 36] as [number, number], years: [1838, 1839] as [number, number] }] };
		const all = journeyFeatures({ lines: [line] });
		expect(all.lines.features).toHaveLength(1);
		expect(all.heads.features[0].properties?.state).toBe('shown');
		expect(journeyFeatures({ lines: [line], year: 1830 }).lines.features).toHaveLength(0);
		expect(journeyFeatures({ lines: [line], year: 1850 }).lines.features[0].properties?.state).toBe('past');
		expect(journeyBounds(line.arrows)[0]).toBeLessThan(-95);
	});
});
