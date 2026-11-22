/**
 * Turns site/design-tokens.json (Design Tokens Community Group format) into
 * CSS custom properties, so that every color, size and space on the site
 * comes from that one file (site/DESIGN.md, section 7).
 *
 * Naming: a token at color.light.paper becomes --color-paper; a token at
 * font.size.body becomes --font-size-body. Font sizes are multiplied by
 * --text-scale, which the reader's text size setting changes, so that
 * setting makes text larger without making boxes, spaces or controls larger
 * (site/DESIGN.md, section 6, "Settings"). Light colors apply by default,
 * dark colors apply when the device asks for dark and the reader has not
 * picked light, or when the reader picks dark (site/DESIGN.md, section 8).
 *
 * This module is used by the Vite plugin in vite.config.ts and by the
 * manifest and icon routes. It must not import anything that only works in
 * a browser or only in Node.
 */

type TokenValue = string | number | string[] | { value: number; unit: string };

export interface TokenGroup {
	[name: string]: TokenGroup | TokenValue | undefined;
}

export type ThemeName = 'light' | 'dark';

function isToken(node: unknown): node is { $value: TokenValue } {
	return typeof node === 'object' && node !== null && '$value' in node;
}

function childEntries(group: TokenGroup): [string, TokenGroup][] {
	return Object.entries(group).filter(
		(entry): entry is [string, TokenGroup] =>
			!entry[0].startsWith('$') && typeof entry[1] === 'object' && entry[1] !== null
	);
}

function formatValue(value: TokenValue): string {
	if (Array.isArray(value)) {
		return value
			.map((family) => (/^[a-z-]+$/.test(family) ? family : `"${family}"`))
			.join(', ');
	}
	if (typeof value === 'object') {
		return `${value.value}${value.unit}`;
	}
	return String(value);
}

/** Collects every token under a group as [custom property name, CSS value]. */
function collect(group: TokenGroup, path: string[]): [string, string][] {
	const declarations: [string, string][] = [];
	for (const [name, child] of childEntries(group)) {
		const childPath = [...path, name];
		if (isToken(child)) {
			const value = formatValue(child.$value);
			const isFontSize = childPath[0] === 'font' && childPath[1] === 'size';
			declarations.push([`--${childPath.join('-')}`, isFontSize ? `calc(${value} * var(--text-scale))` : value]);
		} else {
			declarations.push(...collect(child, childPath));
		}
	}
	return declarations;
}

/** The color tokens of one theme, as { name: value }, for example { paper: '#FFFFFF' }. */
export function themeColors(tokens: TokenGroup, theme: ThemeName): Record<string, string> {
	const colorGroup = tokens.color as TokenGroup | undefined;
	const themeGroup = colorGroup?.[theme] as TokenGroup | undefined;
	if (!themeGroup) {
		throw new Error(`design-tokens.json has no color.${theme} group`);
	}
	const colors: Record<string, string> = {};
	for (const [name, child] of childEntries(themeGroup)) {
		if (!isToken(child)) {
			throw new Error(`design-tokens.json: color.${theme}.${name} must be a token with a $value`);
		}
		colors[name] = formatValue(child.$value);
	}
	return colors;
}

/** Checks that both themes define the same color names, so no theme falls back silently. */
function checkThemesMatch(tokens: TokenGroup): void {
	const light = Object.keys(themeColors(tokens, 'light')).sort();
	const dark = Object.keys(themeColors(tokens, 'dark')).sort();
	const missingInDark = light.filter((name) => !dark.includes(name));
	const missingInLight = dark.filter((name) => !light.includes(name));
	if (missingInDark.length > 0 || missingInLight.length > 0) {
		throw new Error(
			'design-tokens.json: the light and dark themes must define the same colors. ' +
				`Missing in dark: ${missingInDark.join(', ') || 'none'}. ` +
				`Missing in light: ${missingInLight.join(', ') || 'none'}.`
		);
	}
}

function block(selector: string, declarations: [string, string][], indent = ''): string {
	const lines = declarations.map(([name, value]) => `${indent}\t${name}: ${value};`);
	return `${indent}${selector} {\n${lines.join('\n')}\n${indent}}`;
}

function colorDeclarations(tokens: TokenGroup, theme: ThemeName): [string, string][] {
	const declarations: [string, string][] = Object.entries(themeColors(tokens, theme)).map(
		([name, value]) => [`--color-${name}`, value]
	);
	declarations.push(['color-scheme', theme]);
	return declarations;
}

/** Builds the style sheet of custom properties for both themes and for print. */
export function designTokensToCss(tokens: TokenGroup): string {
	checkThemesMatch(tokens);

	const otherGroups: [string, string][] = [['--text-scale', '1']];
	for (const [name, group] of childEntries(tokens)) {
		if (name !== 'color') {
			otherGroups.push(...collect(group, [name]));
		}
	}

	const light = colorDeclarations(tokens, 'light');
	const dark = colorDeclarations(tokens, 'dark');

	return [
		'/* Generated from site/design-tokens.json by src/lib/design-tokens.ts. Do not edit. */',
		block(':root', [...otherGroups, ...light]),
		'@media (prefers-color-scheme: dark) {',
		block(':root:not([data-theme="light"])', dark, '\t'),
		'}',
		block(':root[data-theme="dark"]', dark),
		'/* Print always uses the light theme (site/DESIGN.md, section 8). */',
		'@media print {',
		block(':root:is([data-theme], :not([data-theme]))', light, '\t'),
		'}',
		''
	].join('\n');
}
