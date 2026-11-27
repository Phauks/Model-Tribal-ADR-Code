/**
 * Spelling and grammar from Harper (harper.js, Apache-2.0, by Automattic),
 * which runs in the browser, so no text leaves the page
 * (Trevor, 2026-11-22: "spell-check ... as well as grammer-check
 * functionality, try and find good libraries"). Its dictionary and rules
 * come as one WebAssembly file of about 20 MB, loaded only when someone
 * turns the checks on in the editor and kept by the browser after that; the
 * offline copy of the site leaves it out (src/service-worker/index.ts).
 *
 * It runs on the page itself, one block at a time (EssayChecks.svelte keeps
 * each block's result until its text changes), rather than in Harper's web
 * worker, which loads the 20 MB file twice. A long essay takes about ten
 * seconds the first time; after that only the edited block is checked.
 *
 * The dictionary also gets the names of nations, glossary terms and court
 * cases (essaySpellingWords), and the words a person adds, kept in this
 * browser only.
 */
import type { Linter } from 'harper.js';
import { readStoredJson, writeStoredJson } from '#lib/browser-storage.ts';

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
	const saved = readStoredJson(addedWordsKey);
	return Array.isArray(saved) ? saved.filter((word): word is string => typeof word === 'string') : [];
}

let linter: Promise<Linter> | undefined;

/** Loads Harper once per page, with the project's words. */
export function harper(projectWords: string[]): Promise<Linter> {
	linter ??= (async () => {
		const [{ LocalLinter, Dialect }, { binary }] = await Promise.all([import('harper.js'), import('harper.js/binary')]);
		const loaded = new LocalLinter({ binary, dialect: Dialect.American });
		await loaded.setup();
		await loaded.importWords([...projectWords, ...addedWords()]);
		// Rules that disagree with the style guide (docs/style-guide.md): it never uses
		// the em dash, writes ranges with "to", and keeps "..." in quotations as typed.
		await loaded.setLintConfig({ ...(await loaded.getLintConfig()), Dashes: false, NumericRangeEnDash: false, UseEllipsisCharacter: false });
		return loaded;
	})();
	linter.catch(() => /* expected: the caller gets the rejection and shows it (EssayChecks); this only lets the next check load Harper again. */ (linter = undefined));
	return linter;
}

/** Adds a word to this browser's list and to the loaded dictionary. */
export async function addWord(word: string): Promise<void> {
	const words = new Set(addedWords());
	words.add(word);
	// Storage can be blocked; the word then counts for this page only.
	writeStoredJson(addedWordsKey, [...words]);
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
