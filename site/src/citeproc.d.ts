// The few parts of citeproc-js (https://citeproc-js.readthedocs.io/) that
// src/lib/server/citations.ts uses. The package ships no types of its own.

declare module 'citeproc' {
	interface CitationSystem {
		retrieveLocale(language: string): string;
		retrieveItem(id: string): unknown;
	}

	interface CitationStatus {
		bibchange?: boolean;
		citation_errors?: unknown[];
	}

	class Engine {
		constructor(system: CitationSystem, style: string, language?: string);
		setOutputFormat(format: 'html' | 'text' | 'rtf'): void;
		processCitationCluster(
			citation: {
				citationItems: { id: string; locator?: string; label?: string }[];
				properties: { noteIndex: number };
			},
			citationsBefore: [string, number][],
			citationsAfter: [string, number][]
		): [CitationStatus, [number, string, string?][]];
	}

	const citeproc: { Engine: typeof Engine };
	export default citeproc;
}
