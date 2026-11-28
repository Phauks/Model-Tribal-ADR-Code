/**
 * The 2.5 GHz licenses the FCC granted a nation over its rural tribal lands,
 * for Key facts (Trevor, Nov. 27, 2026: spike 4 of
 * research/analyses/2026-11-27-appeals-audio-land-spectrum-films.md).
 *
 * research/fcc-tribal-spectrum/licenses.csv (scripts/tribes/fcc_tribal_spectrum.py)
 * has every license in the FCC's 2.5 GHz file whose market is a tribal land
 * area: the Rural Tribal Priority Window the FCC opened in 2019 (Transforming
 * the 2.5 GHz Band, Report and Order, 34 FCC Rcd 5446 (2019)). Only active
 * licenses held by the nation or by its own company or utility are shown.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseCsv } from '../csv.ts';
import { repositoryRoot } from './content.ts';

export const licensesFile = 'research/fcc-tribal-spectrum/licenses.csv';
export const licenseFileSource = 'fcc-uls-2-5-ghz-license-file-2026-11-22';
/** The legal basis: the FCC's 2019 order that opened the Rural Tribal Priority Window. */
export const orderSource = 'fcc-19-62-transforming-the-2-5-ghz-band';

export type LicenseRow = Record<string, string>;

let cache: Map<string, LicenseRow[]> | undefined;

/** Each nation's active licenses, oldest grant first, by nation id. */
export function licensesByNation(): Map<string, LicenseRow[]> {
	if (!cache) {
		cache = new Map();
		const rows = parseCsv(readFileSync(path.join(repositoryRoot, licensesFile), 'utf8').normalize('NFC'));
		for (const row of rows) {
			if (row.status !== 'active' || !row.nation) continue;
			cache.set(row.nation, [...(cache.get(row.nation) ?? []), row]);
		}
		for (const list of cache.values()) list.sort((first, second) => first.granted.localeCompare(second.granted) || first.call_sign.localeCompare(second.call_sign));
	}
	return cache;
}

/** The license's own page in the FCC's Universal Licensing System. */
export function licensePage(row: LicenseRow): string {
	return `https://wireless2.fcc.gov/UlsApp/UlsSearch/license.jsp?licKey=${row.unique_system_identifier}`;
}

const months = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];

/** "May 24, 2021" from "2021-05-24", in the site's short month style. */
export function longDate(iso: string): string {
	const [year, month, day] = iso.split('-').map(Number);
	return `${months[month - 1]} ${day}, ${year}`;
}

/** The line under a call sign: when it was granted and runs to, and who holds it when that is the nation's company. */
export function licenseNote(row: LicenseRow): string {
	const dates = `Granted ${longDate(row.granted)}; runs to ${longDate(row.expires)}.`;
	return row.held_by_nation_body === 'yes' ? `${dates} Held by ${row.licensee.replace(/\.$/, '')}.` : dates;
}
