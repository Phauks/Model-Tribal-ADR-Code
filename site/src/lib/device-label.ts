/**
 * A short, plain name for the browser and system a session started from,
 * such as "Firefox on Windows", for the list of places a person is signed
 * in (Account, Sign-in and security). Only these words are kept with the
 * session; the full browser string is never stored.
 *
 * The order of the checks matters: Edge and Opera also say "Chrome", and
 * Chrome also says "Safari".
 */
const browsers: [RegExp, string][] = [
	[/Edg(e|A|iOS)?\//, 'Edge'],
	[/OPR\/|Opera/, 'Opera'],
	[/SamsungBrowser\//, 'Samsung Internet'],
	[/Firefox\/|FxiOS\//, 'Firefox'],
	[/Chrome\/|CriOS\/|Chromium\//, 'Chrome'],
	[/Safari\//, 'Safari']
];

const systems: [RegExp, string][] = [
	[/iPhone/, 'iPhone'],
	[/iPad/, 'iPad'],
	[/Android/, 'Android'],
	[/Windows/, 'Windows'],
	[/CrOS/, 'ChromeOS'],
	[/Macintosh|Mac OS X/, 'Mac'],
	[/Linux/, 'Linux']
];

export function deviceLabel(userAgent: string | null | undefined): string {
	const text = userAgent ?? '';
	const browser = browsers.find(([pattern]) => pattern.test(text))?.[1];
	const system = systems.find(([pattern]) => pattern.test(text))?.[1];
	if (browser && system) return `${browser} on ${system}`;
	return browser ?? system ?? 'Unknown browser';
}
