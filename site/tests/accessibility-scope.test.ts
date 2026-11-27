import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pagesFor, scopeFor } from '../tools/accessibility-scope.mjs';

describe('scopeFor', () => {
	it('checks only the sample when nothing the pages show changed', () => {
		expect(scopeFor(['docs/roadmap.md', 'site/src/lib/components/SiteHeader.svelte', 'site/src/routes/+layout.svelte'])).toBe('sample');
	});

	it('checks every page when the check or its rules change', () => {
		expect(scopeFor(['site/tools/accessibility-rules.mjs'])).toBe('all');
	});

	it('adds the pages of a changed route and every page under a changed route folder', () => {
		expect(scopeFor(['site/src/routes/nations/[id]/+page.svelte', 'site/src/routes/nations/map/Legend.svelte', 'site/src/routes/+page.svelte'])).toBe(
			'sample page:/ page:/nations/* tree:/nations/map'
		);
	});

	it('adds the page of each changed record, or the whole route when many change', () => {
		expect(scopeFor(['content/tribes/k/karuk-tribe.yaml', 'content/glossary/adr.yaml', 'content/sources/a/act.yaml'])).toBe(
			'sample record:/glossary/*=adr record:/nations/*=karuk-tribe'
		);
		const many = Array.from({ length: 101 }, (_, index) => `content/glossary/term-${index}.yaml`);
		expect(scopeFor(many)).toBe('sample page:/glossary/*');
	});
});

describe('pagesFor', () => {
	let output: string;

	beforeAll(() => {
		output = mkdtempSync(path.join(tmpdir(), 'accessibility-scope-'));
		const write = (file: string, bytes = 10) => {
			mkdirSync(path.dirname(path.join(output, file)), { recursive: true });
			writeFileSync(path.join(output, file), 'x'.repeat(bytes));
		};
		write('index.html');
		write('about.html');
		write('_app/skipped.html');
		for (let index = 0; index < 300; index += 1) write(`nations/nation-${String(index).padStart(3, '0')}.html`, index === 7 ? 500 : 10);
		write('nations/map.html');
	});

	afterAll(() => rmSync(output, { recursive: true, force: true }));

	it('samples the first, middle, last and largest page of each folder', () => {
		expect(pagesFor('sample', output)).toEqual(['/', '/about', '/nations/map', '/nations/nation-007', '/nations/nation-149', '/nations/nation-299']);
	});

	it('adds a changed record and a spread of a large route', () => {
		expect(pagesFor('sample record:/nations/*=nation-042', output)).toContain('/nations/nation-042');
		const route = pagesFor('sample page:/nations/*', output);
		expect(route.length).toBeGreaterThanOrEqual(150);
		expect(route.length).toBeLessThan(170);
	});

	it('checks every page for "all"', () => {
		expect(pagesFor('all', output)).toHaveLength(303);
	});
});
