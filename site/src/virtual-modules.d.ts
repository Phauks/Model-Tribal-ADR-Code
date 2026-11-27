// Modules that Vite plugins in vite.config.ts generate when the site is built.

declare module 'virtual:map-geometry' {
	const geometry: import('./lib/map-geometry.ts').MapGeometry;
	export default geometry;
}

declare module 'virtual:review-subjects' {
	/** Content that can be reviewed in the co-author workspace, listed at build time. */
	export const reviewSubjects: {
		kind: import('#lib/permissions.ts').SubjectKind;
		identifier: string;
		title: string;
		/** The record's file in the repository, such as content/tribes/a/example.yaml. */
		file: string;
		/** The public page, or null while the record is held back until the nation approves it. */
		page: string | null;
	}[];
}

declare module 'virtual:public-contacts' {
	/** The office emails and phones each published nation page shows, with their sources, listed at build time. */
	export const publicNationContacts: import('#lib/address-book-sync.ts').PublicNationContacts[];
}

declare module 'virtual:mail-nations' {
	/** The nations outreach can write to, with their state codes (src/lib/server/mail/outreach.ts). */
	export const mailNations: { identifier: string; name: string; states: string[]; page: string | null }[];
}

declare module 'virtual:section-lists' {
	/** Every nation's name and page id, A to Z, for the sidebar (src/lib/section-lists.ts). */
	export const nationNames: [name: string, id: string][];
	/** How many of them are Native nations, leaving out the Native Hawaiian community and the territories' peoples. */
	export const nationCount: number;
}

declare module 'virtual:nation-images' {
	/** The nations' official images the Worker may serve, listed at build time. */
	export const nationImages: import('#lib/official-images.ts').ServableImage[];
}

declare module 'virtual:portraits' {
	/** The pictures of Justices, Presidents and Courts the Worker may serve, listed at build time. */
	export const portraits: { person: string; key: string; mediaType: string; sha256: string; link: string }[];
}

declare module 'virtual:public-copies' {
	/** The copies of public documents the Worker may serve at /copies/, listed at build time. */
	export const publicCopies: (Pick<import('#lib/public-copies.ts').PublicCopy, 'key' | 'mediaType' | 'sha256' | 'bytes' | 'links'> & {
		/** For a nation's law or court opinion, the choices it follows (src/lib/nation-restrictions.ts). */
		restrict?: import('#lib/nation-restrictions.ts').CopyRestriction;
	})[];
}

declare module 'virtual:source-citations' {
	/** The full citation, as HTML in the project's Indigo Book style, of each source the glossary and the story pages cite, by key. */
	export const sourceCitations: Record<string, string>;
}

declare module 'virtual:essay-library' {
	// The full citation of every source record is read on request instead (src/lib/server/essay-citations.ts).
	/** Glossary terms by id, for every entry that has a page. */
	export const essayTerms: Record<string, string>;
	/** The lines under each case or law box's heading, as [label, HTML] pairs. */
	export const essayBoxFacts: { cases: Record<string, [string, string][]>; laws: Record<string, [string, string][]> };
	/** The essays in content/essays/, the back matter in content/back-matter/ and the pages about the site in content/about/ as git held them when the site was built, by id. */
	export const essaysInGit: Record<string, string>;
	/** Each court case's name and decision date, by source key. */
	export const essayCaseNames: Record<string, { title: string; date: number[] }>;
	/** Where a case's name links when no essay has a box for it (the copy of the opinion on this site, or where it was published), by source key. */
	export const essayCaseLinks: Record<string, string>;
	/** Each court case's opinions and the report page each starts on, by source key (src/lib/case-opinions.ts). */
	export const essayOpinions: Record<string, import('#lib/case-opinions.ts').OpinionEntry[]>;
	/** The parts of each case and law box its source's record keeps, by source key (src/lib/essays/record-boxes.ts). */
	export const essayRecordBoxes: { cases: Record<string, import('#lib/essays/record-boxes.ts').RecordBox>; laws: Record<string, import('#lib/essays/record-boxes.ts').RecordBox> };
	/** Words the spelling check should accept: names of nations, glossary terms and court cases. */
	export const essaySpellingWords: string[];
}

declare module 'virtual:forms' {
	/** Every form at /forms, built from its Markdown file (src/lib/server/form-catalog.ts). */
	export const forms: import('#lib/forms.ts').FormTemplate[];
}

declare module 'virtual:build' {
	/** The git commit the site was built from, or empty when built on a computer. */
	export const buildCommit: string;
	/** Pull requests merged most recently, newest first (src/lib/recent-changes.ts). */
	export const recentChanges: import('#lib/recent-changes.ts').Change[];
}

declare module 'virtual:sponsorship-counts' {
	/** Counts the Sponsorship page shows, taken when the site is built (src/lib/server/sponsorship-goals.ts). */
	export const sponsorshipCounts: import('#lib/server/sponsorship-goals.ts').SponsorshipCounts;
}

declare module 'cloudflare:workers' {
	/** The Worker's bindings and secrets (src/app.d.ts). */
	export const env: WorkerEnvironment;
	/** Keeps the Worker running until the promise settles, after the response has gone (at most 30 seconds). */
	export function waitUntil(promise: Promise<unknown>): void;
	/** The Worker's own edge cache (Workers Cache), for purging what it keeps (src/lib/server/edge-cache.ts). Missing where the runtime has none. */
	export const cache:
		| {
				purge(options: { tags?: string[]; pathPrefixes?: string[]; purgeEverything?: boolean }): Promise<{ success: boolean; errors: { code: number; message: string }[] }>;
		  }
		| undefined;
}

declare module 'virtual:followable-pages' {
	/** The pages built with the site that readers can follow, with a fingerprint of each (src/lib/server/following.ts). */
	export const followableBuild: import('#lib/server/following.ts').FollowableBuild;
}

declare module 'cloudflare:sockets' {
	/** Opens a TCP connection from the Worker (Cloudflare, "TCP sockets"); used for outreach over SMTP (src/lib/server/mail/socket-opener.ts). */
	export function connect(
		address: { hostname: string; port: number },
		options?: { secureTransport?: 'off' | 'on' | 'starttls'; allowHalfOpen?: boolean }
	): unknown;
}

declare module 'virtual:page-history' {
	/** The pages built with the site, for Recent changes and page histories (src/lib/server/page-history-build.ts). */
	export const historyBuild: import('#lib/page-history.ts').HistoryBuild;
}

declare module 'virtual:site-text-catalog' {
	/** Every piece of fixed text in the site's components (src/lib/site-text-markers.ts, docs/site-text.md). */
	export const siteTextCatalog: import('#lib/site-text-markers.ts').SiteTextEntry[];
	/** The publication of edited site text this build carries; 0 for none. */
	export const builtPublication: number;
}
