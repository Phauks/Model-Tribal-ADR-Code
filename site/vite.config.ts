import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';
import { designTokensToCss } from './src/lib/design-tokens.ts';
import { buildMapGeometry } from './src/lib/map-geometry.ts';

const designTokensPath = fileURLToPath(new URL('./design-tokens.json', import.meta.url));
const designTokensModule = 'virtual:design-tokens.css';
const resolvedDesignTokensModule = `\0${designTokensModule}`;

/**
 * Serves site/design-tokens.json as a style sheet of CSS custom properties,
 * imported once in src/routes/+layout.svelte. Editing the tokens file reloads
 * the page in development and changes the built site; nothing else needs to
 * change (site/DESIGN.md, section 7).
 */
function designTokens(): Plugin {
	return {
		name: 'model-tribal-adr-code:design-tokens',
		resolveId(identifier) {
			return identifier === designTokensModule ? resolvedDesignTokensModule : undefined;
		},
		load(identifier) {
			if (identifier !== resolvedDesignTokensModule) return undefined;
			this.addWatchFile(designTokensPath);
			return designTokensToCss(JSON.parse(readFileSync(designTokensPath, 'utf8')));
		}
	};
}

const regionsPath = fileURLToPath(
	new URL('./geography/bureau-of-indian-affairs-regions.json', import.meta.url)
);
const mapGeometryModule = 'virtual:map-geometry';
const resolvedMapGeometryModule = `\0${mapGeometryModule}`;

/**
 * Serves the map's shapes, projected once at build time, as the module
 * "virtual:map-geometry" (src/lib/map-geometry.ts). The browser receives
 * only the finished SVG paths, never a map library (site/DESIGN.md, section 11).
 */
function mapGeometry(): Plugin {
	return {
		name: 'model-tribal-adr-code:map-geometry',
		resolveId(identifier) {
			return identifier === mapGeometryModule ? resolvedMapGeometryModule : undefined;
		},
		async load(identifier) {
			if (identifier !== resolvedMapGeometryModule) return undefined;
			this.addWatchFile(regionsPath);
			return `export default ${JSON.stringify(await buildMapGeometry(regionsPath))};`;
		}
	};
}

export default defineConfig({
	plugins: [
		designTokens(),
		mapGeometry(),
		sveltekit({
			compilerOptions: {
				// Runes mode for the project's own components. Can be removed in Svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			prerender: {
				// Every page is built ahead of time from the files in content/.
				handleHttpError: 'fail',
				handleMissingId: 'fail'
			},
			version: {
				// The service worker names its caches after this, so each build replaces the old copy.
				name: `${readFileSync(new URL('./version.txt', import.meta.url), 'utf8').trim()}+${Date.now()}`
			}
		})
	],
	server: {
		fs: {
			// The site reads the content, schemas and changelogs one folder up.
			allow: ['..']
		}
	}
});
