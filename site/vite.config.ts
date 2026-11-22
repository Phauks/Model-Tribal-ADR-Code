import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';
import { designTokensToCss } from './src/lib/design-tokens.ts';
import { buildMapGeometry } from './src/lib/map-geometry.ts';
import { fullCitations } from './src/lib/server/citations.ts';
import {
	essaysForReview,
	glossary,
	glossaryForReview,
	nationsForReview,
	publicCopies,
	servableImages,
	sources
} from './src/lib/server/content.ts';

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
const landAreasPath = fileURLToPath(new URL('./geography/census-land-areas-2020.json', import.meta.url));
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
			this.addWatchFile(landAreasPath);
			return `export default ${JSON.stringify(await buildMapGeometry(regionsPath, landAreasPath))};`;
		}
	};
}

const reviewSubjectsModule = 'virtual:review-subjects';
const resolvedReviewSubjectsModule = `\0${reviewSubjectsModule}`;

/**
 * Lists the content that co-authors review in the workspace (nation records,
 * glossary terms and essays) as a small module bundled into the Worker, so the
 * workspace, which the Worker renders on request, can show names without
 * reading the content files. Restricted records are left out, as they are
 * everywhere else on the site. Provisions join the list when their records
 * exist. Essays have no public page yet.
 */
function reviewSubjects(): Plugin {
	return {
		name: 'model-tribal-adr-code:review-subjects',
		resolveId(identifier) {
			return identifier === reviewSubjectsModule ? resolvedReviewSubjectsModule : undefined;
		},
		load(identifier) {
			if (identifier !== resolvedReviewSubjectsModule) return undefined;
			const subjects = [
				...nationsForReview().map((record) => ({
					kind: 'nation',
					identifier: record.id,
					title: record.name,
					file: record.file,
					page: record.published ? `/nations/${record.id}` : null
				})),
				...glossaryForReview().map((record) => ({
					kind: 'glossary-term',
					identifier: record.id,
					title: record.term,
					file: record.file,
					page: `/glossary/${record.id}`
				})),
				...essaysForReview().map((record) => ({
					kind: 'essay',
					identifier: record.id,
					title: record.title,
					file: record.file,
					page: null
				}))
			];
			return `export const reviewSubjects = ${JSON.stringify(subjects)};`;
		}
	};
}

const nationImagesModule = 'virtual:nation-images';
const resolvedNationImagesModule = `\0${nationImagesModule}`;

/**
 * Lists the nations' official images the Worker may serve, as a small module
 * bundled into the Worker: only images whose reuse status allows showing them
 * (docs/official-images.md). An image left off this list is never served,
 * whatever the private bucket holds.
 */
function nationImages(): Plugin {
	return {
		name: 'model-tribal-adr-code:nation-images',
		resolveId(identifier) {
			return identifier === nationImagesModule ? resolvedNationImagesModule : undefined;
		},
		load(identifier) {
			if (identifier !== resolvedNationImagesModule) return undefined;
			return `export const nationImages = ${JSON.stringify(servableImages())};`;
		}
	};
}

const publicCopiesModule = 'virtual:public-copies';
const resolvedPublicCopiesModule = `\0${publicCopiesModule}`;

/**
 * Lists the copies of public documents the Worker may serve at /copies/, as a
 * small module bundled into the Worker: only capture index rows marked for
 * redistribution (src/lib/public-copies.ts). A file left off this list is
 * never served, whatever the private bucket holds.
 */
function publicCopiesList(): Plugin {
	return {
		name: 'model-tribal-adr-code:public-copies',
		resolveId(identifier) {
			return identifier === publicCopiesModule ? resolvedPublicCopiesModule : undefined;
		},
		load(identifier) {
			if (identifier !== resolvedPublicCopiesModule) return undefined;
			const copies = publicCopies().map(({ key, mediaType, sha256, bytes, links }) => ({
				key,
				mediaType,
				sha256,
				bytes,
				links
			}));
			return `export const publicCopies = ${JSON.stringify(copies)};`;
		}
	};
}

const sourceCitationsModule = 'virtual:source-citations';
const resolvedSourceCitationsModule = `\0${sourceCitationsModule}`;

/**
 * The full citation, in the project's Indigo Book style, of every source the
 * glossary cites, formatted with citeproc-js while the site is built
 * (src/lib/server/citations.ts). Only the finished text is bundled, never the
 * citation processor.
 */
function sourceCitations(): Plugin {
	return {
		name: 'model-tribal-adr-code:source-citations',
		resolveId(identifier) {
			return identifier === sourceCitationsModule ? resolvedSourceCitationsModule : undefined;
		},
		load(identifier) {
			if (identifier !== resolvedSourceCitationsModule) return undefined;
			const keys = new Set<string>();
			for (const entry of glossary()) {
				for (const key of entry.sources ?? []) keys.add(key);
				const prose = `${entry.definition} ${entry.usage_note ?? ''}`;
				for (const match of prose.matchAll(/@([a-z0-9-]+)/g)) keys.add(match[1]);
			}
			const records = [...keys].flatMap((key) => {
				const record = sources().get(key);
				return record ? [record] : [];
			});
			return `export const sourceCitations = ${JSON.stringify(fullCitations(records))};`;
		}
	};
}

const buildModule = 'virtual:build';
const resolvedBuildModule = `\0${buildModule}`;

/**
 * The commit the site was built from. Workers Builds sets
 * WORKERS_CI_COMMIT_SHA; a build on a computer has none. A review in the
 * workspace records it, so a sign-off names the exact text it approved.
 */
function buildInformation(): Plugin {
	return {
		name: 'model-tribal-adr-code:build',
		resolveId(identifier) {
			return identifier === buildModule ? resolvedBuildModule : undefined;
		},
		load(identifier) {
			if (identifier !== resolvedBuildModule) return undefined;
			const commit = process.env.WORKERS_CI_COMMIT_SHA ?? process.env.GITHUB_SHA ?? '';
			return `export const buildCommit = ${JSON.stringify(commit.slice(0, 40))};`;
		}
	};
}

export default defineConfig({
	plugins: [
		designTokens(),
		mapGeometry(),
		reviewSubjects(),
		nationImages(),
		publicCopiesList(),
		sourceCitations(),
		buildInformation(),
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
