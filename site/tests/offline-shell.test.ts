import { describe, expect, it } from 'vitest';
import { corePageFiles, installCandidates, readerToolFiles, scriptsIn, type ManifestChunk } from '#lib/offline-shell.ts';

describe('what the service worker saves on install', () => {
	it('reads the scripts and styles a page loads from its HTML, once each', () => {
		const html = `<link href="/_app/immutable/assets/0.Ab-1.css" rel="stylesheet">
			<link rel="modulepreload" href="/_app/immutable/entry/start.X_y.js">
			<link rel="modulepreload" href="/_app/immutable/chunks/a1.js"><link rel="modulepreload" href="/_app/immutable/chunks/a1.js">
			<script>Promise.all([import("/_app/immutable/entry/start.X_y.js"), import("/_app/immutable/entry/app.Q.js")])</script>
			<a href="/glossary">Glossary</a>`;
		expect(scriptsIn(html)).toEqual([
			'/_app/immutable/assets/0.Ab-1.css',
			'/_app/immutable/entry/start.X_y.js',
			'/_app/immutable/chunks/a1.js',
			'/_app/immutable/entry/app.Q.js'
		]);
		expect(scriptsIn('<p>No scripts.</p>')).toEqual([]);
	});

	it('saves the reader tools loaded on demand, but not the video call kit, the map library or the editor', () => {
		const manifest: Record<string, ManifestChunk> = {
			'src/lib/page-document.ts': { file: '_app/immutable/chunks/document.js', isDynamicEntry: true, imports: ['_shared.js'] },
			'src/lib/spreadsheet.ts': { file: '_app/immutable/chunks/spreadsheet.js', isDynamicEntry: true, css: ['_app/immutable/assets/sheet.css'] },
			'_shared.js': { file: '_app/immutable/chunks/shared.js', imports: ['_deeper.js'] },
			'_deeper.js': { file: '_app/immutable/chunks/deeper.js' },
			'../node_modules/@cloudflare/realtimekit/dist/index.es.js': { file: '_app/immutable/chunks/video.js', isDynamicEntry: true },
			'../node_modules/maplibre-gl/dist/maplibre-gl.js': { file: '_app/immutable/chunks/map.js', isDynamicEntry: true },
			'../node_modules/@protomaps/basemaps/dist/esm/index.js': { file: '_app/immutable/chunks/basemaps.js', isDynamicEntry: true },
			'../node_modules/harper.js/dist/index.js': { file: '_app/immutable/chunks/harper.js', isDynamicEntry: true },
			'src/lib/components/essays/EssayEditor.svelte': { file: '_app/immutable/chunks/editor.js', isDynamicEntry: true, imports: ['_shared.js'] },
			'.svelte-kit/generated/client-optimized/nodes/3.js': { file: '_app/immutable/nodes/3.js', isEntry: true }
		};
		expect(readerToolFiles(manifest)).toEqual([
			'/_app/immutable/assets/sheet.css',
			'/_app/immutable/chunks/deeper.js',
			'/_app/immutable/chunks/document.js',
			'/_app/immutable/chunks/shared.js',
			'/_app/immutable/chunks/spreadsheet.js'
		]);
	});

	it('keeps the core pages and their data among the files saved on install', () => {
		expect(corePageFiles).toContain('/__data.json');
		expect(corePageFiles).toContain('/offline/__data.json');
		expect(installCandidates).toEqual(expect.arrayContaining(['/', '/offline', '/search', '/search/index.json', '/opendyslexic.css']));
	});
});
