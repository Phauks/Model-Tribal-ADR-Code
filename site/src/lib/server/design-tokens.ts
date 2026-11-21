import tokens from '../../../design-tokens.json';
import { themeColors, type ThemeName, type TokenGroup } from '../design-tokens.ts';

/**
 * Colors of one theme from site/design-tokens.json. The file is bundled at
 * build time, so this also works in pages the Worker renders on request.
 */
export function colorsOf(theme: ThemeName): Record<string, string> {
	return themeColors(tokens as unknown as TokenGroup, theme);
}
