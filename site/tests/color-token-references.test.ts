// Every color the site's code asks for must be one design-tokens.json defines, in both themes. A missing one is blank in the browser: in CSS the rule quietly drops, and on the tile map MapLibre rejects the whole style, so the map never starts (Nov. 27, 2026, when the focus fill was retired but the map still read it).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const tokens = JSON.parse(readFileSync(new URL('../design-tokens.json', import.meta.url), 'utf8')) as { color: { light: Record<string, unknown>; dark: Record<string, unknown> } };
const defined = (name: string) => name in tokens.color.light && name in tokens.color.dark;

function filesUnder(directory: string): string[] {
	return readdirSync(directory).flatMap((name) => {
		const path = join(directory, name);
		return statSync(path).isDirectory() ? filesUnder(path) : /\.(svelte|css|ts)$/.test(name) ? [path] : [];
	});
}

const source = new URL('../src/', import.meta.url).pathname;

describe('color token references', () => {
	it('reads only defined colors on the tile map', () => {
		const text = readFileSync(join(source, 'lib/components/TileMap.svelte'), 'utf8');
		const asked = [...text.matchAll(/\btoken\('([a-z0-9-]+)'\)/g)].map((match) => match[1]);
		expect(asked.length).toBeGreaterThan(0);
		expect([...new Set(asked)].filter((name) => !defined(name))).toEqual([]);
	});

	it('uses only defined colors in the site styles', () => {
		const missing = new Set<string>();
		for (const path of filesUnder(source)) {
			const text = readFileSync(path, 'utf8');
			// A component may set its own --color-… property; those count as defined in that file.
			const local = new Set([...text.matchAll(/(--color-[a-z0-9-]+)\s*:/g)].map((match) => match[1]));
			for (const match of text.matchAll(/var\((--color-[a-z0-9-]+)\s*\)/g)) {
				const name = match[1];
				if (!local.has(name) && !defined(name.slice('--color-'.length))) missing.add(`${path.slice(source.length)}: ${name}`);
			}
		}
		expect([...missing]).toEqual([]);
	});
});
