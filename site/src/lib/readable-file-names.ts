/**
 * Readable names for the files the site serves under a code. Trevor found on Nov. 27, 2026 that a
 * document downloaded from the site saved as "6df61ccdf0a3cbf733b3.pdf": many copies are kept in the
 * bucket under a code made from the file, so the address names the file by that code. A reader now
 * saves it under its title instead, such as "Peacemaker Court - Alabama-Coushatta Tribe of Texas.pdf".
 *
 * Only the name the file is saved under changes. The copy keeps its key in the bucket and its address,
 * and its bytes are untouched, so its SHA-256 still matches the publisher's file.
 *
 * The name is the title as written, with spaces and capitals, as the .zip of selected search results
 * names its files (thread "Download several search results at once"). A title with no nation's name
 * in it, such as "Peacemaker Court" or "92 Stat. 712", adds the nation the document belongs to. A copy
 * with no title takes the name of the file it was published as. Where two copies would still share a
 * name, such as the 430 Federal Register notices titled "Indian Gaming", each adds the code its key
 * ends in, such as "Indian Gaming (96-2450).pdf".
 *
 * Shared by the build (src/lib/server/copy-lists.ts), the Worker's answers and the .zip files, so it
 * uses nothing but the language itself.
 */

/** The parts of a copy its name is made from. */
export interface NamedCopy {
	key: string;
	title: string;
	/** The addresses it was published at; the last is the publisher's own. */
	links?: string[];
	/** The names of the nations it belongs to. */
	nations?: string[];
}

/** Longest name, with its extension: short enough for every system and for a path inside a .zip. */
export const longestName = 120;

/** Words in nations' names that say nothing about which nation it is. */
const commonWords = new Set([
	'a', 'and', 'band', 'bands', 'colony', 'community', 'confederated', 'county', 'for', 'in', 'indian', 'indians', 'nation',
	'nations', 'native', 'of', 'pueblo', 'rancheria', 'reservation', 'the', 'tribal', 'tribe', 'tribes', 'village'
]);

/** Words left lowercase inside a title written all in capitals once it is set in title case. */
const smallWords = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'in', 'of', 'on', 'or', 'the', 'to', 'with']);

/** The file's extension, from its key: ".pdf". */
export function extensionOf(key: string): string {
	const last = key.split('/').at(-1) ?? key;
	const dot = last.lastIndexOf('.');
	return dot > 0 ? last.slice(dot).toLowerCase() : '';
}

/** The key's last part without its extension: "96-2450". */
function stemOf(key: string): string {
	const last = key.split('/').at(-1) ?? key;
	const dot = last.lastIndexOf('.');
	return dot > 0 ? last.slice(0, dot) : last;
}

/** A code made from the file, such as "6df61ccdf0a3cbf733b3", which tells a reader nothing. */
function isCode(stem: string): boolean {
	return /^[0-9a-f]{12,}$/i.test(stem);
}

function decoded(text: string): string {
	try {
		return decodeURIComponent(text);
	} catch {
		// expected: a link with a stray % keeps its text as written, which is still the name to show.
		return text;
	}
}

/** The name the publisher gave the file, without its extension, if it says more than a code. */
function publishedName(links: string[] = []): string {
	for (const link of [...links].reverse()) {
		if (!URL.canParse(link)) continue;
		const last = decoded(new URL(link).pathname.split('/').at(-1) ?? '');
		const dot = last.lastIndexOf('.');
		const stem = (dot > 0 ? last.slice(0, dot) : last).replace(/[_+]+/g, ' ').trim();
		if (stem && !isCode(stem) && /[a-z]{3}/i.test(stem)) return stem;
	}
	return '';
}

/** "CONSTITUTION AND BY-LAWS" -> "Constitution and By-Laws". A title with any lowercase letter is left as it is. */
function unshouted(title: string): string {
	if (/[a-z]/.test(title) || !/[A-Z]{4}/.test(title)) return title;
	const capitalized = (word: string) => word.replace(/(^|[-(/"'])([a-z])/g, (_, before: string, letter: string) => before + letter.toUpperCase());
	return title
		.toLowerCase()
		.split(' ')
		.map((word, index) => {
			// Roman numerals stay capitals: "Part II", "Article IV".
			if (/^[ivxl]+[.,;:]?$/.test(word) && word !== 'ill') return word.toUpperCase();
			return index > 0 && smallWords.has(word) ? word : capitalized(word);
		})
		.join(' ');
}

/** Whether the title already names the nation, by any word of its name that tells nations apart. */
function namesNation(title: string, nation: string): boolean {
	const words = new Set(title.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
	const telling = nation
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter((word) => word && !commonWords.has(word));
	return telling.length === 0 || telling.some((word) => words.has(word));
}

/**
 * Text made safe as a file name on Windows, macOS and Linux: no slashes, colons or other characters a
 * system refuses, no line breaks, no dot or space at the end.
 */
export function safeFileText(text: string): string {
	return (
		text
			.normalize('NFC')
			// eslint-disable-next-line no-control-regex
			.replace(/[\u0000-\u001f\u007f]/g, ' ')
			.replace(/\s*:\s+/g, ' - ')
			.replace(/[:|]/g, '-')
			.replace(/\s*[/\\]\s*/g, '-')
			.replace(/[“”"]/g, "'")
			.replace(/[<>*?]/g, '')
			.replace(/\s+/g, ' ')
			.trim()
			.replace(/[.\s]+$/, '')
	);
}

/** Cut to at most `length` characters, at a space where there is one, without a dangling comma or dash. */
function shortened(text: string, length: number): string {
	if (text.length <= length) return text;
	const cut = text.slice(0, length + 1);
	const space = cut.lastIndexOf(' ');
	let kept = space > length / 2 ? cut.slice(0, space) : text.slice(0, length);
	// A parenthesis cut off before it closes is left out altogether.
	const open = kept.lastIndexOf('(');
	if (open > length / 3 && kept.indexOf(')', open) === -1) kept = kept.slice(0, open);
	return kept.replace(/[\s,;:.(\-–—]+$/, '');
}

/** The name before any code is added to tell it apart: title (or published name), and the nation if the title lacks it. */
function baseName(copy: NamedCopy, room: number): string {
	const stem = stemOf(copy.key);
	const title = copy.title && copy.title !== copy.key ? copy.title : '';
	// A run of leader dots, as in a scanned table of contents, ends what the title says.
	const plain = (title || publishedName(copy.links) || stem).replace(/\s*\.{4,}.*$/, '');
	let base = safeFileText(unshouted(plain));
	const nation = copy.nations?.length === 1 ? safeFileText(copy.nations[0]) : '';
	if (nation && !namesNation(base, nation)) {
		base = `${shortened(base, Math.max(room - nation.length - 3, 30))} - ${nation}`;
	}
	return shortened(base, room) || safeFileText(stem) || 'document';
}

/** The name one copy is saved under, without telling it apart from others of the same title. */
export function readableFileName(copy: NamedCopy): string {
	const extension = extensionOf(copy.key);
	return `${baseName(copy, longestName - extension.length)}${extension}`;
}

/**
 * What tells a copy apart from others of the same title: the code its key ends in, cut to eight
 * characters when it is made from the file, and with the two folders above it when it is only a page
 * number, as in the Caselaw Access Project's "cal-app-3d/202/0835-01" (reporter, volume, page).
 */
function codeOf(key: string, stem: string): string {
	if (isCode(stem)) return stem.slice(0, 8);
	const parts = key.split('/');
	if (/^[\d-]+$/.test(stem) && parts.length >= 4) return `${parts.at(-3)} ${parts.at(-2)} ${stem}`;
	return stem;
}

/**
 * The name every copy is saved under, by key. Copies that would share a name add the code their key
 * ends in, such as "(96-2450)" (codeOf), and if that is still not enough, a number.
 */
export function readableFileNames(copies: Iterable<NamedCopy>): Map<string, string> {
	const list = [...copies];
	const first = new Map(list.map((copy) => [copy.key, readableFileName(copy)]));
	const counts = new Map<string, number>();
	for (const name of first.values()) {
		const folded = name.toLowerCase();
		counts.set(folded, (counts.get(folded) ?? 0) + 1);
	}
	const names = new Map<string, string>();
	const used = new Set<string>();
	for (const copy of [...list].sort((one, two) => one.key.localeCompare(two.key))) {
		const plain = first.get(copy.key) ?? 'document';
		if ((counts.get(plain.toLowerCase()) ?? 0) === 1) {
			names.set(copy.key, plain);
			used.add(plain.toLowerCase());
		}
	}
	for (const copy of [...list].sort((one, two) => one.key.localeCompare(two.key))) {
		if (names.has(copy.key)) continue;
		const extension = extensionOf(copy.key);
		const stem = stemOf(copy.key);
		const code = safeFileText(codeOf(copy.key, stem)).slice(0, 40);
		// Room for the code in parentheses, and for a number after it should two copies share both.
		const room = longestName - extension.length - code.length - 7;
		let name = `${baseName(copy, room)} (${code})${extension}`;
		for (let number = 2; used.has(name.toLowerCase()); number += 1) name = `${baseName(copy, room)} (${code} ${number})${extension}`;
		names.set(copy.key, name);
		used.add(name.toLowerCase());
	}
	return names;
}

/**
 * A Content-Disposition header that names the file: the name in plain ASCII for older programs, and
 * in full (accents, section signs, dashes) for every browser in use (RFC 6266).
 */
export function contentDisposition(name: string, disposition: 'inline' | 'attachment' = 'attachment'): string {
	const plain =
		name
			.normalize('NFKD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/[–—]/g, '-')
			.replace(/[‘’]/g, "'")
			.replace(/[^\x20-\x7e]/g, '_')
			.replace(/["\\]/g, '_') || 'document';
	const encoded = encodeURIComponent(name).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
	return plain === name ? `${disposition}; filename="${plain}"` : `${disposition}; filename="${plain}"; filename*=UTF-8''${encoded}`;
}
