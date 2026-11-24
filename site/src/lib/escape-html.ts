/**
 * Escapes text for HTML or XML text and double-quoted attribute values: ampersand, angle
 * brackets and the double quote. It is outside lib/server so pages can use it too.
 */
export function escapeHtml(text: string): string {
	return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}
