/**
 * Where the site's PDF viewer finds pdf.js's image decoders: the WebAssembly
 * (and plain script fallbacks) that draw JPEG 2000 and JBIG2 images and read
 * color profiles. pdf.js loads them by fixed names from one folder, given as
 * `wasmUrl`. The site's build copies them there (vite.config.ts,
 * pdfDecoders); in development Vite serves node_modules itself.
 */

/** The folder the built site serves the decoders from, named for the pdf.js version so a new version never meets an old cached file. */
export function builtPdfDecoderFolder(version: string): string {
	return `/_app/immutable/pdfjs-${version}/wasm/`;
}

/** The decoders' folder for this page: the built one, or node_modules in development. */
export function pdfDecoderFolder(version: string, development: boolean): string {
	return development ? '/node_modules/pdfjs-dist/wasm/' : builtPdfDecoderFolder(version);
}

/** The files copied: the image and color decoders and their licenses, not the scripting engine (QuickJS), which the viewer never turns on. */
export function isPdfDecoderFile(name: string): boolean {
	return /^(openjpeg|jbig2|qcms)/.test(name) || /^LICENSE_(OPENJPEG|JBIG2|QCMS|PDFJS_OPENJPEG|PDFJS_JBIG2|PDFJS_QCMS)$/.test(name);
}
