// The color vision check (tools/check-color-vision.mjs) is only as good as its
// models, so these tests hold the port to its source. The expected values were
// computed with DaltonLens-Python 0.1.5 (Simulator_Vienot1999 for protanopia
// and deuteranopia, Simulator_Brettel1997 for tritanopia, Simulator_Machado2009
// at severity 0.6) and colour-science 0.4.7 (delta_E, method "CIE 2000").
import { describe, expect, it } from 'vitest';
import { colorDifference, labOf, rgbOf, seenAs } from '../tools/color-vision.mjs';

const simulated = [
	{
		color: '#A54DCA',
		protanopia: [92, 92, 202],
		deuteranopia: [111, 111, 200],
		tritanopia: [148, 104, 109],
		protanomaly: [93, 104, 203],
		deuteranomaly: [102, 110, 199]
	},
	{ color: '#182530', protanopia: [35, 35, 47], deuteranopia: [33, 33, 48], tritanopia: [22, 37, 43], protanomaly: [30, 36, 48], deuteranomaly: [28, 35, 47] },
	{
		color: '#BB1D6D',
		protanopia: [72, 72, 109],
		deuteranopia: [109, 109, 105],
		tritanopia: [184, 44, 72],
		protanomaly: [116, 75, 109],
		deuteranomaly: [131, 96, 106]
	},
	{
		color: '#132CDE',
		protanopia: [42, 42, 221],
		deuteranopia: [38, 38, 222],
		tritanopia: [0, 91, 124],
		protanomaly: [0, 76, 224],
		deuteranomaly: [0, 62, 220]
	},
	{
		color: '#0072B2',
		protanopia: [107, 107, 177],
		deuteranopia: [96, 96, 178],
		tritanopia: [0, 120, 148],
		protanomaly: [69, 114, 179],
		deuteranomaly: [53, 106, 177]
	},
	{
		color: '#E69F00',
		protanopia: [168, 168, 6],
		deuteranopia: [183, 183, 0],
		tritanopia: [237, 147, 158],
		protanomaly: [199, 163, 0],
		deuteranomaly: [207, 174, 6]
	},
	{
		color: '#F0E442',
		protanopia: [229, 229, 66],
		deuteranopia: [231, 231, 64],
		tritanopia: [253, 214, 218],
		protanomaly: [246, 222, 50],
		deuteranomaly: [249, 226, 73]
	},
	{ color: '#FF0000', protanopia: [92, 92, 14], deuteranopia: [146, 146, 0], tritanopia: [254, 0, 78], protanomaly: [166, 89, 0], deuteranomaly: [187, 125, 0] }
] as const;

describe('seenAs', () => {
	for (const row of simulated) {
		for (const vision of ['protanopia', 'deuteranopia', 'tritanopia', 'protanomaly', 'deuteranomaly'] as const) {
			it(`matches DaltonLens for ${row.color}, ${vision}`, () => {
				expect(seenAs(row.color, vision)).toEqual(row[vision]);
			});
		}
	}

	it('leaves typical vision alone', () => {
		expect(seenAs('#1A6D76', 'typical')).toEqual(rgbOf('#1A6D76'));
	});
});

describe('colorDifference', () => {
	// Pairs from Sharma, Wu & Dalal (2005), Table 1, with their published differences.
	const sharma: [[number, number, number], [number, number, number], number][] = [
		[[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
		[[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
		[[50, 0, 0], [50, -1, 2], 2.3669],
		[[50, 2.5, 0], [73, 25, -18], 27.1492],
		[[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
		[[22.7233, 20.0904, -46.694], [23.0331, 14.973, -42.5619], 2.0373]
	];
	for (const [first, second, expected] of sharma) {
		it(`gives ${expected} for Sharma's pair ${first.join(', ')}`, () => {
			expect(colorDifference(first, second)).toBeCloseTo(expected, 3);
		});
	}

	// sRGB colors, through L*a*b*: within 0.02 of colour-science, whose sRGB matrix carries more digits.
	const pairs: [string, string, number][] = [
		['#A54DCA', '#182530', 32.381],
		['#BB1D6D', '#132CDE', 30.7173],
		['#D6237B', '#2ED91E', 93.0022],
		['#3F721F', '#CB1971', 70.4657],
		['#174494', '#D6493C', 45.1982],
		['#9D5C34', '#60BE31', 49.8842]
	];
	for (const [first, second, expected] of pairs) {
		it(`gives about ${expected} for ${first} and ${second}`, () => {
			expect(Math.abs(colorDifference(labOf(rgbOf(first)), labOf(rgbOf(second))) - expected)).toBeLessThan(0.02);
		});
	}
});
