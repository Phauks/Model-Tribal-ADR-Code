import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { builtPdfDecoderFolder, isPdfDecoderFile, pdfDecoderFolder } from '#lib/pdf-decoders.ts';

describe('pdf.js image decoders', () => {
	it('copies the JPEG 2000, JBIG2 and color decoders pdf.js asks for, and their licenses, but not the scripting engine', () => {
		const copied = readdirSync(new URL('../node_modules/pdfjs-dist/wasm/', import.meta.url)).filter(isPdfDecoderFile);
		for (const name of ['openjpeg.wasm', 'openjpeg_nowasm_fallback.js', 'jbig2.wasm', 'jbig2_nowasm_fallback.js', 'qcms_bg.wasm', 'LICENSE_OPENJPEG']) expect(copied).toContain(name);
		expect(copied.some((name) => name.startsWith('quickjs'))).toBe(false);
	});

	it('names the built folder for the pdf.js version, with the trailing slash pdf.js requires', () => {
		expect(builtPdfDecoderFolder('6.5.438')).toBe('/_app/immutable/pdfjs-6.5.438/wasm/');
		expect(pdfDecoderFolder('6.5.438', true)).toBe('/node_modules/pdfjs-dist/wasm/');
		expect(pdfDecoderFolder('6.5.438', false).endsWith('/')).toBe(true);
	});
});
