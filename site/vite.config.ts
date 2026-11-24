import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';
import { designTokensToCss } from './src/lib/design-tokens.ts';
import { buildMapGeometry } from './src/lib/map-geometry.ts';
import { parseGitLog, type Change } from './src/lib/recent-changes.ts';
import { fullCitations } from './src/lib/server/citations.ts';
import { caseNames, essaysInGit, everyBoxFact, everyFullCitation, glossaryTerms, spellingWords } from './src/lib/server/essay-library.ts';
import { caseLinks } from './src/lib/server/case-previews.ts';
import { buildFormCatalog } from './src/lib/server/form-catalog.ts';
import { nationIndexRows } from './src/lib/server/nation-index.ts';
import { followableBuild } from './src/lib/server/followable-build.ts';
import { historyBuild } from './src/lib/server/page-history-build.ts';
import { servablePortraits } from './src/lib/server/supreme-court-people.ts';
import {
	essaysForReview,
	glossary,
	glossaryForReview,
	nations,
	nationsForReview,
	publicCopies,
	servableImages,
	sources,
	storyRecords
} from './src/lib/server/content.ts';
import { isoDate, storyIsShown, storySourceKeys } from './src/lib/story-visibility.ts';
import { directoryNameOf, sourceKindOf } from './src/lib/address-book-sync.ts';

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
const officesPath = fileURLToPath(new URL('./geography/nation-office-points.json', import.meta.url));
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
			this.addWatchFile(officesPath);
			return `export default ${JSON.stringify(await buildMapGeometry(regionsPath, landAreasPath, officesPath))};`;
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

const publicContactsModule = 'virtual:public-contacts';
const resolvedPublicContactsModule = `\0${publicContactsModule}`;

/**
 * Lists the office emails and phones each published nation page shows, with
 * their sources, as a small module bundled into the Worker, so the private
 * address book can compare itself with the pages (src/lib/address-book-sync.ts).
 * Everything listed is already public on the nation pages.
 */
function publicContactsList(): Plugin {
	return {
		name: 'model-tribal-adr-code:public-contacts',
		resolveId(identifier) {
			return identifier === publicContactsModule ? resolvedPublicContactsModule : undefined;
		},
		load(identifier) {
			if (identifier !== resolvedPublicContactsModule) return undefined;
			const records = sources();
			const list = nations()
				.filter((record) => !record.example)
				.map((record) => {
					const sites = (record.contacts ?? [])
						.filter((fact) => fact.kind === 'website' || fact.kind === 'contact-page')
						.map((fact) => String(fact.value));
					return {
						identifier: record.id,
						name: record.names.official,
						contacts: (record.contacts ?? [])
							.filter((fact) => fact.kind === 'email-general' || fact.kind === 'phone')
							.map((fact) => {
								const source = fact.source ? records.get(fact.source) : undefined;
								const sourceLink = source?.original_link ?? source?.citation.URL ?? null;
								const sourceKind = sourceKindOf(fact.source ?? '', sourceLink, sites);
								return {
									method: fact.kind === 'email-general' ? 'email' : 'phone',
									value: String(fact.value),
									source: fact.source ?? '',
									sourceTitle: source?.citation.title ?? fact.source ?? '',
									sourceLink,
									asOf: fact.as_of ? String(fact.as_of).slice(0, 10) : null,
									directoryName: directoryNameOf(sourceKind, fact.locator),
									sourceKind
								};
							})
					};
				});
			return `export const publicNationContacts = ${JSON.stringify(list)};`;
		}
	};
}

const mailNationsModule = 'virtual:mail-nations';
const resolvedMailNationsModule = `\0${mailNationsModule}`;

/**
 * The nations outreach can write to, with the states each is in, so the
 * outreach pages can fill in a nation's name and send in the nation's own
 * time zone (src/lib/server/mail/outreach.ts). Restricted records are left
 * out, as in the review list.
 */
function mailNations(): Plugin {
	return {
		name: 'model-tribal-adr-code:mail-nations',
		resolveId(identifier) {
			return identifier === mailNationsModule ? resolvedMailNationsModule : undefined;
		},
		load(identifier) {
			if (identifier !== resolvedMailNationsModule) return undefined;
			const states = new Map(nations().map((record) => [record.id, [...new Set((record.states ?? []).map((fact) => fact.state))]]));
			const list = nationsForReview().map((record) => ({
				identifier: record.id,
				name: record.name,
				states: states.get(record.id) ?? [],
				page: record.published ? `/nations/${record.id}` : null
			}));
			return `export const mailNations = ${JSON.stringify(list)};`;
		}
	};
}

const sectionListsModule = 'virtual:section-lists';
const resolvedSectionListsModule = `\0${sectionListsModule}`;

/**
 * Every nation's name and address, for the sidebar's second column on the
 * Nations pages (src/lib/section-lists.ts). It is a module rather than part
 * of each page's data, so the browser fetches it once and keeps it, instead of
 * receiving the same long list again with every nation's page.
 */
function sectionLists(): Plugin {
	return {
		name: 'model-tribal-adr-code:section-lists',
		resolveId(identifier) {
			return identifier === sectionListsModule ? resolvedSectionListsModule : undefined;
		},
		load(identifier) {
			if (identifier !== resolvedSectionListsModule) return undefined;
			const list = [...nationIndexRows()]
				.sort((first, second) => first.name.localeCompare(second.name, 'en-US'))
				.map((row) => [row.name, row.id]);
			// The list also holds the Native Hawaiian community and the Indigenous
			// peoples of the territories; the count beside "Native nations" leaves them out.
			const nationCount = nationIndexRows().filter((row) => row.entityType === 'native-nation').length;
			return `export const nationNames = ${JSON.stringify(list)};\nexport const nationCount = ${nationCount};`;
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

const portraitsModule = 'virtual:portraits';
const resolvedPortraitsModule = `\0${portraitsModule}`;

/**
 * Lists the portraits of Justices and Presidents the Worker may serve
 * (src/routes/supreme-court/portraits), as a small module bundled into the
 * Worker: only portraits whose license allows showing them, each with the
 * SHA-256 of the reviewed copy.
 */
function portraitList(): Plugin {
	return {
		name: 'model-tribal-adr-code:portraits',
		resolveId(identifier) {
			return identifier === portraitsModule ? resolvedPortraitsModule : undefined;
		},
		load(identifier) {
			if (identifier !== resolvedPortraitsModule) return undefined;
			return `export const portraits = ${JSON.stringify(servablePortraits())};`;
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
 * glossary and the story pages cite, formatted with citeproc-js while the site is built
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
				for (const quotation of entry.law_dictionary ?? []) keys.add(quotation.source);
				const prose = `${entry.definition} ${entry.usage_note ?? ''}`;
				for (const match of prose.matchAll(/@([a-z0-9-]+)/g)) keys.add(match[1]);
			}
			const today = isoDate(new Date());
			const shownStories = storyRecords().filter((record) => storyIsShown(record, today));
			for (const key of storySourceKeys(shownStories)) keys.add(key);
			const records = [...keys].flatMap((key) => {
				const record = sources().get(key);
				return record ? [record] : [];
			});
			return `export const sourceCitations = ${JSON.stringify(fullCitations(records))};`;
		}
	};
}

const essayLibraryModule = 'virtual:essay-library';
const resolvedEssayLibraryModule = `\0${essayLibraryModule}`;

/**
 * What the Worker needs to render essays, which live in the private bucket
 * and are rendered on request (docs/editing.md): the full citation of every
 * source record, so an essay can cite any of them; the glossary terms; and
 * the essays as git holds them, which the workspace can bring into the
 * bucket as a new version (src/lib/server/essay-library.ts).
 */
function essayLibrary(): Plugin {
	return {
		name: 'model-tribal-adr-code:essay-library',
		resolveId(identifier) {
			return identifier === essayLibraryModule ? resolvedEssayLibraryModule : undefined;
		},
		load(identifier) {
			if (identifier !== resolvedEssayLibraryModule) return undefined;
			return [
				`export const essayCitations = ${JSON.stringify(everyFullCitation())};`,
				`export const essayTerms = ${JSON.stringify(glossaryTerms())};`,
				`export const essayBoxFacts = ${JSON.stringify(everyBoxFact())};`,
				`export const essaysInGit = ${JSON.stringify(essaysInGit())};`,
				`export const essayCaseNames = ${JSON.stringify(caseNames())};`,
				`export const essayCaseLinks = ${JSON.stringify(caseLinks())};`,
				`export const essaySpellingWords = ${JSON.stringify(spellingWords())};`
			].join('\n');
		}
	};
}

const formsModule = 'virtual:forms';
const resolvedFormsModule = `\0${formsModule}`;

/**
 * The forms at /forms, built from docs/contributor-forms/ and content/forms/
 * (src/lib/server/form-catalog.ts). Bundled into the Worker, which answers a
 * form sent online and cannot read the repository.
 */
function formCatalog(): Plugin {
	return {
		name: 'model-tribal-adr-code:forms',
		resolveId(identifier) {
			return identifier === formsModule ? resolvedFormsModule : undefined;
		},
		load(identifier) {
			if (identifier !== resolvedFormsModule) return undefined;
			const forms = buildFormCatalog();
			for (const form of forms) this.addWatchFile(fileURLToPath(new URL(`../${form.file}`, import.meta.url)));
			return `export const forms = ${JSON.stringify(forms)};`;
		}
	};
}

const buildModule = 'virtual:build';
const resolvedBuildModule = `\0${buildModule}`;

/**
 * The commit the site was built from. Workers Builds sets
 * WORKERS_CI_COMMIT_SHA; a build on a computer has none. A review in the
 * workspace records it, so a sign-off names the exact text it approved.
 *
 * Also the pull requests merged most recently, read from git, which
 * /edition.json serves so the update card can list what an update brings
 * (src/lib/recent-changes.ts). A shallow clone gives fewer; no git gives none.
 */
function recentChanges(): Change[] {
	try {
		const log = execFileSync('git', ['log', '--first-parent', '-n', '60', '--format=%cI%x09%s', 'HEAD'], {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore']
		});
		return parseGitLog(log);
	} catch {
		return [];
	}
}

const sponsorshipCountsModule = 'virtual:sponsorship-counts';
const resolvedSponsorshipCountsModule = `\0${sponsorshipCountsModule}`;

/**
 * The counts the Sponsorship page shows (src/routes/sponsor/): nations with a
 * page, the federally recognized nations the printed-copy goal counts, and
 * sources recorded. The Worker renders that page, so it cannot read the
 * content files itself.
 */
function sponsorshipCounts(): Plugin {
	return {
		name: 'model-tribal-adr-code:sponsorship-counts',
		resolveId(identifier) {
			return identifier === sponsorshipCountsModule ? resolvedSponsorshipCountsModule : undefined;
		},
		load(identifier) {
			if (identifier !== resolvedSponsorshipCountsModule) return undefined;
			const real = nations().filter((record) => !record.example);
			const counts = {
				nationPages: real.length,
				federallyRecognized: real.filter((record) => (record.recognition ?? []).some((fact) => fact.type === 'federal')).length,
				sources: sources().size
			};
			return `export const sponsorshipCounts = ${JSON.stringify(counts)};`;
		}
	};
}

const followablePagesModule = 'virtual:followable-pages';
const resolvedFollowablePagesModule = `\0${followablePagesModule}`;

/**
 * Lists the pages built with the site that readers can follow, with a
 * fingerprint of each, as a module bundled into the Worker. The Worker
 * compares the fingerprints with the last build's to tell followers which
 * pages changed (src/lib/server/following.ts).
 */
function followablePages(): Plugin {
	return {
		name: 'model-tribal-adr-code:followable-pages',
		resolveId(identifier) {
			return identifier === followablePagesModule ? resolvedFollowablePagesModule : undefined;
		},
		load(identifier) {
			if (identifier !== resolvedFollowablePagesModule) return undefined;
			return `export const followableBuild = ${JSON.stringify(followableBuild())};`;
		}
	};
}

const pageHistoryModule = 'virtual:page-history';
const resolvedPageHistoryModule = `\0${pageHistoryModule}`;

/**
 * Lists the pages built with the site for Recent changes, with a fingerprint
 * of each and, for pages whose earlier wording may be shown, their text. The
 * Worker compares the list with the last build's and records each change
 * (src/lib/server/page-history.ts).
 */
function pageHistory(): Plugin {
	return {
		name: 'model-tribal-adr-code:page-history',
		resolveId(identifier) {
			return identifier === pageHistoryModule ? resolvedPageHistoryModule : undefined;
		},
		load(identifier) {
			if (identifier !== resolvedPageHistoryModule) return undefined;
			return `export const historyBuild = ${JSON.stringify(historyBuild())};`;
		}
	};
}

function buildInformation(): Plugin {
	return {
		name: 'model-tribal-adr-code:build',
		resolveId(identifier) {
			return identifier === buildModule ? resolvedBuildModule : undefined;
		},
		load(identifier) {
			if (identifier !== resolvedBuildModule) return undefined;
			const commit = process.env.WORKERS_CI_COMMIT_SHA ?? process.env.GITHUB_SHA ?? '';
			return [
				`export const buildCommit = ${JSON.stringify(commit.slice(0, 40))};`,
				`export const recentChanges = ${JSON.stringify(recentChanges())};`
			].join('\n');
		}
	};
}

export default defineConfig({
	plugins: [
		designTokens(),
		mapGeometry(),
		reviewSubjects(),
		publicContactsList(),
		mailNations(),
		nationImages(),
		portraitList(),
		sectionLists(),
		publicCopiesList(),
		sourceCitations(),
		essayLibrary(),
		formCatalog(),
		buildInformation(),
		followablePages(),
		sponsorshipCounts(),
		pageHistory(),
		sveltekit({
			compilerOptions: {
				// Runes mode for the project's own components. Can be removed in Svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			prerender: {
				// Every page is built ahead of time from the files in content/.
				// The lists of checksums are written after the build (tools/write-checksums.mjs), so a
				// link to one is not followed.
				handleHttpError: ({ path, message }) => {
					if (path === '/checksums.txt' || path === '/checksums.json') return;
					throw new Error(message);
				},
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
