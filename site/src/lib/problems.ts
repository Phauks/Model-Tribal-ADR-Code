/**
 * The site's one error type and the helpers every part of the site uses to
 * read an error: the pages in the browser, the site Worker and the other
 * Workers (site/ERRORS.md). Trevor asked on Nov. 27, 2026 for every way the
 * site reports errors to be brought into one framework.
 *
 * A Problem carries a short, stable code, such as `map.style` or
 * `search.fill`, so the same failure can be counted and found in the logs
 * however its message is worded. It may also carry words a reader can be
 * shown; its message is for the people who run the site and is never shown
 * to readers as it is.
 */

/** A code: lowercase words joined by dots or hyphens, such as `search.fill` or `map.tiles-missing`. */
const codePattern = /^[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)*$/u;

/** The code of an error nobody gave a code to. */
export const unexpectedCode = 'unexpected';

export interface ProblemOptions {
	/** The error that led to this one, kept so its message and stack are logged too. */
	cause?: unknown;
	/** Words a reader may be shown, such as "The map could not be drawn." */
	reader?: string;
}

export class Problem extends Error {
	readonly code: string;
	readonly reader: string | undefined;

	constructor(code: string, message: string, options: ProblemOptions = {}) {
		super(message, options.cause === undefined ? undefined : { cause: options.cause });
		this.name = 'Problem';
		this.code = isProblemCode(code) ? code : unexpectedCode;
		this.reader = options.reader;
	}
}

export function isProblemCode(value: unknown): value is string {
	return typeof value === 'string' && value.length <= 64 && codePattern.test(value);
}

/**
 * The message of anything thrown. Replaces the many copies of
 * `problem instanceof Error ? problem.message : String(problem)`. An Error
 * with no message, as some runtime errors have, is named by its kind instead
 * of coming back empty.
 */
export function messageOf(value: unknown): string {
	if (value instanceof Error) return value.message || value.name || 'Error';
	if (typeof value === 'string') return value;
	if (value && typeof value === 'object' && 'message' in value && typeof value.message === 'string') return value.message;
	try {
		return String(value);
	} catch {
		// expected: a value whose String() throws still needs words.
		return 'A value that could not be turned into words';
	}
}

/** The code of anything thrown: its own when it is a Problem or carries one, else the one given. */
export function codeOf(value: unknown, otherwise = unexpectedCode): string {
	if (value instanceof Problem) return value.code;
	if (value && typeof value === 'object' && 'code' in value && isProblemCode(value.code)) return value.code;
	return otherwise;
}

/** Anything thrown, as a Problem, keeping it as the cause when it was not one already. */
export function problemOf(value: unknown, code = unexpectedCode): Problem {
	if (value instanceof Problem) return value;
	return new Problem(codeOf(value, code), messageOf(value), { cause: value });
}

/**
 * The messages of an error and of each error that caused it, outermost
 * first. Stops at five, and at a cause that points back to an error already
 * listed.
 */
export function causeChain(value: unknown): string[] {
	const messages: string[] = [];
	const seen = new Set<unknown>();
	let current: unknown = value;
	while (current !== undefined && current !== null && !seen.has(current) && messages.length < 5) {
		seen.add(current);
		messages.push(messageOf(current));
		current = current instanceof Error ? current.cause : undefined;
	}
	return messages;
}

/**
 * Whether a database error says a table is missing, as it does before a
 * migration is applied. The one place that reads D1's words for it, in place
 * of a regular expression at each call.
 */
export function isMissingTable(value: unknown): boolean {
	return causeChain(value).some((message) => /no such table/iu.test(message));
}

/** Crockford's base 32, which leaves out I, L, O and U so a reference cannot be misread. */
const referenceLetters = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * A new reference for one occurrence of a problem, such as P-4F7K-92QD. The
 * reader sees it beside the error and can quote it when reporting; the log
 * line carries the same reference, so the two can be matched.
 */
export function newReference(): string {
	const bytes = new Uint8Array(8);
	crypto.getRandomValues(bytes);
	const letters = Array.from(bytes, (byte) => referenceLetters[byte % 32]).join('');
	return `P-${letters.slice(0, 4)}-${letters.slice(4)}`;
}

export function isReference(value: unknown): value is string {
	return typeof value === 'string' && /^P-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/u.test(value);
}

/** Names of fields whose values are never logged. */
const secretFieldPattern = /(?:secret|token|password|passcode|authorization|cookie|signature|api[-_]?key|private[-_]?key|^key$|_key$|credential|session)/iu;

export function isSecretField(name: string): boolean {
	return secretFieldPattern.test(name);
}

/**
 * Text with anything that could be a secret or a person's details taken out,
 * for a log line: the query part of each web address (sign-in links carry
 * codes there), email addresses, bearer tokens, `name=value` pairs whose
 * name looks secret, and long runs of letters and digits that look like keys.
 */
export function withoutSecrets(text: string): string {
	return text
		.replace(/(https?:\/\/[^\s?#"'<>]+)\?[^\s#"'<>]*/giu, '$1?…')
		.replace(/[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu, '[email]')
		.replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gu, '$1 [secret]')
		.replace(/\b([A-Za-z_][\w-]*)=("[^"]*"|'[^']*'|[^\s&;,]+)/gu, (whole, name: string) => (isSecretField(name) ? `${name}=[secret]` : whole))
		.replace(/(?<![A-Za-z0-9_+=])(?=[A-Za-z0-9_+=]*\d)(?=[A-Za-z0-9_+=]*[A-Za-z])[A-Za-z0-9_+=]{32,}(?![A-Za-z0-9_+=])/gu, '[secret]');
}

/** Text cut to a length, marked where it was cut. */
export function cut(text: string, length: number): string {
	return text.length <= length ? text : `${text.slice(0, length - 1)}…`;
}
