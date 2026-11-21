// Packages the nations directory table as a one-chapter EPUB 3 so it can be
// checked with EPUBCheck and an accessibility scan. This is a test file, not
// the ebook pipeline (decision record 0011 chose a custom pipeline; its
// packager would call renderTableXhtml() the same way).
//
// Writes ../out/epub/nations-directory.epub. Needs the `zip` command.

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeXml, renderTableXhtml } from './render-table.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const spikeRoot = join(here, '..', '..');
const definition = JSON.parse(readFileSync(join(spikeRoot, 'out', 'tables', 'nations-directory.json'), 'utf8'));
const workDirectory = join(spikeRoot, 'out', 'epub', 'unpacked');
const epubFile = join(spikeRoot, 'out', 'epub', 'nations-directory.epub');
rmSync(workDirectory, { recursive: true, force: true });

const title = 'Nations directory table test';
const files = {
  mimetype: 'application/epub+zip',
  'META-INF/container.xml': `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>
`,
  'EPUB/package.opf': `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-identifier" xml:lang="en-US">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="book-identifier">urn:uuid:3f0e6a2c-5d1b-4f7e-9a51-2b8f0c7d9e11</dc:identifier>
<dc:title>${title}</dc:title>
<dc:language>en-US</dc:language>
<dc:creator>Model Tribal ADR Code project</dc:creator>
<meta property="dcterms:modified">2026-11-21T00:00:00Z</meta>
<meta property="schema:accessMode">textual</meta>
<meta property="schema:accessModeSufficient">textual</meta>
<meta property="schema:accessibilityFeature">structuralNavigation</meta>
<meta property="schema:accessibilityFeature">tableOfContents</meta>
<meta property="schema:accessibilityFeature">readingOrder</meta>
<meta property="schema:accessibilityHazard">none</meta>
<meta property="schema:accessibilitySummary">Test file: one data table with a caption, column headers and row headers.</meta>
<meta property="dcterms:conformsTo">EPUB Accessibility 1.1 - WCAG 2.1 Level AA</meta>
</metadata>
<manifest>
<item id="navigation" href="navigation.xhtml" media-type="application/xhtml+xml" properties="nav"/>
<item id="table-chapter" href="table.xhtml" media-type="application/xhtml+xml"/>
<item id="stylesheet" href="ebook.css" media-type="text/css"/>
</manifest>
<spine><itemref idref="table-chapter"/></spine>
</package>
`,
  'EPUB/navigation.xhtml': `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en-US" xml:lang="en-US">
<head><meta charset="utf-8"/><title>Contents</title></head>
<body><nav epub:type="toc" id="toc"><h1>Contents</h1><ol><li><a href="table.xhtml">Nations directory</a></li></ol></nav></body>
</html>
`,
  'EPUB/table.xhtml': `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en-US" xml:lang="en-US">
<head><meta charset="utf-8"/><title>${escapeXml(title)}</title><link rel="stylesheet" type="text/css" href="ebook.css"/></head>
<body>
<main>
<section epub:type="chapter" role="doc-chapter" aria-labelledby="chapter-heading">
<h1 id="chapter-heading">Nations directory</h1>
${renderTableXhtml(definition)}
</section>
</main>
</body>
</html>
`,
  'EPUB/ebook.css': `table { border-collapse: collapse; width: 100%; font-size: 0.85em; }
caption { text-align: left; font-weight: bold; padding-bottom: 0.5em; }
th, td { text-align: left; vertical-align: top; padding: 0.25em 0.4em; border-bottom: 1px solid #777777; }
thead th { border-bottom: 2px solid #000000; }
.align-end { text-align: right; }
.table-scroll { overflow-x: auto; }
`,
};

for (const [name, content] of Object.entries(files)) {
  const path = join(workDirectory, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content.normalize('NFC'), 'utf8');
}
rmSync(epubFile, { force: true });
// The mimetype file must come first and be stored uncompressed (EPUB 3 Open Container Format).
execFileSync('zip', ['-X0', '-q', epubFile, 'mimetype'], { cwd: workDirectory });
execFileSync('zip', ['-Xr9D', '-q', epubFile, 'META-INF', 'EPUB'], { cwd: workDirectory });
const chapterBytes = Buffer.byteLength(files['EPUB/table.xhtml']);
console.log(`Wrote ${epubFile}; table chapter is ${chapterBytes} bytes for ${definition.rows.length} rows`);
