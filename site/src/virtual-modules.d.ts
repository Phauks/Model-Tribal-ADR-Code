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

declare module 'virtual:nation-images' {
	/** The nations' official images the Worker may serve, listed at build time. */
	export const nationImages: import('#lib/official-images.ts').ServableImage[];
}

declare module 'virtual:public-copies' {
	/** The copies of public documents the Worker may serve at /copies/, listed at build time. */
	export const publicCopies: Pick<
		import('#lib/public-copies.ts').PublicCopy,
		'key' | 'mediaType' | 'sha256' | 'bytes' | 'links'
	>[];
}

declare module 'virtual:source-citations' {
	/** The full citation, as HTML in the project's Indigo Book style, of each source the glossary and the story pages cite, by key. */
	export const sourceCitations: Record<string, string>;
}

declare module 'virtual:essay-library' {
	/** The full citation, as HTML in the project's Indigo Book style, of every source record, by key. */
	export const essayCitations: Record<string, string>;
	/** Glossary terms by id, for every entry that has a page. */
	export const essayTerms: Record<string, string>;
	/** The lines under each case or law box's heading, as [label, HTML] pairs. */
	export const essayBoxFacts: { cases: Record<string, [string, string][]>; laws: Record<string, [string, string][]> };
	/** The essays in content/essays/ and the back matter in content/back-matter/ as git held them when the site was built, by id. */
	export const essaysInGit: Record<string, string>;
	/** Each court case's name and decision date, by source key. */
	export const essayCaseNames: Record<string, { title: string; date: number[] }>;
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

declare module 'cloudflare:workers' {
	/** The Worker's bindings and secrets (src/app.d.ts). */
	export const env: WorkerEnvironment;
}

declare module 'virtual:followable-pages' {
	/** The pages built with the site that readers can follow, with a fingerprint of each (src/lib/server/following.ts). */
	export const followableBuild: import('#lib/server/following.ts').FollowableBuild;
}
