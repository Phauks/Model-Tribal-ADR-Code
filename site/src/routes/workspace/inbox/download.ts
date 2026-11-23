// The Content-Disposition of a file the inbox hands out to save, with a
// plain-letters name for old programs and the full name for the rest (RFC 6266).
export function saveAs(filename: string): string {
	const plain = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
	return `attachment; filename="${plain}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
