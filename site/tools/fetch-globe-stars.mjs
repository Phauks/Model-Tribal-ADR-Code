// Downloads the Hipparcos Catalogue and writes the stars drawn behind the
// map's globe at static/map-sky/stars.json: each star brighter than
// magnitude 6.2 (about what an eye sees under a dark sky), as its right
// ascension and declination in degrees, its V magnitude and its B-V color.
//
// Source: European Space Agency, The Hipparcos and Tycho Catalogues (ESA
// SP-1200, 1997), from NASA HEASARC's copy of the Hipparcos Main Catalog
// (source record content/sources/e/esa-hipparcos-catalogue.yaml). ESA
// distributes the catalogues under CC BY-NC 3.0 IGO and asks for the credit
// "ESA", which the map shows while the globe is on. Run again to refresh the
// copy; the website reads only the file this writes.
//
// Run from site/:  node tools/fetch-globe-stars.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const fileUrl = 'https://heasarc.gsfc.nasa.gov/FTP/heasarc/dbase/tdat_files/heasarc_hipparcos.tdat.gz';
const faintest = 6.2;
// Stars with no measured color are drawn white, about the color of a B-V of 0.6 (project choice).
const unknownColor = 0.6;

const response = await fetch(fileUrl);
if (!response.ok) throw new Error(`HEASARC answered ${response.status} for ${fileUrl}`);
const text = gunzipSync(Buffer.from(await response.arrayBuffer())).toString('latin1');

// The file is a header naming the fields in order ("line[1] = ..."), then one star per line between <DATA> and <END>, with fields split by "|".
const fields = /^line\[1\] = (.+)$/m.exec(text)?.[1].trim().split(/\s+/);
if (!fields) throw new Error('The file has no field list');
const column = (name) => {
	const index = fields.indexOf(name);
	if (index === -1) throw new Error(`The file has no ${name} field`);
	return index;
};
const [ra, dec, vmag, color] = ['ra', 'dec', 'vmag', 'bv_color'].map(column);

const data = text.slice(text.indexOf('<DATA>') + '<DATA>'.length, text.indexOf('<END>'));
const round = (value) => Math.round(value * 100) / 100;
const stars = [];
for (const line of data.split('\n')) {
	const parts = line.split('|');
	if (parts.length < fields.length || parts[vmag] === '') continue;
	const magnitude = Number(parts[vmag]);
	if (!(magnitude < faintest)) continue;
	stars.push([round(Number(parts[ra])), round(Number(parts[dec])), round(magnitude), round(parts[color] === '' ? unknownColor : Number(parts[color]))]);
}
// Faintest first, so a bright star is drawn over any faint neighbor.
stars.sort((a, b) => b[2] - a[2]);

const file = {
	source: 'ESA, The Hipparcos and Tycho Catalogues, ESA SP-1200 (1997), Hipparcos Main Catalog via NASA HEASARC',
	license: 'CC BY-NC 3.0 IGO; credit: ESA',
	retrieved: new Date().toISOString().slice(0, 10),
	fields: ['right ascension (degrees, ICRS)', 'declination (degrees, ICRS)', 'V magnitude', 'B-V color'],
	stars
};
mkdirSync('static/map-sky', { recursive: true });
writeFileSync('static/map-sky/stars.json', JSON.stringify(file));
console.log(`Wrote ${stars.length} stars brighter than magnitude ${faintest} to static/map-sky/stars.json.`);
