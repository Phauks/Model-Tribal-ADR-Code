// How colors look to readers with a color vision deficiency, and how far
// apart two colors look, for tools/check-color-vision.mjs and its tests.
//
// The models are the peer-reviewed ones, ported from DaltonLens-Python 0.1.5
// (MIT License, Copyright (c) 2021 DaltonLens; https://github.com/DaltonLens/DaltonLens-Python),
// with its constants copied at full precision:
//
// - Protanopia and deuteranopia: Viénot, Brettel & Mollon (1999), "Digital
//   video colourmaps for checking the legibility of displays by dichromats",
//   recommended by DaltonLens for these two types.
// - Tritanopia: Brettel, Viénot & Mollon (1997), "Computerized simulation of
//   color appearance for dichromats", which Viénot 1999 does not cover.
// - Protanomaly and deuteranomaly, the milder and more common forms:
//   Machado, Oliveira & Fernandes (2009), "A physiologically-based model for
//   simulation of color vision deficiency", at severity 0.6.
// - No color vision (achromatopsia): luminance only.
//
// Colors are converted from sRGB to linear RGB before the model and back
// after it, as the models require, and rounded to 8 bits as a screen would
// show them. The color difference is CIEDE2000 (Sharma, Wu & Dalal, 2005).
// The research behind this is in the project's color vision write-up.

/** @typedef {[number, number, number]} Triple */

const vienotProtanopia = [
	[0.10888931102535536, 0.8911106889746446, 3.09351935705475e-17],
	[0.10888931102535536, 0.8911106889746446, 3.790880234822294e-18],
	[0.004471314172181988, -0.004471314172181949, 1.0]
];
const vienotDeuteranopia = [
	[0.290305321265553, 0.7096946787344472, 6.912413159925759e-17],
	[0.29030532126555286, 0.7096946787344469, -5.981176783914497e-18],
	[-0.02197353944733135, 0.021973539447331363, 0.9999999999999999]
];
const machadoProtanomaly = [
	[0.38545, 0.769005, -0.154455],
	[0.100526, 0.829802, 0.069673],
	[-0.007442, -0.02219, 1.029632]
];
const machadoDeuteranomaly = [
	[0.498864, 0.674741, -0.173604],
	[0.205199, 0.754872, 0.039929],
	[-0.011131, 0.030969, 0.980162]
];
const lmsFromLinearRgb = [
	[0.1788595581, 0.43997116989800006, 0.03596576702400001],
	[0.03380393502, 0.27515242401400003, 0.036206345976000004],
	[0.00031087464, 0.0019166073600000002, 0.015280889928]
];
const linearRgbFromLms = [
	[8.005328596048955, -12.881954499175828, 11.680649428743669],
	[-0.9782114906043382, 5.269449034168102, -10.183004327358567],
	[-0.040168230105817854, -0.3988505815643625, 66.48078797381677]
];
const brettelTritan = {
	plane1: [
		[1, 0, 0],
		[0, 1, 0],
		[-0.0021311449439688967, 0.0547679047976722, 0]
	],
	plane2: [
		[1, 0, 0],
		[0, 1, 0],
		[-0.061954832542766014, 0.16825739943426266, 0]
	],
	separation: [0.34516270501, -0.6547964950220001, 0]
};

/** @param {number[][]} matrix @param {Triple} vector @returns {Triple} */
function times(matrix, vector) {
	return /** @type {Triple} */ (matrix.map((row) => row[0] * vector[0] + row[1] * vector[1] + row[2] * vector[2]));
}

/** @param {number} channel 0 to 1 */
const linear = (channel) => (channel < 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
/** @param {number} channel linear, clipped to 0 to 1 first */
function encoded(channel) {
	const clipped = Math.min(1, Math.max(0, channel));
	return clipped < 0.0031308 ? clipped * 12.92 : 1.055 * clipped ** (1 / 2.4) - 0.055;
}

/** @param {string} hex such as "#1A6D76" @returns {Triple} 0 to 255 */
export function rgbOf(hex) {
	const digits = hex.replace('#', '');
	return /** @type {Triple} */ ([0, 2, 4].map((at) => Number.parseInt(digits.slice(at, at + 2), 16)));
}

/** @param {Triple} rgb 0 to 255 */
export function hexOf(rgb) {
	return `#${rgb.map((channel) => channel.toString(16).padStart(2, '0').toUpperCase()).join('')}`;
}

/** @type {Record<Vision, (linearRgb: Triple) => Triple>} */
const models = {
	typical: (rgb) => rgb,
	protanopia: (rgb) => times(vienotProtanopia, rgb),
	deuteranopia: (rgb) => times(vienotDeuteranopia, rgb),
	tritanopia: (rgb) => {
		const lms = times(lmsFromLinearRgb, rgb);
		const side = lms[0] * brettelTritan.separation[0] + lms[1] * brettelTritan.separation[1] + lms[2] * brettelTritan.separation[2];
		return times(linearRgbFromLms, times(side < 0 ? brettelTritan.plane2 : brettelTritan.plane1, lms));
	},
	protanomaly: (rgb) => times(machadoProtanomaly, rgb),
	deuteranomaly: (rgb) => times(machadoDeuteranomaly, rgb),
	achromatopsia: (rgb) => {
		const luminance = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
		return [luminance, luminance, luminance];
	}
};

/** @typedef {'typical' | 'protanopia' | 'deuteranopia' | 'protanomaly' | 'deuteranomaly' | 'tritanopia' | 'achromatopsia'} Vision */

/** The kinds of vision the check simulates, in the order it reports them. @type {Vision[]} */
export const visions = ['typical', 'protanopia', 'deuteranopia', 'protanomaly', 'deuteranomaly', 'tritanopia', 'achromatopsia'];

/**
 * A color as a reader with the given kind of vision sees it, rounded to 8 bits as DaltonLens does.
 * @param {string} hex
 * @param {Vision} vision
 * @returns {Triple} 0 to 255
 */
export function seenAs(hex, vision) {
	const linearRgb = /** @type {Triple} */ (rgbOf(hex).map((channel) => linear(channel / 255)));
	return /** @type {Triple} */ (models[vision](linearRgb).map((channel) => Math.floor(encoded(channel) * 255)));
}

/** CIE L*a*b* under D65, from 8-bit sRGB. @param {Triple} rgb @returns {Triple} */
export function labOf(rgb) {
	const [red, green, blue] = rgb.map((channel) => linear(channel / 255));
	const x = 0.4124 * red + 0.3576 * green + 0.1805 * blue;
	const y = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
	const z = 0.0193 * red + 0.1192 * green + 0.9505 * blue;
	const white = [0.95047, 1, 1.08883];
	const bend = (/** @type {number} */ value) => (value > 216 / 24389 ? Math.cbrt(value) : ((24389 / 27) * value + 16) / 116);
	const [fx, fy, fz] = [x / white[0], y / white[1], z / white[2]].map(bend);
	return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/**
 * CIEDE2000 color difference (Sharma, Wu & Dalal, "The CIEDE2000
 * Color-Difference Formula", Color Research & Application 30(1), 2005).
 * @param {Triple} first L*a*b*
 * @param {Triple} second L*a*b*
 */
export function colorDifference(first, second) {
	const [l1, a1, b1] = first;
	const [l2, a2, b2] = second;
	const degrees = 180 / Math.PI;
	const c1 = Math.hypot(a1, b1);
	const c2 = Math.hypot(a2, b2);
	const meanC = (c1 + c2) / 2;
	const g = 0.5 * (1 - Math.sqrt(meanC ** 7 / (meanC ** 7 + 25 ** 7)));
	const a1p = (1 + g) * a1;
	const a2p = (1 + g) * a2;
	const c1p = Math.hypot(a1p, b1);
	const c2p = Math.hypot(a2p, b2);
	const hueOf = (/** @type {number} */ a, /** @type {number} */ b) => (a === 0 && b === 0 ? 0 : (Math.atan2(b, a) * degrees + 360) % 360);
	const h1p = hueOf(a1p, b1);
	const h2p = hueOf(a2p, b2);
	const deltaL = l2 - l1;
	const deltaC = c2p - c1p;
	let deltah = 0;
	if (c1p * c2p !== 0) {
		deltah = h2p - h1p;
		if (deltah > 180) deltah -= 360;
		else if (deltah < -180) deltah += 360;
	}
	const deltaH = 2 * Math.sqrt(c1p * c2p) * Math.sin(deltah / 2 / degrees);
	const meanL = (l1 + l2) / 2;
	const meanCp = (c1p + c2p) / 2;
	let meanH = h1p + h2p;
	if (c1p * c2p !== 0) {
		if (Math.abs(h1p - h2p) <= 180) meanH = (h1p + h2p) / 2;
		else meanH = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;
	}
	const t =
		1 -
		0.17 * Math.cos((meanH - 30) / degrees) +
		0.24 * Math.cos((2 * meanH) / degrees) +
		0.32 * Math.cos((3 * meanH + 6) / degrees) -
		0.2 * Math.cos((4 * meanH - 63) / degrees);
	const deltaTheta = 30 * Math.exp(-(((meanH - 275) / 25) ** 2));
	const rc = 2 * Math.sqrt(meanCp ** 7 / (meanCp ** 7 + 25 ** 7));
	const sl = 1 + (0.015 * (meanL - 50) ** 2) / Math.sqrt(20 + (meanL - 50) ** 2);
	const sc = 1 + 0.045 * meanCp;
	const sh = 1 + 0.015 * meanCp * t;
	const rt = -Math.sin((2 * deltaTheta) / degrees) * rc;
	return Math.sqrt((deltaL / sl) ** 2 + (deltaC / sc) ** 2 + (deltaH / sh) ** 2 + rt * (deltaC / sc) * (deltaH / sh));
}

/**
 * The smallest difference between any two of the colors, as seen with the given vision, and the pair that has it.
 * @param {Record<string, string>} colors name to hex
 * @param {Vision} vision
 */
export function closestPair(colors, vision) {
	/** @type {[string, Triple][]} */
	const entries = Object.entries(colors).map(([name, hex]) => [name, labOf(seenAs(hex, vision))]);
	let closest = { difference: Infinity, first: '', second: '' };
	for (let one = 0; one < entries.length; one++) {
		for (let other = one + 1; other < entries.length; other++) {
			const difference = colorDifference(entries[one][1], entries[other][1]);
			if (difference < closest.difference) closest = { difference, first: entries[one][0], second: entries[other][0] };
		}
	}
	return closest;
}
