import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { repositoryRoot } from '#lib/server/content.ts';
import {
	addressOfFile,
	projectDocumentPage,
	resolveDocumentLink,
	unwrapLines,
	withNumberedBackLinks,
	withoutRepositoryOnlyText,
	withScrollingTables
} from '#lib/server/project-documents.ts';

const repository = 'https://github.com/Phauks/Tribal-Law-Project';

describe('project documents as site pages', () => {
	it('shows the charter and the licenses, and no internal documents', () => {
		expect(addressOfFile('docs/charter.md')).toBe('/charter');
		expect(addressOfFile('LICENSE.md')).toBe('/licenses');
		expect(addressOfFile('LICENSES/CC-BY-4.0.txt')).toBe('/licenses/cc-by-4.0');
		expect(addressOfFile('docs/requests.md')).toBeUndefined();
		expect(addressOfFile('docs/decisions/0007-map-shows-state-presence.md')).toBeUndefined();
	});

	it('takes the page title from the first heading and leaves it out of the body', () => {
		const page = projectDocumentPage('/charter');
		expect(page?.title).toBeTruthy();
		expect(page?.html).not.toContain('<h1');
		expect(page?.historyLink).toBe(`${repository}/commits/main/docs/charter.md`);
	});

	it('names no internal document and links to no repository file on the charter and licenses pages', () => {
		for (const address of ['/charter', '/licenses']) {
			const html = projectDocumentPage(address)?.html ?? '';
			expect(html).not.toMatch(/decision records?\s+\d/i);
			expect(html.replace(/<[^>]+>/g, ' ')).not.toMatch(/\b[\w./-]+\.md\b/);
			expect(html).not.toContain(`${repository}/blob/`);
		}
	});
});

describe('links inside a project document', () => {
	it('points a link to another shown document at its page, keeping the anchor', () => {
		expect(resolveDocumentLink('../LICENSE.md', 'docs/charter.md')).toEqual({
			kind: 'page',
			href: '/licenses',
			file: 'LICENSE.md'
		});
		expect(resolveDocumentLink('charter.md#scope', 'docs/requests.md')).toMatchObject({ href: '/charter#scope' });
		expect(resolveDocumentLink(`${repository}/blob/main/docs/charter.md`, 'LICENSE.md')).toMatchObject({
			href: '/charter'
		});
	});

	it('marks a link to any other repository file, which the page shows as plain words', () => {
		expect(resolveDocumentLink('decisions/0026-model-peacemaking-code.md', 'docs/charter.md')).toEqual({
			kind: 'unshown-file',
			file: 'docs/decisions/0026-model-peacemaking-code.md'
		});
	});

	it('leaves other websites and anchors alone, and notes links to GitHub', () => {
		expect(resolveDocumentLink('https://www.ecfr.gov/', 'docs/charter.md')).toEqual({
			kind: 'web',
			href: 'https://www.ecfr.gov/',
			toGithub: false
		});
		expect(resolveDocumentLink('https://github.com/spdx/license-list-data', 'LICENSE.md')).toMatchObject({
			toGithub: true
		});
		expect(resolveDocumentLink('#scope', 'docs/charter.md')).toMatchObject({ kind: 'web', href: '#scope' });
	});
});

describe('text marked repository-only', () => {
	it('is left out of the website', () => {
		expect(
			withoutRepositoryOnlyText(
				'by its own tradition<!-- repository-only --> ([decision record 0026](x.md))<!-- /repository-only -->.'
			)
		).toBe('by its own tradition.');
	});
});

describe('back links of a footnote cited more than once', () => {
	it('name the number they show', () => {
		expect(
			withNumberedBackLinks('<a href="#footnote-ref-x-2" data-footnote-backref aria-label="Back to reference x">↩<sup>2</sup></a>')
		).toBe('<a href="#footnote-ref-x-2" data-footnote-backref aria-label="Back to reference x, use 2">↩<sup>2</sup></a>');
	});
});

describe('tables in project documents', () => {
	it('scroll in their own box, so they never widen the page', () => {
		expect(withScrollingTables('<p>x</p><table><tr><td>a</td></tr></table>')).toBe(
			'<p>x</p><div class="table-scroll" tabindex="0"><table><tr><td>a</td></tr></table></div>'
		);
	});
});

describe('unwrapLines', () => {
	it('joins the hard-wrapped lines of a paragraph and keeps every word', () => {
		const text = readFileSync(path.join(repositoryRoot, 'LICENSES/MIT.txt'), 'utf8').trim();
		const unwrapped = unwrapLines(text);
		expect(unwrapped.replace(/\s+/g, ' ')).toBe(text.replace(/\s+/g, ' '));
		expect(unwrapped).toContain('obtaining a copy of this software and associated documentation files');
		expect(unwrapped.split('\n\n')).toHaveLength(text.split('\n\n').length);
	});

	it('keeps list items, indented lines and new sentences on their own lines', () => {
		expect(unwrapLines('Terms:\n1. one\n   more\n- two;\nEnd.\nNext one')).toBe('Terms:\n1. one\n   more\n- two;\nEnd.\nNext one');
		expect(unwrapLines('a long line that\nwraps here')).toBe('a long line that wraps here');
	});
});
