// Modules that Vite plugins in vite.config.ts generate when the site is built.

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

declare module 'virtual:build' {
	/** The git commit the site was built from, or empty when built on a computer. */
	export const buildCommit: string;
}

declare module 'cloudflare:workers' {
	/** The Worker's bindings and secrets (src/app.d.ts). */
	export const env: WorkerEnvironment;
}
