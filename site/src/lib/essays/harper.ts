/**
 * Spelling and grammar from Harper (harper.js, Apache-2.0, by Automattic),
 * which runs in the browser in a web worker, so no text leaves the page
 * (Trevor, 2026-11-22: "spell-check ... as well as grammer-check
 * functionality, try and find good libraries"). Its dictionary and rules
 * come as one WebAssembly file of about 20 MB, loaded only when someone
 * turns the checks on in the editor and kept by the browser after that; the
 * offline copy of the site leaves it out (src/service-worker/index.ts).
 *
 * The dictionary also gets the names of nations, glossary terms and court
 * cases (essaySpellingWords), and the words a person adds, kept in this
 * browser only.
 */
import type { Linter } from 'harper.js';

export interface HarperIssue {
	/** Place in the text checked, in UTF-16 code units, as JavaScript strings count. */
	start: number;
	end: number;
	kind: string;
	spelling: boolean;
	problem: string;
	message: string;
	suggestions: string[];
}

const addedWordsKey = 'editor-added-words';

export function addedWords(): string[] {
	try {
		const saved = JSON.parse(localStorage.getItem(addedWordsKey) ?? '[]');
		return Array.isArray(saved) ? saved.filter((word): word is string => typeof word === 'string') : [];
	} catch {
		return [];
	}
}

let linter: Promise<Linter> | undefined;

/** Loads Harper once per page, with the project's words. */
export function harper(projectWords: string[]): Promise<Linter> {
	linter ??= (async () => {
		const [{ WorkerLinter, Dialect }, { binary }] = await Promise.all([import('harper.js'), import('harper.js/binary')]);
		const loaded = new WorkerLinter({ binary, dialect: Dialect.American });
		await loaded.setup();
		await loaded.importWords([...projectWords, ...addedWords()]);
		return loaded;
	})();
	linter.catch(() => (linter = undefined));
	return linter;
}

/** Adds a word to this browser's list and to the loaded dictionary. */
export async function addWord(word: string): Promise<void> {
	const words = new Set(addedWords());
	words.add(word);
	try {
		localStorage.setItem(addedWordsKey, JSON.stringify([...words]));
	} catch {
		// Storage can be blocked; the word then counts for this page only.
	}
	if (linter) await (await linter).importWords([word]);
}

export async function checkText(loaded: Linter, text: string): Promise<HarperIssue[]> {
	const lints = await loaded.lint(text, { language: 'plaintext' });
	return lints.map((lint) => {
		const span = lint.span();
		const kind = lint.lint_kind();
		return {
			start: span.start,
			end: span.end,
			kind: lint.lint_kind_pretty(),
			spelling: kind === 'Spelling' || kind === 'Typo',
			problem: lint.get_problem_text(),
			message: lint.message(),
			suggestions: lint
				.suggestions()
				.slice(0, 4)
				.map((suggestion) => {
					const replacement = suggestion.get_replacement_text();
					// Kind 1 removes the words, kind 2 adds text after them.
					const kindNumber = Number(suggestion.kind());
					return kindNumber === 1 ? '' : kindNumber === 2 ? `${lint.get_problem_text()}${replacement}` : replacement;
				})
		};
	});
}
