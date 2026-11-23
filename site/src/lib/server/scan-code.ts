/**
 * A QR code as SVG path data, drawn on the server so the page sends no
 * script for it. The page colors it with the scan-code tokens, dark squares
 * on light in both themes, so phone cameras can read it.
 */
import { encode } from 'uqr';

export interface ScanCode {
	/** Squares across, without the quiet zone. */
	size: number;
	/** One "M x y h1 v1 h-1 z" square per dark module. */
	path: string;
}

export function scanCode(text: string): ScanCode {
	const { size, data } = encode(text, { ecc: 'M', border: 0 });
	let path = '';
	data.forEach((row, y) => {
		row.forEach((dark, x) => {
			if (dark) path += `M${x} ${y}h1v1h-1z`;
		});
	});
	return { size, path };
}
