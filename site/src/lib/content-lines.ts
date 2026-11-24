/**
 * Text values and line folding shared by the two "content line" file formats the site writes:
 * calendar files (.ics, RFC 5545, sections 3.1 and 3.3.11) and contact cards (.vcf, vCard 3.0,
 * RFC 2426 with RFC 2425, section 5.8.1). Both escape a text value the same way and fold a line
 * longer than 75 octets onto continuation lines that start with a space.
 */

/** Escapes a text value: backslash, semicolon, comma and line breaks. */
export function escapeContentText(text: string): string {
	return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/**
 * A content line folded to at most 75 octets, each further line starting
 * with a space. Characters are never split.
 */
export function foldContentLine(line: string): string {
	const encoder = new TextEncoder();
	const pieces: string[] = [];
	let current = '';
	let size = 0;
	for (const character of line) {
		const width = encoder.encode(character).length;
		const limit = pieces.length === 0 ? 75 : 74;
		if (size + width > limit) {
			pieces.push(current);
			current = '';
			size = 0;
		}
		current += character;
		size += width;
	}
	pieces.push(current);
	return pieces.join('\r\n ');
}
