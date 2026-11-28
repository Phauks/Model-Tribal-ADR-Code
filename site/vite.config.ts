import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';
import { designTokensToCss } from './src/lib/design-tokens.ts';
import { buildMapGeometry } from './src/lib/map-geometry.ts';
import { keptChanges, mergeChanges, parseGitLog, type Change } from './src/lib/recent-changes.ts';
import { fullCitations } from './src/lib/server/citations.ts';
import { citationFileCount, citationFileNumber, citationFilePath, citationTextsPath, plainCitation } from './src/lib/essay-citation-files.ts';
import { caseNames, essayRecords, essaysInGit, everyBoxFact, everyFullCitation, everyOpinionList, everyRecordBox, glossaryTerms, spellingWords, type EssayRecord } from './src/lib/server/essay-library.ts';
import { builtDataFolder, copyFiles, copyMovesFile, restrictableCopiesFile, textLinkFiles, essayCaseNamesFile, essayRecordFiles, privateFilePath, spreadFilePath, spreadRecords, type SpreadFiles } from './src/lib/built-files.ts';
import type { StoredCopy } from './src/lib/server/copy-list.ts';
import { caseLinks } from './src/lib/server/case-previews.ts';
import { textLinkIndex } from './src/lib/server/text-link-index.ts';
import { buildFormCatalog } from './src/lib/server/form-catalog.ts';
import { nationIndexRows } from './src/lib/server/nation-index.ts';
import { followableBuild } from './src/lib/server/followable-build.ts';
import { historyBuild } from './src/lib/server/page-history-build.ts';
import { servablePortraits } from './src/lib/server/supreme-court-pictures.ts';
import {
	essaysForReview,
	glossary,
	glossaryForReview,
	nations,
	nationsForReview,
	copyMoves,
	publicCopies,
	scanTextCopies,
	servableImages,
	sources,
	storyRecords
} from './src/lib/server/content.ts';
import { isoDate, storyIsShown, storySourceKeys } from './src/lib/story-visibility.ts';
import { directoryNameOf, sourceKindOf } from './src/lib/address-book-sync.ts';
import { markSiteText, type SiteTextEntry } from './src/lib/site-text-markers.ts';
import { copyRestriction } from './src/lib/nation-restrictions.ts';
import { copyFileNames } from './src/lib/server/copy-lists.ts';
import { installCandidates, readerToolFiles, type ManifestChunk } from './src/lib/offline-shell.ts';
import { loadPublishedSiteText, siteTextCatalog } from './src/lib/server/site-text-build.ts';
import { loadLiveChanges, loadRepositoryHistory } from './src/lib/server/recent-changes-build.ts';
import { publishedRecordText, recordTextCatalog, usePublishedRecordText } from './src/lib/server/record-text-build.ts';

const designTokensPath = fileURLToPath(new URL('./design-tokens.json', import.meta.url));
const siteFolder = fileURLToPath(new URL('.', import.meta.url));

// The site's wording as published from the website (docs/site-text.md), read
// once before anything is built.
const publishedSiteText = await loadPublishedSiteText(siteFolder);
const liveChanges = await loadLiveChanges(siteFolder);
const repositoryHistory = loadRepositoryHistory();
const publishedSiteTextWords = new Map(Object.entries(publishedSiteText.texts));
// The parts of case and law boxes that can be edited the same way ("Record
// text"). Their catalog is read from the records before any published words
// go into them, and only when something has been published is it read here,
// before the plugins below read the records.
let recordTextEntries: SiteTextEntry[] | undefined;
const recordTextCatalogOnce = () => (recordTextEntries ??= recordTextCatalog());
if (Object.keys(publishedSiteText.texts).length > 0) {
	const changed = usePublishedRecordText(publishedRecordText(recordTextCatalogOnce(), publishedSiteText.texts));
	if (changed > 0) console.log(`Record text: building with ${changed} published parts of case and law boxes.`);
}
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
 * Lists the pictures of Justices, Presidents and Courts the Worker may serve
 * (src/routes/supreme-court/portraits), as a small module bundled into the
 * Worker: only pictures checked by hand (content/supreme-court/pictures.yaml),
 * each with the SHA-256 of the reviewed copy.
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

/** Every copy the Worker may serve, worked out once for the whole build. */
let servedCopies: Record<string, StoredCopy> | undefined;
const servedCopiesOnce = () => {
	if (servedCopies) return servedCopies;
	// The name a reader saves each file under: its title rather than the code its key ends in (src/lib/readable-file-names.ts).
	const names = copyFileNames();
	servedCopies = Object.fromEntries(
		// The texts taken from served scans are served too, though no list counts them (scanTextCopies).
		[...publicCopies(), ...scanTextCopies()].map((copy) => {
			const { key, mediaType, sha256, bytes, links, charset, derivedFrom } = copy;
			// A nation's law or opinion carries its kind and nations, so the Worker can follow the nation's choices (src/lib/nation-restrictions.ts).
			const restrict = copyRestriction(copy);
			const name = names.get(key);
			return [key, { mediaType, sha256, bytes, links, ...(charset ? { charset } : {}), ...(derivedFrom ? { derivedFrom } : {}), ...(name ? { name } : {}), ...(restrict ? { restrict } : {}) }];
		})
	);
	return servedCopies;
};
let movedCopies: Record<string, string> | undefined;
const copyMovesOnce = () => (movedCopies ??= copyMoves());
let everyTextLink: Record<string, string> | undefined;
/** The pages a citation inside a document's text links to (src/lib/server/text-link-index.ts), worked out once. */
const textLinksOnce = () => (everyTextLink ??= textLinkIndex());
const restrictableCopiesOnce = () => Object.entries(servedCopiesOnce()).flatMap(([key, copy]) => (copy.restrict ? [{ key, restrict: copy.restrict }] : []));

/**
 * The copies of public documents the Worker may serve at /copies/: only
 * capture index rows marked for redistribution (src/lib/public-copies.ts).
 * A file left off this list is never served, whatever the private bucket
 * holds. The list is written as private static files, which the Worker
 * reads when a copy is asked for, and the copies of nations' laws and
 * court opinions, which follow the nations' choices, as one more
 * (src/lib/server/copy-list.ts). Until Nov. 27, 2026 it was a module in the
 * Worker's code, 6 MB of it.
 */
function publicCopiesList(): Plugin {
	return {
		name: 'model-tribal-adr-code:public-copies',
		buildStart() {
			writeBuiltData(copyFiles.name, servedCopiesOnce());
			writeBuiltData(restrictableCopiesFile, restrictableCopiesOnce());
			writeBuiltData(copyMovesFile, copyMovesOnce());
			writeBuiltData(textLinkFiles.name, textLinksOnce());
		},
		generateBundle() {
			if (this.environment.name !== 'client') return;
			emitSpreadFiles(this, copyFiles, servedCopiesOnce());
			this.emitFile({ type: 'asset', fileName: privateFilePath(restrictableCopiesFile).slice(1), source: JSON.stringify(restrictableCopiesOnce()) });
			this.emitFile({ type: 'asset', fileName: privateFilePath(copyMovesFile).slice(1), source: JSON.stringify(copyMovesOnce()) });
			emitSpreadFiles(this, textLinkFiles, textLinksOnce());
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

/** Every source's full citation, worked out once for the whole build (about 25 seconds for 22,000 sources). */
let everyCitation: Record<string, string> | undefined;
const citationsOnce = () => (everyCitation ??= everyFullCitation());
let citationsFileWritten = false;
/** Each case and law box's facts and parts, and each case's page and opinions, by key, worked out once. */
let everyEssayRecord: Record<string, EssayRecord> | undefined;
const essayRecordsOnce = () =>
	(everyEssayRecord ??= essayRecords({ facts: everyBoxFact(), links: caseLinks(), opinions: everyOpinionList(), boxes: everyRecordBox() }));
let everyCaseName: ReturnType<typeof caseNames> | undefined;
const caseNamesOnce = () => (everyCaseName ??= caseNames());

/** Writes data for the pages built ahead of time and the development server (src/lib/server/built-files.ts). */
function writeBuiltData(name: string, data: unknown): void {
	const file = path.join(siteFolder, builtDataFolder, `${name}.json`);
	mkdirSync(path.dirname(file), { recursive: true });
	writeFileSync(file, JSON.stringify(data));
}

/** Writes records spread over a set of private static files, for the Worker (src/lib/built-files.ts). */
function emitSpreadFiles(context: { emitFile: (file: { type: 'asset'; fileName: string; source: string }) => unknown }, set: SpreadFiles, records: Record<string, unknown>): void {
	spreadRecords(set, records).forEach((file, number) => {
		context.emitFile({ type: 'asset', fileName: spreadFilePath(set, number).slice(1), source: JSON.stringify(file) });
	});
}

/**
 * What the Worker needs to render essays, which live in the private bucket
 * and are rendered on request (docs/editing.md): the glossary terms, the
 * words the spelling check accepts, and the essays as git holds them, which
 * the workspace can bring into the bucket as a new version
 * (src/lib/server/essay-library.ts).
 *
 * The full citation of every source record is not in the module: about 51 MB
 * by Nov. 26, 2026, it took the Worker past Cloudflare's 64 MiB limit
 * (src/lib/essay-citation-files.ts). The build writes the citations instead
 * as static files under /page-data/essay-citations/, which the Worker reads
 * when it draws a page, and as one file in .svelte-kit/ for the pages built
 * ahead of time (src/lib/server/essay-citations.ts). The facts and parts of
 * every case and law box, each case's page and opinions, and every case's
 * name (about 4 MB by Nov. 27, 2026) are written the same way, as private
 * static files (src/lib/built-files.ts).
 */
function essayLibrary(): Plugin {
	return {
		name: 'model-tribal-adr-code:essay-library',
		buildStart() {
			// For the pages built ahead of time and the development server, which read every citation from here.
			if (citationsFileWritten) return;
			citationsFileWritten = true;
			const file = path.join(siteFolder, '.svelte-kit', 'essay-citations.json');
			mkdirSync(path.dirname(file), { recursive: true });
			writeFileSync(file, JSON.stringify(citationsOnce()));
			writeBuiltData(essayRecordFiles.name, essayRecordsOnce());
			writeBuiltData(essayCaseNamesFile, caseNamesOnce());
		},
		generateBundle() {
			if (this.environment.name !== 'client') return;
			emitSpreadFiles(this, essayRecordFiles, essayRecordsOnce());
			this.emitFile({ type: 'asset', fileName: privateFilePath(essayCaseNamesFile).slice(1), source: JSON.stringify(caseNamesOnce()) });
			const files: Record<string, string>[] = Array.from({ length: citationFileCount }, () => ({}));
			const texts: [string, string][] = [];
			for (const [key, html] of Object.entries(citationsOnce())) {
				files[citationFileNumber(key)][key] = html;
				texts.push([key, plainCitation(html)]);
			}
			files.forEach((citations, number) => {
				this.emitFile({ type: 'asset', fileName: citationFilePath(number).slice(1), source: JSON.stringify(citations) });
			});
			this.emitFile({ type: 'asset', fileName: citationTextsPath.slice(1), source: JSON.stringify(texts) });
		},
		resolveId(identifier) {
			return identifier === essayLibraryModule ? resolvedEssayLibraryModule : undefined;
		},
		load(identifier) {
			if (identifier !== resolvedEssayLibraryModule) return undefined;
			return [
				`export const essayTerms = ${JSON.stringify(glossaryTerms())};`,
				`export const essaysInGit = ${JSON.stringify(essaysInGit())};`,
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
 * Also the pull requests merged most recently, which /edition.json serves
 * so the update card can list what an update brings
 * (src/lib/recent-changes.ts): those git names, those the repository's
 * history names (Cloudflare's shallow clone names only the latest, and it
 * skips builds a newer push overtakes), and those the live site already
 * lists (src/lib/server/recent-changes-build.ts). Changes the live site
 * lists that are newer than this build's own are left out, so a rebuild of
 * an older commit does not claim them.
 */
let builtChanges: { own: Change[]; all: Change[] } | undefined;
function recentChanges(): { own: Change[]; all: Change[] } {
	if (builtChanges) return builtChanges;
	let fromGit: Change[] = [];
	try {
		const log = execFileSync('git', ['log', '--first-parent', '-n', String(keptChanges), '--format=%cI%x09%s', 'HEAD'], {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore']
		});
		fromGit = parseGitLog(log);
	} catch {
		// No git: only the repository's history and what the live site lists.
	}
	const own = mergeChanges([fromGit, parseGitLog(repositoryHistory)]);
	const end = own[0] ? Date.parse(own[0].merged) : Infinity;
	const carried = liveChanges.filter((change) => Date.parse(change.merged) <= end);
	builtChanges = { own, all: mergeChanges([own, carried]) };
	return builtChanges;
}

const sponsorshipCountsModule = 'virtual:sponsorship-counts';
const resolvedSponsorshipCountsModule = `\0${sponsorshipCountsModule}`;

/**
 * The counts the Sponsorship page shows (src/routes/sponsor/): nations with a
 * page, the nations the Every Nation Initiative's two levels count
 * (federally recognized, then federally or state-recognized), and sources
 * recorded. The Worker renders that page, so it cannot read the
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
				federallyOrStateRecognized: real.filter((record) => (record.recognition ?? []).some((fact) => fact.type === 'federal' || fact.type === 'state')).length,
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

const siteTextCatalogModule = 'virtual:site-text-catalog';
const resolvedSiteTextCatalogModule = `\0${siteTextCatalogModule}`;

/**
 * Editable site text (docs/site-text.md). The catalog lists every piece of
 * fixed text in the components, for the workspace's Site text page and the
 * editing box; builtPublication says which publication this build carries,
 * so the hourly run can tell when a rebuild was missed.
 */
function siteText(): Plugin {
	return {
		name: 'model-tribal-adr-code:site-text',
		resolveId(identifier) {
			return identifier === siteTextCatalogModule ? resolvedSiteTextCatalogModule : undefined;
		},
		load(identifier) {
			if (identifier !== resolvedSiteTextCatalogModule) return undefined;
			return [
				`export const siteTextCatalog = ${JSON.stringify([...siteTextCatalog(siteFolder), ...recordTextCatalogOnce()])};`,
				`export const builtPublication = ${publishedSiteText.publication};`
			].join('\n');
		}
	};
}

/** Marks each component's fixed text and writes in its published edits, before Svelte compiles it. */
const siteTextMarkers = {
	name: 'site-text',
	markup({ content, filename }: { content: string; filename?: string }) {
		if (!filename) return undefined;
		const file = path.relative(siteFolder, filename).split(path.sep).join('/');
		if (!file.startsWith('src/')) return undefined;
		const { code, map } = markSiteText(content, file, publishedSiteTextWords);
		return { code, map };
	}
};

/**
 * The newest pull request this build has, for the reader's page
 * (virtual:build-change), so the update card lists what a waiting update
 * adds to it (src/lib/recent-changes.ts, changesSince). It is a separate
 * module so the page does not carry the whole list.
 */
const buildChangeModule = 'virtual:build-change';
const resolvedBuildChangeModule = `\0${buildChangeModule}`;

function buildInformation(): Plugin {
	return {
		name: 'model-tribal-adr-code:build',
		resolveId(identifier) {
			if (identifier === buildModule) return resolvedBuildModule;
			if (identifier === buildChangeModule) return resolvedBuildChangeModule;
			return undefined;
		},
		load(identifier) {
			if (identifier === resolvedBuildChangeModule) {
				const newest = recentChanges().own[0];
				return `export const newestChange = ${JSON.stringify(newest ? { number: newest.number, merged: newest.merged } : null)};`;
			}
			if (identifier !== resolvedBuildModule) return undefined;
			const commit = process.env.WORKERS_CI_COMMIT_SHA ?? process.env.GITHUB_SHA ?? '';
			return [
				`export const buildCommit = ${JSON.stringify(commit.slice(0, 40))};`,
				`export const recentChanges = ${JSON.stringify(recentChanges().all)};`
			].join('\n');
		}
	};
}

const offlineFilesModule = 'virtual:offline-files';
const resolvedOfflineFilesModule = `\0${offlineFilesModule}`;

/**
 * What the service worker needs to know about the build without carrying the list of every built page in its own script (src/lib/offline-shell.ts). The list of prerendered files goes into a separate file, /_app/immutable/offline-paths.<hash>.json, which the worker reads only when a reader saves or looks at collections for offline reading; the module gives its address, and the files saved on install: the core pages this build has and the reader tools. Only the service worker's own build has the prerendered list (SvelteKit's $app/manifest reads it from the define used here); in development there is none, as $app/manifest has none then either.
 */
function offlineFiles(): Plugin {
	return {
		name: 'model-tribal-adr-code:offline-files',
		resolveId(identifier) {
			return identifier === offlineFilesModule ? resolvedOfflineFilesModule : undefined;
		},
		load(identifier) {
			if (identifier !== resolvedOfflineFilesModule) return undefined;
			if (this.environment.name !== 'serviceWorker') return 'export const builtPathsAddress = "";\nexport const installFiles = [];\n';
			const prerendered = this.environment.config.define?.__SVELTEKIT_MANIFEST_PRERENDERED__;
			if (typeof prerendered !== 'string') this.error('The list of prerendered pages was not given to the service worker build (__SVELTEKIT_MANIFEST_PRERENDERED__).');
			const built = (JSON.parse(prerendered) as { path: string }[]).map((page) => `/${page.path}`);
			const list = `${JSON.stringify(built)}\n`;
			const fileName = `_app/immutable/offline-paths.${createHash('sha256').update(list).digest('hex').slice(0, 12)}.json`;
			this.emitFile({ type: 'asset', fileName, source: list });
			const manifestPath = path.resolve(this.environment.config.root, this.environment.config.build.outDir, '.vite/manifest.json');
			const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, ManifestChunk>;
			const builtSet = new Set(built);
			const installFiles = [...installCandidates.filter((address) => builtSet.has(address)), ...readerToolFiles(manifest)];
			return [`export const builtPathsAddress = ${JSON.stringify(`/${fileName}`)};`, `export const installFiles = ${JSON.stringify(installFiles)};`, ''].join('\n');
		}
	};
}

/** Libraries only the browser runs: the map (MapLibre and its basemap styles), the video room's kit and the spelling checker. */
const browserOnlyLibraries = [/^maplibre-gl(\/|$)/, /^@protomaps\/basemaps$/, /^@cloudflare\/realtimekit(-ui)?(\/|$)/, /^harper\.js(\/|$)/];
const browserOnlyStub = '\0browser-only-library';

/**
 * Gives the server build an empty module for each library only the browser
 * runs. Components load them on demand, after the page has started in the
 * browser, so the Worker never calls them; but the server build still wrote
 * them out as chunks, and Cloudflare counts every file of the Worker toward
 * its 64 MiB limit, about 4.6 MiB of them by Nov. 27, 2026 (tools/check-worker-size.mjs).
 */
function browserOnlyInServer(): Plugin {
	return {
		name: 'model-tribal-adr-code:browser-only-in-server',
		enforce: 'pre',
		resolveId(identifier) {
			if (this.environment.name !== 'ssr') return undefined;
			return browserOnlyLibraries.some((pattern) => pattern.test(identifier)) ? browserOnlyStub : undefined;
		},
		load(identifier) {
			if (identifier !== browserOnlyStub) return undefined;
			return 'throw new Error("This library runs only in the browser.");\nexport default undefined;\n';
		}
	};
}

export default defineConfig({
	plugins: [
		browserOnlyInServer(),
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
		siteText(),
		offlineFiles(),
		sveltekit({
			preprocess: [siteTextMarkers],
			compilerOptions: {
				// Runes mode for the project's own components. Can be removed in Svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			csp: {
				// A hash of each script SvelteKit writes into a page, in pages built
				// ahead of time and pages the Worker answers alike, so a script inside
				// text shown with {@html} does not run (decision record 0055).
				mode: 'hash',
				directives: {
					'script-src': [
						'self',
						// The reader's settings in src/app.html, which SvelteKit does not hash itself.
						...appHtmlScriptHashes(),
						// Svelte writes onload="this.__e=event" and onerror="this.__e=event" on
						// images with load or error handlers, so it can replay events that come
						// before the page starts. 'unsafe-hashes' lets only that exact text run.
						'unsafe-hashes',
						scriptHash('this.__e=event'),
						// Spelling and grammar checking (Harper) and other WebAssembly.
						'wasm-unsafe-eval',
						// Cloudflare Turnstile, the "are you a person?" check on public forms
						// (src/lib/components/TurnstileCheck.svelte, decision record 0062).
						'https://challenges.cloudflare.com'
					],
					// The map (MapLibre) and the video call kit start workers from blob: addresses.
					'worker-src': ['self', 'blob:'],
					'object-src': ['none'],
					'base-uri': ['self']
				}
			},
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

/** The CSP source for a script's text: its SHA-256, in base64. */
function scriptHash(text: string): `sha256-${string}` {
	return `sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}`;
}

/** Hashes of the inline scripts in src/app.html, read from the file so an edit there cannot leave a stale hash. */
function appHtmlScriptHashes(): `sha256-${string}`[] {
	const page = readFileSync(new URL('./src/app.html', import.meta.url), 'utf8');
	return [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => scriptHash(match[1]));
}
